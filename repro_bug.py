import httpx
import re
import asyncio
import urllib.parse

RE_COORD_A = re.compile(r'@(-?\d+\.\d+),(-?\d+\.\d+)')
RE_COORD_B = re.compile(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)')
RE_QUERY = re.compile(r'[?&](?:q|query|place_name)=([^&]+)')

async def resolve_google_maps_link(url: str):
    result = {"lat": None, "lng": None, "query": None, "resolved_url": url, "method": "none"}
    final_url = url
    if any(domain in url for domain in ["goo.gl", "maps.app.goo.gl"]):
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(url)
            final_url = str(resp.url)
            result["resolved_url"] = final_url
            result["method"] = "redirect"

    # 🆕 UPDATED LOGIC: Check B before A
    match_b = RE_COORD_B.search(final_url)
    if match_b:
        result["lat"] = float(match_b.group(1))
        result["lng"] = float(match_b.group(2))
        result["method"] = f"{result['method']}+regex_b"
    else:
        match_a = RE_COORD_A.search(final_url)
        if match_a:
            result["lat"] = float(match_a.group(1))
            result["lng"] = float(match_a.group(2))
            result["method"] = f"{result['method']}+regex_a"
    
    match_q = RE_QUERY.search(final_url)
    if match_q:
        result["query"] = urllib.parse.unquote(match_q.group(1))
        
    return result

async def main():
    url = "https://maps.app.goo.gl/MonZuXjVsjGTcChE6"
    res = await resolve_google_maps_link(url)
    print(res)

asyncio.run(main())
