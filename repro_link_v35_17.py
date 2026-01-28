import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from backend.services.link_resolver import resolve_google_maps_link

async def test_problematic_link():
    url = "https://maps.app.goo.gl/MonZuXjVsjGTcChE6"
    print(f"🕵️ Clinical Test: Resolving problematic link: {url}")
    
    result = await resolve_google_maps_link(url)
    
    print("\n--- Diagnostic Results ---")
    print(f"📍 Resolved Lat: {result.get('lat')}")
    print(f"📍 Resolved Lng: {result.get('lng')}")
    print(f"📍 Method: {result.get('method')}")
    
    meta = result.get("metadata", {})
    print(f"📸 Image URL: {meta.get('image')}")
    print(f"🏷️ Title: {meta.get('title')}")
    
    if not result.get("lat") or not result.get("lng"):
        print("\n❌ FAILURE: Coordinates could not be extracted.")
    elif not meta.get("image"):
        print("\n❌ SEMI-FAILURE: Coordinates extracted but VISUAL BLACKOUT (No image).")
    else:
        print("\n✅ SUCCESS: Full resolution achieved.")

if __name__ == "__main__":
    asyncio.run(test_problematic_link())
