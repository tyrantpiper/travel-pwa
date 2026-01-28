# debug_full_url_dump.py - Show the COMPLETE URL
import asyncio
import httpx
import re
from urllib.parse import unquote

async def main():
    url = "https://maps.app.goo.gl/MonZuXjVsjGTcChE6"
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        resp = await client.get(url)
        final_url = str(resp.url)
    
    decoded = unquote(unquote(final_url)).replace('%21', '!')
    
    # Print the FULL decoded URL in chunks
    print("=" * 80)
    print("FULL DECODED URL:")
    print("=" * 80)
    chunk_size = 100
    for i in range(0, len(decoded), chunk_size):
        print(decoded[i:i+chunk_size])
    print("=" * 80)
    
    # Extract ALL coordinate patterns with their actual values
    print("\nALL @ PATTERNS:")
    for match in re.finditer(r'@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', decoded):
        lat, lng = match.group(1), match.group(2)
        print(f"  @{lat},{lng}")
    
    print("\nALL !3d patterns:")
    for match in re.finditer(r'!3d(-?\d+(?:\.\d+)?)', decoded):
        print(f"  !3d{match.group(1)}")
    
    print("\nALL !4d patterns:")
    for match in re.finditer(r'!4d(-?\d+(?:\.\d+)?)', decoded):
        print(f"  !4d{match.group(1)}")
    
    print("\nALL !2d patterns:")
    for match in re.finditer(r'!2d(-?\d+(?:\.\d+)?)', decoded):
        print(f"  !2d{match.group(1)}")

asyncio.run(main())
