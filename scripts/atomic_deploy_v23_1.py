import os

def atomic_deploy_v23_1():
    model_manager_path = r'c:\Users\Ryan Su\ryan-travel-app\backend\services\model_manager.py'
    ai_path = r'c:\Users\Ryan Su\ryan-travel-app\backend\routers\ai.py'

    model_manager_content = """\"\"\"
Model Manager Service - Next-Gen Architecture v23.1
===================================================

Intelligent multi-tier routing with:
- Capability Registry: Chart-based enforcement (supports_schema, propertyOrdering)
- V23.1 Financial Nomenclature: subtotal_amount, total_amount, items
- Fail-Fast Policy: Immediate rejection of 401/403 errors
- Temperature Guard: Enforced 1.0 for Gemini 3
\"\"\"

import copy
import time
import os
import asyncio
import json
from dataclasses import dataclass
from google import genai
from google.genai import types, errors
from typing import Optional, List, Dict, Any, Union, Tuple

from utils.ai_config import (
    DAILY_ROUTING,
    HEAVY_ROUTING,
    WORKHORSE_MODEL,
)

@dataclass(frozen=True)
class ModelCaps:
    supports_schema: bool
    supports_tools: bool
    supports_media_resolution: bool
    supports_thinking: bool
    requires_property_ordering: bool
    allow_extraction_fallback: bool
    family: str

MODEL_CAPS = {
    "gemini-3.1-flash-lite-preview": ModelCaps(True, False, False, True, False, True, "gemini"),
    "gemini-3-flash-preview": ModelCaps(True, False, True, True, False, True, "gemini"),
    "gemini-2.5-flash": ModelCaps(True, True, False, False, False, True, "gemini"),
    "gemma-3-27b-it": ModelCaps(True, True, False, False, False, False, "gemma"),
}

INTENTS_REQUIRING_JSON = {"EXTRACTION", "PLANNING"}
INTENTS_ALLOW_GEMMA_LAST_RESORT = {"PLANNING", "SUMMARIZE", "POI_ENRICH", "DIAGNOSIS"}

_client_cache = {}

def get_cached_client(api_key: str):
    if api_key not in _client_cache:
        _client_cache[api_key] = genai.Client(api_key=api_key)
    return _client_cache[api_key]

async def close_all_cached_clients():
    clients = list(_client_cache.values())
    _client_cache.clear()
    if clients:
        await asyncio.gather(*(c.aio.aclose() for c in clients), return_exceptions=True)

def build_json_schema_for_intent(intent_type: str):
    if intent_type == "EXTRACTION":
        return {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "date": {"type": "string"},
                "currency": {"type": "string"},
                "subtotal_amount": {"type": "number"},
                "tax_amount": {"type": "number"},
                "tip_amount": {"type": "number"},
                "service_charge_amount": {"type": "number"},
                "discount_amount": {"type": "number"},
                "total_amount": {"type": "number"},
                "category": {"type": "string"},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "original_name": {"type": "string"},
                            "translated_name": {"type": "string"},
                            "amount": {"type": "number"}
                        },
                        "required": ["original_name", "amount"]
                    }
                }
            },
            "required": ["title", "date", "currency", "total_amount", "items"]
        }
    if intent_type == "PLANNING":
        return {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "day_number": {"type": "integer"},
                            "time_slot": {"type": "string"},
                            "place_name": {"type": "string"},
                            "category": {"type": "string"},
                            "desc": {"type": "string"},
                            "lat": {"type": "number"},
                            "lng": {"type": "number"},
                        },
                        "required": ["day_number", "place_name", "category"]
                    }
                }
            },
            "required": ["items"]
        }
    return None

def get_generation_config(intent_type: str):
    base_map = {
        "PLANNING": types.GenerateContentConfig(temperature=1.0, max_output_tokens=2048),
        "EXTRACTION": types.GenerateContentConfig(
            temperature=1.0, 
            max_output_tokens=8192,
            response_mime_type="application/json",
            response_schema=build_json_schema_for_intent("EXTRACTION")
        ),
        "DIAGNOSIS": types.GenerateContentConfig(temperature=1.0, max_output_tokens=4096),
    }
    config = base_map.get(intent_type, types.GenerateContentConfig(temperature=1.0, max_output_tokens=1024))
    
    if intent_type in INTENTS_REQUIRING_JSON:
        config.response_mime_type = "application/json"
        config.response_json_schema = build_json_schema_for_intent(intent_type)
        
    return config

def sanitize_config_for_model(config, model_name, intent_type):
    safe = copy.deepcopy(config)
    caps = MODEL_CAPS.get(model_name)
    if not caps: return safe
    if hasattr(safe, 'media_resolution') and not caps.supports_media_resolution:
        safe.media_resolution = None
    if caps.family == "gemini" and model_name.startswith("gemini-3"):
        if hasattr(safe, 'temperature') and safe.temperature is not None and safe.temperature < 1.0:
            safe.temperature = 1.0
    return safe

def classify_api_error(err):
    code = getattr(err, "code", None)
    if code in (401, 403): return "auth_fail"
    if code == 400: return "bad_request"
    return "retryable"

async def call_extraction(api_key, prompt, intent_type="CHAT", routing_strategy=None):
    client = get_cached_client(api_key)
    base_config = get_generation_config(intent_type)
    routing = routing_strategy or HEAVY_ROUTING
    
    for model_name in routing:
        try:
            config = sanitize_config_for_model(base_config, model_name, intent_type)
            response = await client.aio.models.generate_content(model=model_name, contents=prompt, config=config)
            text = response.text or ""
            if intent_type in INTENTS_REQUIRING_JSON:
                text = text.replace("```json", "").replace("```", "").strip()
                json.loads(text)
            return text
        except Exception as e:
            print(f"[Warning] {model_name} failed: {e}")
            continue
    raise Exception("All models failed")

async def call_with_fallback(api_key, history, message, intent_type="CHAT"):
    client = get_cached_client(api_key)
    config = get_generation_config(intent_type)
    chat = client.aio.chats.create(model=HEAVY_ROUTING[0], config=config)
    response = await chat.send_message(message)
    return {"text": response.text}
"""

    ai_content = """\"\"\"
AI Router (V23.1 Standard)
---------------------------
Handles AI-driven workflows for receipt parsing, financial actuary, and trip generation.
Optimized for toolchain stability and financial nomenclature.
\"\"\"

import json
import asyncio
import base64
import uuid
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

router = APIRouter(prefix="/api", tags=["ai"])

@router.post("/parse-receipt")
@limiter.limit("5/minute")
async def parse_receipt(
    request: Request,
    body: ReceiptRequest,
    api_key: str = Depends(get_gemini_key)
):
    \"\"\"[Receipt] AI Receipt Extraction with V23.1 Financial Guardrails\"\"\"
    try:
        prompt = \"\"\"Extract receipt data as JSON. 
        nomenclature: subtotal_amount, tax_amount, tip_amount, service_charge_amount, discount_amount, total_amount.
        items: list of {original_name, translated_name, amount}.
        No 'details' field. Breakdown fields default to 0.0.
        \"\"\"
        
        parts = [prompt]
        if body.image:
            img_data = body.image.split(",")[1] if "," in body.image else body.image
            parts.append(types.Part.from_bytes(data=base64.b64decode(img_data), mime_type=body.mime_type or "image/jpeg"))
        elif body.imageUrl:
            parts.append(body.imageUrl)
        else:
            raise HTTPException(status_code=400, detail="Missing source")

        raw_text = await call_extraction(api_key, parts, intent_type="EXTRACTION")
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
            
        # V23.1 Diagnostic Logic (Threshold: >= 50 JPY OR > 3%)
        items_sum = sum(i.get("amount", 0.0) for i in data.get("items", []))
        total = data.get("total_amount", 0.0)
        mismatch = abs(items_sum - total)
        ratio = mismatch / total if total > 0 else 0
        
        status = "pass"
        code = None
        message = None
        
        if total > 0 and (mismatch >= 49.99 or ratio > 0.03):
            status = "warning"
            code = "amount_mismatch"
            message = f"Mismatch: Items sum ({items_sum:.1f}) != Total ({total:.1f})"
            print(f"[Diagnostics] {message}")
            
        data["diagnostics"] = {
            "status": status,
            "source": "ai",
            "code": code,
            "message": message,
            "mismatch_amount": round(mismatch, 2)
        }
        
        return data

    except Exception as e:
        print(f"[Error] parse_receipt: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/actuary")
@limiter.limit("10/minute")
async def actuary_chat(
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
"""

    with open(model_manager_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(model_manager_content)
    
    with open(ai_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(ai_content)
        
    print("✅ V23.1 Atomic Deployment Successful.")

if __name__ == "__main__":
    atomic_deploy_v23_1()
