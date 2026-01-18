import os
import httpx
import json
from dotenv import load_dotenv

load_dotenv()

API_URL = "http://localhost:8000"
USER_ID = "null"

def test_update_profile():
    headers = {
        "X-User-ID": USER_ID,
        "Content-Type": "application/json"
    }
    payload = {
        "name": "Reproduction Test"
    }
    
    print(f"Testing PUT {API_URL}/api/users/me")
    try:
        response = httpx.put(f"{API_URL}/api/users/me", headers=headers, json=payload, timeout=10.0)
        print(f"Update Status: {response.status_code}")
        print(f"Update Response: {response.text}")
        
        if response.status_code == 200:
            print(f"Testing GET {API_URL}/api/users/{USER_ID}/profile")
            response = httpx.get(f"{API_URL}/api/users/{USER_ID}/profile", timeout=10.0)
            print(f"Get Status: {response.status_code}")
            print(f"Get Response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_update_profile()
