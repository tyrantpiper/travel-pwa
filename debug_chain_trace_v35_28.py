"""
Debug Script v35.28: Full chain trace with all hop details
"""
import asyncio
import httpx
import re
from urllib.parse import urlparse, unquote

async def trace_redirect_chain_verbose(short_url: str):
    """Trace the full redirect chain and show all details"""
    print(f"\n{'='*70}")
    print(f"🔍 TRACING: {short_url}")
    print(f"{'='*70}")
    
    current_url = short_url
    visited = set()
    hop = 0
    all_coords = []
    
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        while hop < 10:
            if current_url in visited:
                print(f"⚠️ Loop detected!")
                break
            visited.add(current_url)
            
            # Extract coords from current URL
            processed = unquote(unquote(current_url)).replace('%21', '!')
            
            # Try different patterns
            at_match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', processed)
            d3d4_match = re.search(r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)', processed)
            
            coords_found = None
            if d3d4_match:
                lat = float(d3d4_match.group(1))
                lng = float(d3d4_match.group(2))
                lat_decimals = len(d3d4_match.group(1).split('.')[-1]) if '.' in d3d4_match.group(1) else 0
                coords_found = {'lat': lat, 'lng': lng, 'method': '3d4d', 'precision': lat_decimals}
            elif at_match:
                lat = float(at_match.group(1))
                lng = float(at_match.group(2))
                lat_decimals = len(at_match.group(1).split('.')[-1]) if '.' in at_match.group(1) else 0
                coords_found = {'lat': lat, 'lng': lng, 'method': 'at_symbol', 'precision': lat_decimals}
            
            print(f"\n📍 Hop {hop}:")
            print(f"   URL: {current_url[:100]}...")
            if coords_found:
                print(f"   Coords: ({coords_found['lat']}, {coords_found['lng']})")
                print(f"   Method: {coords_found['method']}, Precision: {coords_found['precision']} decimals")
                all_coords.append(coords_found)
            else:
                print(f"   Coords: None found")
            
            # Follow redirect
            try:
                resp = await client.get(current_url, follow_redirects=False, timeout=5.0)
                print(f"   Status: {resp.status_code}")
                
                if resp.status_code not in [301, 302, 303, 307, 308]:
                    print(f"   ✅ Chain ends (non-redirect status)")
                    break
                
                next_url = resp.headers.get('Location')
                if not next_url:
                    print(f"   ✅ Chain ends (no Location header)")
                    break
                
                # Handle relative paths
                if next_url.startswith('/'):
                    parsed = urlparse(current_url)
                    next_url = f"{parsed.scheme}://{parsed.netloc}{next_url}"
                
                print(f"   → Redirects to: {next_url[:80]}...")
                current_url = next_url
                hop += 1
                
            except Exception as e:
                print(f"   ❌ Error: {e}")
                break
    
    print(f"\n{'='*70}")
    print(f"📊 SUMMARY: Found {len(all_coords)} coordinate sets")
    for i, c in enumerate(all_coords):
        print(f"   [{i}] ({c['lat']}, {c['lng']}) - {c['method']}, precision={c['precision']}")
    
    if all_coords:
        # Select best (highest precision)
        best = max(all_coords, key=lambda x: x['precision'])
        print(f"\n🎯 BEST SELECTION: ({best['lat']}, {best['lng']}) with precision {best['precision']}")
        
        # Google Maps verification link
        print(f"\n🗺️ Verify on Google Maps:")
        print(f"   https://www.google.com/maps?q={best['lat']},{best['lng']}")

async def main():
    urls = [
        "https://maps.app.goo.gl/MonZuXjVsjGTcChE6",
        "https://maps.app.goo.gl/yUwpCNnAPg7JdM4Y9",
    ]
    
    for url in urls:
        await trace_redirect_chain_verbose(url)

if __name__ == "__main__":
    asyncio.run(main())
