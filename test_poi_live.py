import httpx
import asyncio
import json

async def test_enrich():
    url = "http://127.0.0.1:8008/api/poi/ai-enrich"
    payload = {
        "name": "Kinkaku-ji",
        "type": "temple",
        "lat": 35.0394,
        "lng": 135.7292,
        "api_key": "DUMMY", # Should still trigger the wiki part
        "poi_id": "test_1",
        "wikidata_id": "Q182393"
    }
    
    print(f"Testing {url} with {payload['name']}...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # We need to provide a dummy headers like the frontend does if any
            response = await client.post(url, json=payload)
            print(f"Status: {response.status_code}")
            data = response.json()
            print("Response Metadata:")
            print(f" - Status: {data.get('status')}")
            print(f" - Resolved Language: {data.get('resolved_language')}")
            print(f" - Cultural Desc (First 100 char): {str(data.get('cultural_desc'))[:100]}")
            print(f" - Travel Tips: {str(data.get('travel_tips'))[:100]}")
            print(f" - Image URL: {data.get('image_url')}")
            
            if not data.get('cultural_desc'):
                print("❌ ERROR: Cultural description is EMPTY!")
            else:
                print("✅ SUCCESS: Cultural description found.")
                
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_enrich())
