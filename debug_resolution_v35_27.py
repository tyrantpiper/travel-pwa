"""
Debug Script v35.27: Trace the full resolution flow
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from backend.services.link_resolver import resolve_google_maps_link

async def debug_resolution():
    urls = [
        "https://maps.app.goo.gl/MonZuXjVsjGTcChE6",  # 台場自由の女神像
        "https://maps.app.goo.gl/yUwpCNnAPg7JdM4Y9",  # Another problematic URL
    ]
    
    for url in urls:
        print(f"\n{'='*60}")
        print(f"🔍 Testing: {url}")
        print(f"{'='*60}")
        
        try:
            result = await resolve_google_maps_link(url)
            
            print(f"\n📊 RESULT:")
            print(f"   Lat: {result.get('lat')}")
            print(f"   Lng: {result.get('lng')}")
            print(f"   Method: {result.get('method')}")
            print(f"   Resolved URL: {result.get('resolved_url', 'N/A')[:100]}...")
            
            if result.get('lat') and result.get('lng'):
                lat = result['lat']
                lng = result['lng']
                
                # Check if coordinates are in the sea (roughly)
                # Tokyo area should be around: lat=35.5-35.9, lng=139.5-140.0
                if 35.5 <= lat <= 36.0 and 139.5 <= lng <= 140.0:
                    print(f"   ✅ Coordinates look correct (Tokyo area)")
                else:
                    print(f"   ⚠️ Coordinates may be incorrect!")
                    print(f"      Expected: lat=35.5-36.0, lng=139.5-140.0")
            else:
                print(f"   ❌ No coordinates extracted!")
                
        except Exception as e:
            print(f"   ❌ ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_resolution())
