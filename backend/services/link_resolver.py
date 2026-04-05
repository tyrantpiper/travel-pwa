import httpx
import re
import os
import random
import time as _time
import urllib.parse
from bs4 import BeautifulSoup
from typing import Dict, Any
from datetime import datetime

from utils.url_safety import is_safe_url

# 🆕 v35.26: Anti-Acidosis Protocol - Smart Redirect Tracer
from utils.smart_redirect_tracer import get_smart_tracer
from utils.molecular_parser import get_molecular_parser

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🛰️ GAS Two-Shot Rescue Gateway (Failure-Only Fallback)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_GAS_RESOLVE_DEAD_CACHE: Dict[str, float] = {}

async def resolve_via_gas(short_url: str) -> Dict[str, Any] | None:
    """
    🛰️ GAS Rescue: 只在所有本地引擎失敗後才啟動。
    利用 GAS 的 google-apps-script User-Agent 繞過 Google 機器人偵測，
    取得本地 httpx 無法拿到的座標與地名。
    
    Two-Shot 策略：
      Shot 1: followRedirects=false → 攔截 Location Header 取座標
      Shot 2: followRedirects=true  → 抓 HTML <title> 取地名
    
    Returns:
        成功: {"lat": float, "lng": float, "title": str|None, ...}
        失敗: None
    """
    urls_str = os.getenv("GAS_RESOLVE_LINK_URLS", "")
    if not urls_str:
        return None
    
    urls = [u.strip() for u in urls_str.split(",") if u.strip()]
    if not urls:
        return None
    
    random.shuffle(urls)  # Load balancing
    now = _time.time()
    
    for gas_url in urls:
        # Dead URL cache (12h penalty)
        if gas_url in _GAS_RESOLVE_DEAD_CACHE and (now - _GAS_RESOLVE_DEAD_CACHE[gas_url] < 43200):
            continue
        
        try:
            # GAS Web Apps return 302 redirects → must follow them
            # 🛡️ 2026 Emergency: Disable SSL verify only in development for internal GAS rescue gateway
            should_verify_ssl = os.getenv("ENVIRONMENT") != "development"
            async with httpx.AsyncClient(follow_redirects=True, timeout=15.0, verify=should_verify_ssl) as client:
                res = await client.get(gas_url, params={"url": short_url})
            res.raise_for_status()
            data = res.json()
            
            if data and data.get("success") and data.get("lat"):
                print(f"[GAS Rescue] OK ({data['lat']}, {data['lng']}) title={data.get('title')}")
                return {
                    "lat": float(data["lat"]),
                    "lng": float(data["lng"]),
                    "title": data.get("title"),
                    "titleReliable": data.get("titleReliable", False),
                    "longUrl": data.get("longUrl", short_url),
                    "method": "gas_rescue"
                }
            elif data and "quota" in str(data.get("error", "")).lower():
                print(f"[GAS Rescue] Quota exceeded. Banning URL for 12 hours.")
                _GAS_RESOLVE_DEAD_CACHE[gas_url] = now
        except Exception as e:
            print(f"[GAS Rescue] Request failed: {e}")
            continue
    
    return None


# Regex for coordinates in URLs
# Pattern A: @lat,lng
RE_COORD_A = re.compile(r'@(-?\d+\.\d+),(-?\d+\.\d+)')
# Pattern B: !3dlat!4dlng (Protobuf style)
RE_COORD_B = re.compile(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)')
# Pattern C: search?q=... or ?query=...
RE_QUERY = re.compile(r'[?&](?:q|query|place_name)=([^&]+)')
# Pattern D: /place/NAME/... or /search/NAME/... (Modern Google Maps Path Style)
RE_PLACE_PATH = re.compile(r'/place/([^/@]+)')
RE_SEARCH_PATH = re.compile(r'/search/([^/?&]+)')

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
            # 🛡️ SSRF Check
            if not is_safe_url(url):
                 print(f"[SSRF Block] Metadata fetch aborted for unsafe URL: {url}")
                 return metadata

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
                    print(f"[DeepScraper] Found photo buried in JS: {metadata['image']}")

            # 4. URL 正規化與過濾 (Protocol-relative & Generic Icon)
            if metadata["image"]:
                if metadata["image"].startswith("//"):
                    metadata["image"] = "https:" + metadata["image"]
                
                if any(icon in metadata["image"] for icon in ["maps_512dp.png", "maps_icon_60.png"]):
                    print(f"[Filter] Generic Google Maps logo skipped: {metadata['image']}")
                    metadata["image"] = None
            
            # 5. 回退機制 - Title & Description
            if not metadata["title"] and soup.title:
                metadata["title"] = soup.title.string
                
            if not metadata["description"]:
                desc = soup.find("meta", attrs={"name": "description"})
                if desc:
                    metadata["description"] = desc.get("content")

    except Exception as e:
        print(f"[WARN] Metadata fetch failed for {url}: {e}")
        
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
    original_input_url = url
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
            # 🛡️ SSRF Check before tracing
            if not is_safe_url(url):
                print(f"[SSRF Block] SmartTrace aborted for unsafe URL: {url}")
                return result

            trace_result = await smart_tracer.trace_full_chain_smart(url)
            
            if trace_result.get('lat') and trace_result.get('lng'):
                # Use traced coords with precision guarantee
                result["lat"] = trace_result["lat"]
                result["lng"] = trace_result["lng"]
                result["method"] = f"smart_tracer+{trace_result.get('method', 'unknown')}"
                result["resolved_url"] = trace_result.get("final_url", url)
                final_url = trace_result.get("final_url", url)
                
                # 🛡️ v35.84: Capture name from tracer DNA
                if trace_result.get("place_name") and not result.get("query"):
                    result["query"] = trace_result["place_name"]
                
                print(f"[SmartTracer] OK ({result['lat']}, {result['lng']}) precision={trace_result.get('precision', 'N/A')}")
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
                    print(f"[MolecularParser] OK ({result['lat']}, {result['lng']})")
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
        print(f"[WARN] SmartTracer/MolecularParser failed, fallback to legacy: {e}")
        try:
            # 🛡️ SSRF Check
            if not is_safe_url(url):
                print(f"[SSRF Block] Legacy redirect aborted for unsafe URL: {url}")
                return result

            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
                resp = await client.get(url)
                final_url = str(resp.url)
                result["resolved_url"] = final_url
                result["method"] = "legacy_redirect"
        except Exception as legacy_e:
            print(f"[WARN] Legacy fallback failed: {legacy_e}")
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
            print(f"[DeepMine] Starting HTML search: {result['resolved_url']}")
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
            }
            async with httpx.AsyncClient(follow_redirects=True, timeout=5.0) as client:
                # 🛡️ SSRF Check
                if not is_safe_url(result['resolved_url']):
                    print(f"[SSRF Block] DeepMine aborted for unsafe URL: {result['resolved_url']}")
                    return result

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
                            print(f"[ProtoMine] Extracted precision: ({lat_f}, {lng_f})")
                        
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
            print(f"[DeepMine] HTML Search skipped: {e}")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 🆕 Step 3.7: GAS Two-Shot Rescue (Failure-Only Gateway)
    # 條件: (1) 所有本地引擎失敗 (2) 原始輸入是短網址
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if not result["lat"] and any(d in original_input_url for d in ["goo.gl", "maps.app.goo.gl"]):
        try:
            gas_input = original_input_url  # 使用原始短網址呼叫 GAS 效果最好
            print(f"[GAS Rescue] Local engines failed, invoking GAS for original URL: {gas_input[:60]}...")
            
            gas_result = await resolve_via_gas(gas_input)
            
            if gas_result and gas_result.get("lat"):
                result["lat"] = gas_result["lat"]
                result["lng"] = gas_result["lng"]
                result["method"] = f"{result.get('method', 'none')}+gas_rescue"
                
                # 更新 final_url 以利後續 Metadata 取得更好結果
                if gas_result.get("longUrl") and gas_result["longUrl"] != gas_input:
                    final_url = gas_result["longUrl"]
                    result["resolved_url"] = final_url
                
                # 地名注入（僅在可靠時）
                if gas_result.get("title") and gas_result.get("titleReliable"):
                    result["query"] = gas_result["title"]
                    
                print(f"[GAS Rescue] Success: ({result['lat']}, {result['lng']})")
            else:
                print(f"[GAS Rescue] GAS could not resolve this link.")
        except Exception as gas_e:
            print(f"[GAS Rescue] Exception: {gas_e}")

    # Step 4: Fetch Metadata (Visuals)
    result["metadata"] = await fetch_og_metadata(final_url)
    
    # 🕵️ v35.84: DNA-Level Name Recovery (Full Cascade)
    # If title is generic "Google Maps" or missing, use a priority chain to recover the real name
    current_title = result["metadata"].get("title", "")
    is_generic = any(g in current_title.lower() for g in ["google maps", "google 地圖", "google地圖", "google マップ"]) or not current_title
    
    if is_generic:
        recovered_name = None
        
        # Priority 1: Query already extracted from ?q= (Line 294)
        if result.get("query"):
            recovered_name = result["query"]
            print(f"[DNA-Recovery] P1 (Query): {recovered_name}")
            
        # Priority 2: Extract from /place/ NAME /...
        if not recovered_name:
            place_match = RE_PLACE_PATH.search(final_url)
            if place_match:
                try:
                    recovered_name = urllib.parse.unquote(place_match.group(1)).replace("+", " ")
                    print(f"[DNA-Recovery] P2 (Place Path): {recovered_name}")
                except: pass
                
        # Priority 3: Extract from /search/ NAME /...
        if not recovered_name:
            search_match = RE_SEARCH_PATH.search(final_url)
            if search_match:
                try:
                    recovered_name = urllib.parse.unquote(search_match.group(1)).replace("+", " ")
                    print(f"[DNA-Recovery] P3 (Search Path): {recovered_name}")
                except: pass

        if recovered_name:
            result["query"] = recovered_name
            result["metadata"]["title"] = recovered_name
            is_generic = False # Successfully recovered
            
    # 🆕 GAS Title Backfill: Only if still generic/missing
    if is_generic and result.get("query") and "gas_rescue" in result.get("method", ""):
        result["metadata"]["title"] = result["query"]
        print(f"[GAS Title] Backfill: {result['query']}")
    
    # 🛡️ [Region Guard] Safety First Protocol
    # v35.70: Categorical check to prevent IP-localized "drift" (Zero-Regression)
    if result.get("lat") and result.get("lng"):
        # Check if the coordinates are consistent with the metadata (e.g., Japan vs. others)
        metadata_text = f"{result['metadata'].get('title', '')} {result['metadata'].get('description', '')}".lower()
        
        # Japan Safety Check (Primary target region)
        is_japan_meta = any(token in metadata_text for token in ["japan", "tokyo", "osaka", "kyoto", "hokkaido", "airport", " hotel", "日本", "東京"])
        is_japan_geo = 20.0 <= result["lat"] <= 50.0 and 120.0 <= result["lng"] <= 155.0
        
        if is_japan_meta and not is_japan_geo:
            print(f"[RegionGuard] Geo-Drift detected! Meta indicates Japan but coords are at ({result['lat']}, {result['lng']}). PURGING COORDS.")
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
            print(f"[ArcGIS] Engine 2 Fallback: Generated static map: {static_url[:60]}...")

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
