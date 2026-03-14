import asyncio
import os
import json
import base64
from google import genai
from google.genai import types, errors
from dotenv import load_dotenv

load_dotenv()

async def test_model_capabilities(api_key, model_name):
    client = genai.Client(api_key=api_key)
    results = {"model": model_name, "tests": {}}
    
    # Test 1: Direct generate_content (Text only)
    print(f"\n--- Testing {model_name}: Direct Generation (Text) ---")
    try:
        response = await client.aio.models.generate_content(
            model=model_name,
            contents="Say hello in 5 words.",
            config=types.GenerateContentConfig(temperature=1.0)
        )
        results["tests"]["generate_content_text"] = {"status": "success", "output": response.text}
        print(f"✅ Success: {response.text}")
    except Exception as e:
        results["tests"]["generate_content_text"] = {"status": "failed", "error": str(e)}
        print(f"❌ Failed: {e}")

    # Test 2: Chat Interface (chats.create)
    print(f"\n--- Testing {model_name}: Chat Interface ---")
    try:
        chat = client.aio.chats.create(model=model_name)
        response = await chat.send_message("Say hi.")
        results["tests"]["chat_interface"] = {"status": "success", "output": response.text}
        print(f"✅ Success: {response.text}")
    except Exception as e:
        results["tests"]["chat_interface"] = {"status": "failed", "error": str(e)}
        print(f"❌ Failed: {e}")

    # Test 3: Multi-modal (Image)
    print(f"\n--- Testing {model_name}: Multi-modal (Image) ---")
    try:
        # Create a tiny 1x1 black pixel PNG
        pixel_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        image_bytes = base64.b64decode(pixel_b64)
        contents = [
            "What is in this image?",
            types.Part.from_bytes(data=image_bytes, mime_type="image/png")
        ]
        response = await client.aio.models.generate_content(
            model=model_name,
            contents=contents
        )
        results["tests"]["vision_support"] = {"status": "success", "output": response.text}
        print(f"✅ Success (Vision): {response.text}")
    except Exception as e:
        results["tests"]["vision_support"] = {"status": "failed", "error": str(e)}
        print(f"❌ Failed (Vision): {e}")

    # Test 4: JSON Extraction Stability
    print(f"\n--- Testing {model_name}: JSON Stability (Temp 1.0) ---")
    prompt = "Return a JSON object with a key 'greeting' and value 'hello'. Only return JSON."
    try:
        response = await client.aio.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=1.0)
        )
        text = response.text.replace("```json", "").replace("```", "").strip()
        try:
            json.loads(text)
            results["tests"]["json_stability"] = {"status": "success", "text": text}
            print(f"✅ Success (JSON): {text}")
        except:
            results["tests"]["json_stability"] = {"status": "parsing_failed", "text": text}
            print(f"⚠️ Warning (JSON Parsing Failed): {text}")
    except Exception as e:
        results["tests"]["json_stability"] = {"status": "failed", "error": str(e)}
        print(f"❌ Failed (JSON): {e}")

    return results

async def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or "YOUR_" in api_key:
        print("❌ Error: No valid GEMINI_API_KEY in .env")
        return

    models = [
        "gemini-3.1-flash-lite-preview",
        "gemini-2.0-flash-exp", # Known working model for comparison
    ]
    
    all_results = []
    for model in models:
        res = await test_model_capabilities(api_key, model)
        all_results.append(res)
    
    with open("v17_rethink_results.json", "w") as f:
        json.dump(all_results, f, indent=2)
    print("\n📝 All tests completed. Results saved to v17_rethink_results.json")

if __name__ == "__main__":
    asyncio.run(main())
