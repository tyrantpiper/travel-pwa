import asyncio
from services.link_resolver import resolve_google_maps_link

async def main():
    # The user's specific problematic URL
    url = "https://maps.app.goo.gl/MonZuXjVsjGTcChE6"
    
    print(f"🚀 [Clinical Trial] Testing URL: {url}")
    print("-" * 50)
    
    try:
        result = await resolve_google_maps_link(url)
        
        print("\n📊 Resolution Report:")
        print(f"  - Expanded URL: {result.get('resolved_url')}")
        print(f"  - Resolution Method: {result.get('method')}")
        print(f"  - Coordinates: ({result.get('lat')}, {result.get('lng')})")
        
        metadata = result.get('metadata', {})
        print(f"  - Title: {metadata.get('title')}")
        print(f"  - Image URL: {metadata.get('image')}")
        
        if result.get('lat') and result.get('lng'):
            print("\n✅ SUCCESS: Pinpoint coordinates extracted via clinical protocol.")
        else:
            print("\n❌ FAILURE: Could not extract coordinates.")
            
        if metadata.get('image'):
            print("✅ SUCCESS: Preview image extracted.")
        else:
            print("⚠️ WARNING: Image still missing (Likely CSR/JS-only page).")
            
    except Exception as e:
        import traceback
        print(f"\n❌ CRITICAL ERROR: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
