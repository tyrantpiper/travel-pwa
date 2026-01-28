# debug_url_extraction.py
import asyncio
import httpx
import re
from urllib.parse import unquote

async def main():
    url = "https://maps.app.goo.gl/MonZuXjVsjGTcChE6"
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        resp = await client.get(url)
        final_url = str(resp.url)
    
    print("=" * 80)
    print("FINAL URL (decoded):")
    decoded = unquote(unquote(final_url)).replace('%21', '!')
    print(decoded)
    print("=" * 80)
    
    # Extract all coordinate patterns
    print("\nCOORDINATE EXTRACTION:")
    
    # Pattern 1: @lat,lng
    at_matches = re.findall(r'@(-?\d+\.\d+),(-?\d+\.\d+)', decoded)
    print(f"  @lat,lng patterns: {at_matches}")
    
    # Pattern 2: !3d...!4d...
    d3d4_match = re.search(r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)', decoded)
    if d3d4_match:
        print(f"  !3d!4d pattern: lat={d3d4_match.group(1)}, lng={d3d4_match.group(2)}")
    else:
        print("  !3d!4d pattern: NOT FOUND")
    
    # Pattern 3: !2d...!3d... (reversed!)
    d2d3_match = re.search(r'!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)', decoded)
    if d2d3_match:
        print(f"  !2d!3d pattern (REVERSED): lng={d2d3_match.group(1)}, lat={d2d3_match.group(2)}")
    else:
        print("  !2d!3d pattern: NOT FOUND")
    
    print("\n" + "=" * 80)
    
    # For verification - extract the place name from URL
    place_match = re.search(r'/place/([^/@]+)', decoded)
    if place_match:
        print(f"PLACE NAME: {place_match.group(1)}")

asyncio.run(main())
