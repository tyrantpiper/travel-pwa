import httpx
import re
import urllib.parse
from bs4 import BeautifulSoup
from typing import Optional, Dict, Any

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
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
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
            
            if og_title: metadata["title"] = og_title.get("content")
            if og_image: metadata["image"] = og_image.get("content")
            if og_desc: metadata["description"] = og_desc.get("content")
            if og_site: metadata["site_name"] = og_site.get("content")
            
            # 2. Fallback to normal meta/title
            if not metadata["title"] and soup.title:
                metadata["title"] = soup.title.string
                
            if not metadata["description"]:
                desc = soup.find("meta", attrs={"name": "description"})
                if desc: metadata["description"] = desc.get("content")

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

    # Step 1: Follow redirects
    final_url = url
    if any(domain in url for domain in ["goo.gl", "maps.app.goo.gl"]):
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
                resp = await client.get(url)
                final_url = str(resp.url)
                result["resolved_url"] = final_url
                result["method"] = "redirect"
        except Exception as e:
            print(f"⚠️ Redirect resolution failed: {e}")
            return result

    # Step 2: Extract coordinates via Regex (Tier 1 & 2)
    match_a = RE_COORD_A.search(final_url)
    if match_a:
        result["lat"] = float(match_a.group(1))
        result["lng"] = float(match_a.group(2))
        result["method"] = f"{result['method']}+regex_a"
    else:
        match_b = RE_COORD_B.search(final_url)
        if match_b:
            result["lat"] = float(match_b.group(1))
            result["lng"] = float(match_b.group(2))
            result["method"] = f"{result['method']}+regex_b"

    # Step 3: Extract Search Query (Tier 3 Fallback)
    match_q = RE_QUERY.search(final_url)
    if match_q:
        try:
            query = urllib.parse.unquote(match_q.group(1))
            result["query"] = query
            result["method"] = f"{result['method']}+query"
        except Exception:
            pass

    # Step 4: Fetch Metadata (Visuals)
    result["metadata"] = await fetch_og_metadata(final_url)
    
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
