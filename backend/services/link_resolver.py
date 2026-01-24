import httpx
import re
import urllib.parse
from typing import Optional, Dict, Any

# Regex for coordinates in URLs
# Pattern A: @lat,lng
RE_COORD_A = re.compile(r'@(-?\d+\.\d+),(-?\d+\.\d+)')
# Pattern B: !3dlat!4dlng (Protobuf style)
RE_COORD_B = re.compile(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)')
# Pattern C: search?q=...
RE_QUERY = re.compile(r'[?&]q=([^&]+)')

async def resolve_google_maps_link(url: str) -> Dict[str, Any]:
    """
    Follows redirects and extracts location data from Google Maps URLs.
    Returns: { "lat": float, "lng": float, "query": str, "resolved_url": str, "method": str }
    """
    result = {
        "lat": None,
        "lng": None,
        "query": None,
        "resolved_url": url,
        "method": "none"
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
    # Try Pattern A (@lat,lng)
    match_a = RE_COORD_A.search(final_url)
    if match_a:
        result["lat"] = float(match_a.group(1))
        result["lng"] = float(match_a.group(2))
        result["method"] = f"{result['method']}+regex_a"
        return result

    # Try Pattern B (!3d/!4d)
    match_b = RE_COORD_B.search(final_url)
    if match_b:
        result["lat"] = float(match_b.group(1))
        result["lng"] = float(match_b.group(2))
        result["method"] = f"{result['method']}+regex_b"
        return result

    # Step 3: Extract Search Query (Tier 3 Fallback)
    match_q = RE_QUERY.search(final_url)
    if match_q:
        query = urllib.parse.unquote(match_q.group(1))
        result["query"] = query
        result["method"] = f"{result['method']}+query"
        
    return result
