import httpx
import re
import os
import urllib.parse
from bs4 import BeautifulSoup
from typing import Dict, Any

# 🆕 v35.26: Anti-Acidosis Protocol - Smart Redirect Tracer
try:
    from backend.utils.smart_redirect_tracer import get_smart_tracer
    from backend.utils.molecular_parser import get_molecular_parser
except ImportError:
    # Fallback for when running from backend/ directory
    from utils.smart_redirect_tracer import get_smart_tracer
    from utils.molecular_parser import get_molecular_parser

# Regex for coordinates in URLs
# Pattern A: @lat,lng
RE_COORD_A = re.compile(r'@(-?\d+\.\d+),(-?\d+\.\d+)')
# Pattern B: !3dlat!4dlng (Protobuf style)
RE_COORD_B = re.compile(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)')
# Pattern C: search?q=... or ?query=...
RE_QUERY = re.compile(r'[?&](?:q|query|place_name)=([^&]+)')

async def fetch_og_metadata(url: str) -> Dict[str, Any]:
    """
    Scrapes Open Graph metadata from a URL.
    """
    metadata = {
        "title": None,
        "image": None,
        "description": None,
        "site_name": None
    }
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
        }
        async with httpx.AsyncClient(follow_redirects=True, timeout=5.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return metadata
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # 1. 提取 OG 標籤
            og_title = soup.find("meta", property="og:title")
            og_image = soup.find("meta", property="og:image")
            og_desc = soup.find("meta", property="og:description")
            og_site = soup.find("meta", property="og:site_name")
            
            if og_title:
                metadata["title"] = og_title.get("content")
            if og_image:
                metadata["image"] = og_image.get("content")
            if og_desc:
                metadata["description"] = og_desc.get("content")
            if og_site:
                metadata["site_name"] = og_site.get("content")

            # 2. 額外標籤支援 (twitter, thumbnail, itemprop)
            if not metadata["image"]:
                for tag in ["twitter:image", "image_src", "thumbnail"]:
                    found = soup.find("meta", attrs={"name": tag}) or soup.find("link", attrs={"rel": tag})
                    if found:
                        metadata["image"] = found.get("content") or found.get("href")
                        break
            
            if not metadata["image"]:
                itemprop_image = soup.find("meta", itemprop="image")
                if itemprop_image:
                    metadata["image"] = itemprop_image.get("content")

            # 3. Engine 2 - 深度獵捕 (Deep Scraper Regex Probe)
            if not metadata["image"] and "google.com/maps" in url:
                # 搜尋埋藏在 JS 中的高畫質圖片模式
                lh_matches = re.findall(r'https://lh\d\.googleusercontent\.com/p/[^\\"]+=w\d+-h\d+', resp.text)
                if lh_matches:
                    best_match = lh_matches[0]
                    # 重寫為 1000x800 高清格式
                    metadata["image"] = re.sub(r'=w\d+-h\d+', '=w1000-h800-k-no', best_match)
                    print(f"🎯 DeepScraper: Found photo buried in JS: {metadata['image']}")

            # 4. URL 正規化與過濾 (Protocol-relative & Generic Icon)
            if metadata["image"]:
                if metadata["image"].startswith("//"):
                    metadata["image"] = "https:" + metadata["image"]
                
                if any(icon in metadata["image"] for icon in ["maps_512dp.png", "maps_icon_60.png"]):
                    print(f"🚫 Filtering generic Google Maps logo: {metadata['image']}")
                    metadata["image"] = None
            
            # 5. 回退機制 - Title & Description
            if not metadata["title"] and soup.title:
                metadata["title"] = soup.title.string
                
            if not metadata["description"]:
                desc = soup.find("meta", attrs={"name": "description"})
                if desc:
                    metadata["description"] = desc.get("content")

    except Exception as e:
        print(f"⚠️ Metadata fetch failed for {url}: {e}")
        
    return metadata

async def resolve_google_maps_link(url: str) -> Dict[str, Any]:
    """
    Follows redirects and extracts location data + visuals from Google Maps URLs.
    """
    result = {
        "lat": None,
        "lng": None,
        "query": None,
        "resolved_url": url,
        "method": "none",
        "metadata": {}
    }

    # 🆕 v35.26: Anti-Acidosis Protocol - Use SmartRedirectTracer
    final_url = url
    smart_tracer = get_smart_tracer()
    
    # 🛡️ Step 0: Sanitization (針對 iOS 分享連結進行淨化)
    # 目的：移除 g_st 等參數以強制 Google 回傳帶座標的 Desktop 版 URL
    if any(domain in url for domain in ["goo.gl", "maps.app.goo.gl"]):
        # 移除 g_st (share type), si, utm 等追蹤參數
        url = re.sub(r'([?&])(g_st|si|utm_\w+)=[^&]+', '', url)
        # 清理可能殘留的問號或 &
        url = url.rstrip("?&")
        # log_debug or standard print for tracer traceability is currently used here
        # Keeping it consistent with the existing file's debug style
    
    # 🕵️ Step 0.5: Aggressive Text-to-URL Extraction (Defense in Depth)
    if url and ('\n' in url or ' ' in url):
        clean_match = re.search(r'(https?://[^\s]+)', url)
        if clean_match:
            # Using silence for production clean url extraction
            url = clean_match.group(1)
    
    try:
        # Step 1: Smart Trace with precision analysis
        if any(domain in url for domain in ["goo.gl", "maps.app.goo.gl"]):
            trace_result = await smart_tracer.trace_full_chain_smart(url)
            
            if trace_result.get('lat') and trace_result.get('lng'):
                # Use traced coords with precision guarantee
                result["lat"] = trace_result["lat"]
                result["lng"] = trace_result["lng"]
                result["method"] = f"smart_tracer+{trace_result.get('method', 'unknown')}"
                result["resolved_url"] = trace_result.get("final_url", url)
                final_url = trace_result.get("final_url", url)
                print(f"✅ SmartTracer: ({result['lat']}, {result['lng']}) precision={trace_result.get('precision', 'N/A')}")
            else:
                # SmartTracer found no coords in chain, try final URL parsing
                final_url = trace_result.get("final_url", url)
                result["resolved_url"] = final_url
                
                # Use MolecularParser as fallback
                parser = get_molecular_parser()
                parsed = parser.parse_url(final_url)
                if parsed:
                    result["lat"] = parsed["lat"]
                    result["lng"] = parsed["lng"]
                    result["method"] = f"molecular+{parsed.get('method', 'unknown')}"
                    print(f"✅ MolecularParser: ({result['lat']}, {result['lng']})")
        else:
            # Non-short URL: Direct parsing with MolecularParser
            parser = get_molecular_parser()
            parsed = parser.parse_url(url)
            if parsed:
                result["lat"] = parsed["lat"]
                result["lng"] = parsed["lng"]
                result["method"] = f"molecular+{parsed.get('method', 'unknown')}"
            final_url = url
    
    except Exception as e:
        # 🛡️ Graceful fallback: Use legacy logic if new tracer fails
        print(f"⚠️ SmartTracer/MolecularParser failed, falling back to legacy: {e}")
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
                resp = await client.get(url)
                final_url = str(resp.url)
                result["resolved_url"] = final_url
                result["method"] = "legacy_redirect"
        except Exception as legacy_e:
            print(f"⚠️ Legacy fallback also failed: {legacy_e}")
            return result
        
        # Legacy regex extraction
        processed_url = urllib.parse.unquote(urllib.parse.unquote(final_url)).replace('%21', '!')
        lat_match = re.search(r'!3d(-?\d+\.\d+)', processed_url)
        lng_match = re.search(r'!4d(-?\d+\.\d+)', processed_url)
        
        if lat_match and lng_match:
            result["lat"] = float(lat_match.group(1))
            result["lng"] = float(lng_match.group(1))
            result["method"] = f"{result['method']}+legacy_regex"
        else:
            match_a = RE_COORD_A.search(processed_url)
            if match_a:
                result["lat"] = float(match_a.group(1))
                result["lng"] = float(match_a.group(2))
                result["method"] = f"{result['method']}+legacy_regex_a"

    # Step 3: Extract Search Query (Tier 3 Fallback)
    match_q = RE_QUERY.search(final_url)
    if match_q:
        try:
            query = urllib.parse.unquote(match_q.group(1))
            result["query"] = query
            result["method"] = f"{result['method']}+query"
        except Exception:
            pass

    # 🕵️ Step 3.5: HTML Deep Mining (最後一道防線)
    # 只有當 (1) 沒座標 (2) 是 Google Maps 連結 時才啟動
    if not result["lat"] and result.get("resolved_url") and "google.com/maps" in result["resolved_url"]:
        try:
            print(f"🕵️ [DeepMine] 啟動 HTML 深度搜查: {result['resolved_url']}")
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
            }
            async with httpx.AsyncClient(follow_redirects=True, timeout=5.0) as client:
                resp = await client.get(result['resolved_url'], headers=headers)
                if resp.status_code == 200:
                    body_text = resp.text
                    # 🛡️ v35.70: Target structured Protobuf state instead of generic float arrays
                    # Pattern: window.APP_INITIALIZATION_STATE=[[[lat, lng, ...]]]
                    init_match = re.search(r'window\.APP_INITIALIZATION_STATE=\[\[\[(-?\d+\.\d+),(-?\d+\.\d+)', body_text)
                    if init_match:
                        lat_f, lng_f = float(init_match.group(2)), float(init_match.group(1)) # Swapped in proto!
                        # Reverse check: Google often lists Lng first in these internal arrays
                        if not (20.0 <= lat_f <= 50.0 and 120.0 <= lng_f <= 155.0):
                            # Try other way
                            lat_f, lng_f = float(init_match.group(1)), float(init_match.group(2))
                        
                        if 20.0 <= lat_f <= 50.0 and 120.0 <= lng_f <= 155.0:
                            result["lat"] = lat_f
                            result["lng"] = lng_f
                            result["method"] = f"{result['method']}+proto_mining"
                            print(f"✅ [ProtoMine] Extracted precision from state: ({lat_f}, {lng_f})")
                        
                    # Fallback to generic array mining ONLY if still no lat
                    if not result["lat"]:
                        candidates = re.findall(r'\[\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*\]', body_text)
                        for lat_str, lng_str in candidates:
                            lat_f, lng_f = float(lat_str), float(lng_str)
                            # Tighten bounds: ONLY accept if it looks like Japan (avoid trans-continental swaps)
                            if 30.0 <= lat_f <= 46.0 and 128.0 <= lng_f <= 146.0:
                                result["lat"] = lat_f
                                result["lng"] = lng_f
                                result["method"] = f"{result['method']}+html_mining_sanitized"
                                break
        except Exception as e:
            # 異常吞噬：失敗則跳過，確保不影響後續視覺抓取
            print(f"⚠️ [DeepMine] HTML 搜查略過: {e}")

    # Step 4: Fetch Metadata (Visuals)
    result["metadata"] = await fetch_og_metadata(final_url)
    
    # 🛡️ [Region Guard] Safety First Protocol
    # v35.70: Categorical check to prevent IP-localized "drift" (Zero-Regression)
    if result.get("lat") and result.get("lng"):
        # Check if the coordinates are consistent with the metadata (e.g., Japan vs. others)
        metadata_text = f"{result['metadata'].get('title', '')} {result['metadata'].get('description', '')}".lower()
        
        # Japan Safety Check (Primary target region)
        is_japan_meta = any(token in metadata_text for token in ["japan", "tokyo", "osaka", "kyoto", "hokkaido", "airport", " hotel", "日本", "東京"])
        is_japan_geo = 20.0 <= result["lat"] <= 50.0 and 120.0 <= result["lng"] <= 155.0
        
        if is_japan_meta and not is_japan_geo:
            print(f"🚨 [RegionGuard] Geo-Drift detected! Meta indicates Japan but coords are at ({result['lat']}, {result['lng']}). PURGING COORDS.")
            result["lat"] = None
            result["lng"] = None
            result["method"] = f"{result.get('method', 'unknown')}+drift_purged"
        
    # Phase 2: The "DNA" Upgrade (Place ID / CID Extraction)
    # 使用 Side-car 方法提取正式 ID，而不干擾原本的座標邏輯
    try:
        parser = get_molecular_parser()
        ids = parser.extract_identifiers(final_url)
        if ids:
            result.update(ids)
    except Exception:
        pass
        
    # 📉 [Precision Auditor] Log failures for persistent optimization
    if not result.get("lat"):
        # Log to a persistent file for "carpet-bombing" optimization
        try:
            with open("semantic_fallback_audit.log", "a", encoding="utf-8") as audit_f:
                from datetime import datetime
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                audit_f.write(f"[{timestamp}] FAIL | URL: {final_url} | Metadata: {result.get('metadata', {}).get('title')} \n")
        except:
            pass

    # 🆕 v35.46: Engine 2 Fallback - ArcGIS Static Map Snapshot
    # If no real photo found, generate a static map preview if coords exist
    if not result["metadata"].get("image") and result.get("lat") and result.get("lng"):
        arcgis_key = os.getenv("ARCGIS_API_KEY")
        if arcgis_key:
            # ArcGIS Static Map API
            # Size: 800x600, Zoom: 16 (Street Level), Style: World_Street_Map
            marker_str = f"{result['lng']},{result['lat']}"
            static_url = (
                f"https://static.arcgis.com/staticmap?"
                f"center={result['lng']},{result['lat']}&"
                f"zoom=16&size=800,600&"
                f"marker=color:red;{marker_str}&"
                f"token={arcgis_key}"
            )
            result["metadata"]["image"] = static_url
            print(f"🗺️ Engine 2 Fallback: Generated ArcGIS Static Map: {static_url[:60]}...")

    return result

async def resolve_generic_link(url: str) -> Dict[str, Any]:
    """
    Resolves non-map links (IG, Official Web, FB) to get visuals.
    """
    metadata = await fetch_og_metadata(url)
    return {
        "success": True,
        "metadata": metadata,
        "resolved_url": url
    }
