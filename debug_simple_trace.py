"""
Debug Script v35.29: Simple chain trace without Unicode issues
"""
import asyncio
import httpx
import re
from urllib.parse import urlparse, unquote

async def trace_chain(short_url):
    print(f"\n[TRACE] {short_url}")
    print("-" * 70)
    
    current_url = short_url
    hop = 0
    all_coords = []
    
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        while hop < 10:
            # Extract coords
            processed = unquote(unquote(current_url)).replace('%21', '!')
            
            d3d4_match = re.search(r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)', processed)
            at_match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', processed)
            
            if d3d4_match:
                lat, lng = float(d3d4_match.group(1)), float(d3d4_match.group(2))
                precision = len(d3d4_match.group(1).split('.')[-1]) if '.' in d3d4_match.group(1) else 0
                all_coords.append({'lat': lat, 'lng': lng, 'precision': precision, 'hop': hop, 'method': '3d4d'})
                print(f"  Hop {hop}: COORDS FOUND - ({lat}, {lng}) precision={precision} [3d4d]")
            elif at_match:
                lat, lng = float(at_match.group(1)), float(at_match.group(2))
                precision = len(at_match.group(1).split('.')[-1]) if '.' in at_match.group(1) else 0
                all_coords.append({'lat': lat, 'lng': lng, 'precision': precision, 'hop': hop, 'method': 'at'})
                print(f"  Hop {hop}: COORDS FOUND - ({lat}, {lng}) precision={precision} [@]")
            else:
                print(f"  Hop {hop}: No coords in URL")
            
            # Follow redirect
            try:
                resp = await client.get(current_url, follow_redirects=False, timeout=5.0)
                
                if resp.status_code not in [301, 302, 303, 307, 308]:
                    print(f"  Hop {hop}: Chain ends (status={resp.status_code})")
                    break
                
                next_url = resp.headers.get('Location')
                if not next_url:
                    print(f"  Hop {hop}: Chain ends (no Location)")
                    break
                
                if next_url.startswith('/'):
                    parsed = urlparse(current_url)
                    next_url = f"{parsed.scheme}://{parsed.netloc}{next_url}"
                
                current_url = next_url
                hop += 1
                
            except Exception as e:
                print(f"  Hop {hop}: ERROR - {e}")
                break
    
    print("-" * 70)
    print(f"[SUMMARY] Found {len(all_coords)} coordinate sets:")
    for c in all_coords:
        print(f"  Hop {c['hop']}: ({c['lat']}, {c['lng']}) precision={c['precision']} method={c['method']}")
    
    if all_coords:
        best = max(all_coords, key=lambda x: x['precision'])
        print(f"\n[BEST] ({best['lat']}, {best['lng']}) precision={best['precision']}")
        print(f"[VERIFY] https://www.google.com/maps?q={best['lat']},{best['lng']}")

async def main():
    await trace_chain("https://maps.app.goo.gl/MonZuXjVsjGTcChE6")
    await trace_chain("https://maps.app.goo.gl/yUwpCNnAPg7JdM4Y9")

if __name__ == "__main__":
    asyncio.run(main())
