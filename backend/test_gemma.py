"""
Phase 5 Step 0: Test gemma-3-27b SDK Compatibility
--------------------------------------------------
This script tests if gemma-3-27b can be called using the same
genai.Client API as Gemini models.

Run: python test_gemma.py
"""

import os
import sys
from dotenv import load_dotenv

# Load environment for any defaults
load_dotenv()

def test_gemma_call(api_key: str):
    """
    Test gemma-3-27b API call
    """
    try:
        from google import genai
        
        print("🔧 Creating genai.Client...")
        client = genai.Client(api_key=api_key)
        
        print("🔧 Attempting gemma-3-27b call...")
        response = client.models.generate_content(
            model="gemma-3-27b",
            contents="Hello! Please respond with 'Gemma works!' in one line."
        )
        
        print(f"✅ SUCCESS! Response: {response.text}")
        return True
        
    except Exception as e:
        print(f"❌ FAILED: {e}")
        print(f"   Error type: {type(e).__name__}")
        return False


def test_all_models(api_key: str):
    """
    Test all models for availability
    """
    models = [
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.5-pro",
        "gemma-3-27b"
    ]
    
    from google import genai
    client = genai.Client(api_key=api_key)
    
    results = {}
    for model in models:
        print(f"\n🔧 Testing {model}...")
        try:
            response = client.models.generate_content(
                model=model,
                contents="Say 'OK' in one word."
            )
            print(f"   ✅ {model}: {response.text.strip()[:50]}")
            results[model] = True
        except Exception as e:
            print(f"   ❌ {model}: {str(e)[:80]}")
            results[model] = False
    
    print("\n" + "="*50)
    print("📊 Summary:")
    for model, ok in results.items():
        status = "✅" if ok else "❌"
        print(f"   {status} {model}")
    
    return results


if __name__ == "__main__":
    # Get API key from command line or environment
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    else:
        api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        print("❌ No API key provided!")
        print("Usage: python test_gemma.py YOUR_API_KEY")
        sys.exit(1)
    
    print("="*50)
    print("🧪 Phase 5: Model Compatibility Test")
    print("="*50)
    
    test_all_models(api_key)
