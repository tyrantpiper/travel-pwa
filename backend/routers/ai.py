"""
AI Router (V23.1 Standard)
---------------------------
Handles AI-driven workflows for receipt parsing, financial actuary, and trip generation.
Optimized for toolchain stability and financial nomenclature.
"""

import json
import asyncio
import base64
import uuid
import httpx
import io
from PIL import Image
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

from google import genai
from google.genai import types
from fastapi import APIRouter, Depends, HTTPException, Request
from utils.limiter import limiter

from models.base import (
    MarkdownImportRequest, 
    GenerateTripRequest, 
    SimplePromptRequest,
    ReceiptRequest,
    ActuaryRequest
)
from utils.deps import get_gemini_key, get_verified_user
from services.model_manager import call_extraction, call_with_fallback

router = APIRouter(prefix="/api/ai", tags=["ai"])

# --- Security & Defensive Constants ---
ALLOWED_IMAGE_DOMAINS = ["*"] # Effectively allow all, but safe_download_image still checks IP
MAX_IMAGE_SIZE = 20 * 1024 * 1024  # 20MB
ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/tiff", "application/pdf"] # Added TIFF/PDF support

async def safe_download_image(url: str) -> tuple[bytes, str]:
    """
    Safely download image with SSRF protection and granular timeouts.
    Returns (bytes, mime_type).
    """
    # 1. SSRF Check (Improved to allow most domains while blocking local network)
    from urllib.parse import urlparse
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    
    # Simple block list for internal network patterns
    forbidden_patterns = ["192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "localhost", "127.0.0.1"]
    
    # Exceptions for local dev
    if domain in ["localhost", "127.0.0.1"]:
        pass 
    elif any(p in domain for p in forbidden_patterns):
        print(f"⚠️ [SSRF Block] Blocked attempt to fetch from: {domain}")
        raise HTTPException(status_code=400, detail="Forbidden image source domain (internal network)")

    # 2. Granular Timeouts
    timeout = httpx.Timeout(5.0, connect=5.0, read=20.0, write=10.0, pool=5.0)
    
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            # First check size with HEAD if possible
            # head = await client.head(url)
            # if int(head.headers.get("Content-Length", 0)) > MAX_IMAGE_SIZE:
            #     raise HTTPException(status_code=400, detail="Image too large (>5MB)")
            
            response = await client.get(url)
            response.raise_for_status()
            
            # 3. Post-download Validation
            content_type = response.headers.get("Content-Type", "").lower()
            if not any(m in content_type for m in ALLOWED_MIME_TYPES) and not url.lower().endswith(('.heic', '.heif')):
                # Some servers might not return correct HEIC mime
                if not content_type: content_type = "image/jpeg" # Fallback guess
                else: raise HTTPException(status_code=400, detail=f"Unsupported format: {content_type}")
            
            data = response.content
            if len(data) > MAX_IMAGE_SIZE:
                 raise HTTPException(status_code=400, detail="Image too large (>5MB)")
            
            return data, content_type
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Image download timeout")
    except Exception as e:
        print(f"❌ [SafeDownload] Failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")

def convert_heic_to_jpeg(data: bytes) -> bytes:
    """Fallback: Convert HEIC/HEIF to JPEG using Pillow."""
    try:
        img = Image.open(io.BytesIO(data))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=90)
        return out.getvalue()
    except Exception as e:
        print(f"⚠️ [HEIC Fallback] Conversion failed: {e}")
        return data # Return original if conversion fails

@router.post("/parse-receipt")
@limiter.limit("5/minute")
async def parse_receipt(
    request: Request,
    body: ReceiptRequest,
    api_key: str = Depends(get_gemini_key)
):
    """[Receipt] AI Receipt Extraction with SSRF Protection & HEIC Fallback"""
    try:
        # 🆕 Enhanced Prompt (V23.1)
        prompt = """Extract receipt data as JSON. 
        CRITICAL: Translate all 'translated_name' fields into Traditional Chinese (繁體中文). 
        Maintain the 'original_name' exactly as printed on the receipt.

        Do NOT hallucinate data. If the image is unclear or not a receipt, 
        return status="warning" in the diagnostics field and set all amounts to 0.0.
        
        CRITICAL: Numbers like credit card last 4 digits (e.g., '1106'), phone numbers, or transaction IDs must NEVER be used as financial amounts.
        Only extract numbers that represent actual prices, taxes, totals, or explicitly labeled discounts/coupons.
        
        Nomenclature/Structure: 
        {
          "title": "Store Name",
          "expense_date": "YYYY-MM-DD",
          "currency": "JPY/TWD/etc",
          "subtotal_amount": 0.0,  # Sum of individual item amounts EXCLUDING the tax/discount items.
          "tax_amount": 0.0,       # ALWAYS set to 0.0 if including Tax as a line item.
          "tip_amount": 0.0,
          "service_charge_amount": 0.0,
          "discount_amount": 0.0,  # ALWAYS set to 0.0 if including Discount as a line item.
          "total_amount": 0.0,     # Final amount paid. Should equal sum of all amounts in "items".
          "items": [
            {"original_name": "...", "translated_name": "...", "amount": 0.0}
            # SPECIAL: Include Tax and Discount as items here. 
            # Examples: {"original_name": "TAX", "translated_name": "[稅額]", "amount": 203.0}
            # Examples: {"original_name": "DISCOUNT", "translated_name": "[折扣]", "amount": -1296.0} (use negative for discounts)
          ],
          "notes": "...",
          "diagnostics": {"status": "pass/warning", "message": "..."}
        }
        IMPORTANT: No 'details' field allowed. Use only 'items'.
        CRITICAL: If you include Tax or Discount in 'items', do NOT include them in 'tax_amount' or 'discount_amount' root fields.
        CRITICAL: Output numbers as digits ONLY. NO commas or currency symbols in any 'amount' fields.
        """
        
        parts = [prompt]
        mime_type = body.mime_type or "image/jpeg"
        image_bytes = None

        # 1. Source Determination
        if body.image:
            # Base64 path
            img_data = body.image.split(",")[1] if "," in body.image else body.image
            image_bytes = base64.b64decode(img_data)
        elif body.imageUrl:
            # Remote URL path (Safe Download)
            image_bytes, mime_type = await safe_download_image(body.imageUrl)
        else:
            raise HTTPException(status_code=400, detail="Missing source")

        # 2. HEIC Handling & Extraction Attempt
        is_heic = "heic" in mime_type or "heif" in mime_type
        
        try:
            current_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            raw_text = await call_extraction(api_key, parts + [current_part], intent_type="EXTRACTION")
        except Exception as e:
            # Fallback for HEIC if first attempt fails
            if is_heic:
                print("🔄 [HEIC Fallback] Retrying with JPEG conversion...")
                jpeg_bytes = convert_heic_to_jpeg(image_bytes)
                current_part = types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")
                raw_text = await call_extraction(api_key, parts + [current_part], intent_type="EXTRACTION")
            else:
                raise e

        # 3. Processing & Normalization
        data = json.loads(raw_text)
        
        # Breakdown normalization
        breakdowns = ["subtotal_amount", "tax_amount", "tip_amount", "service_charge_amount", "discount_amount"]
        for b in breakdowns:
            if b not in data or data[b] is None:
                data[b] = 0.0
        
        if "details" in data:
            if not data.get("items"):
                data["items"] = data["details"]
            del data["details"]
            
        # Items normalization
        for item in data.get("items", []):
            if "original_name" not in item: item["original_name"] = "Unknown"
            if "translated_name" not in item: item["translated_name"] = item.get("original_name", "")
            if "amount" not in item: item["amount"] = 0.0

        # V23.2 Defensive: If Tax/Discount is in items, root fields MUST be 0
        has_tax_item = any("[稅額]" in str(i.get("translated_name", "")) or "[Tax]" in str(i.get("translated_name", "")) for i in data.get("items", []))
        has_discount_item = any("[折扣]" in str(i.get("translated_name", "")) or "[Discount]" in str(i.get("translated_name", "")) for i in data.get("items", []))
        
        if has_tax_item: data["tax_amount"] = 0.0
        if has_discount_item: data["discount_amount"] = 0.0

        # V23.1 Diagnostic Logic (Threshold: >= 50 JPY OR > 3%)
        items_sum = sum(float(i.get("amount", 0.0)) for i in data.get("items", []))
        total = data.get("total_amount", 0.0)
        mismatch = abs(items_sum - total)
        ratio = mismatch / total if total > 0 else 0
        
        status = data.get("diagnostics", {}).get("status", "pass") # Respect AI's warning
        code = ""
        message = ""
        
        if total > 0 and (mismatch >= 49.99 or ratio > 0.03):
            status = "warning"
            code = "amount_mismatch"
            message = f"Mismatch: Items sum ({items_sum:.1f}) != Total ({total:.1f})"
            print(f"[Diagnostics] {message}")
            
        data["diagnostics"] = {
            "status": status,
            "source": "ai",
            "code": code,
            "message": message or data.get("diagnostics", {}).get("message", ""),
            "mismatch_amount": round(mismatch, 2)
        }
        
        return data

    except Exception as e:
        # NOTE: Using English-only error messages as a temporary workaround for
        # Pyre2/Ruff Unicode boundary crashes on Windows during static analysis.
        print(f"[Error] parse_receipt: {e}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/actuary")
@limiter.limit("10/minute")
async def actuary_chat(
    request: Request,
    body: ActuaryRequest,
    api_key: str = Depends(get_gemini_key)
):
    try:
        prompt = f"Analyze travel expenses for {json.dumps(body.members)}. Query: {body.message}"
        result = await call_with_fallback(api_key=api_key, history=[], message=prompt, intent_type="PLANNING")
        return {"response": result["text"]}
    except Exception as e:
        print(f"[Error] actuary_chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))
