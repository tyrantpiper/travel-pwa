# debug_update_flow.py - Test the complete resolution + update flow
import asyncio
import httpx

async def main():
    # Test item ID (you'll need to replace this with a real item ID from your app)
    TEST_ITEM_ID = "test-item-id-here"
    
    # Step 1: Resolve the link
    print("=" * 60)
    print("STEP 1: Resolving link...")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        resolve_resp = await client.post(
            "http://localhost:8000/api/geocode/resolve-link",
            json={"url": "https://maps.app.goo.gl/MonZuXjVsjGTcChE6", "type": "map"}
        )
        resolve_data = resolve_resp.json()
        print(f"Resolve Response: {resolve_data}")
        
        lat = resolve_data.get("lat")
        lng = resolve_data.get("lng")
        
        if lat and lng:
            print(f"\nCoordinates: ({lat}, {lng})")
            print(f"Expected: lat ~35.627, lng ~139.77 (Odaiba Statue of Liberty)")
            
            # Step 2: Simulate what the frontend does - update the item
            print("\n" + "=" * 60)
            print("STEP 2: This is what frontend would send to update:")
            print("=" * 60)
            
            update_payload = {
                "lat": lat,
                "lng": lng,
                "preview_metadata": {"map_image": resolve_data.get("metadata", {}).get("image")}
            }
            print(f"Payload: {update_payload}")
            
            # To actually test, you'd need a valid item ID and user auth
            # print("\n[Skipping actual PATCH - need valid item ID and auth]")
        else:
            print("ERROR: No coordinates returned!")

asyncio.run(main())
