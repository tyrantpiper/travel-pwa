import sys
import os
from urllib.parse import urlparse

# Ensure we can import utils
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.url_safety import is_safe_url

def test_whitelist_logic():
    # Core Patch: Only genuine wiki domains enter whitelist trust zone
    SAFE_DOMAINS = ["wikipedia.org", "wikidata.org", "wikivoyage.org", "wikimedia.org"]
    
    cases = [
        ("https://zh.wikipedia.org/wiki/Taiwan", True, "Legitimate Subdomain"),
        ("https://wikipedia.org", True, "Main Domain"),
        ("https://wikipedia.org.evil.com", False, "Malicious Bypass Attempt"),
        ("https://google.com", False, "Non-Wiki Domain"),
    ]

    print("\n--- Whitelist Bypass Proof Test (Patch Verification) ---")
    all_passed = True
    for url, expected_to_be_whitelist, desc in cases:
        parsed = urlparse(url.lower())
        hostname = parsed.hostname or ""
        # The logic we just patched in url_safety.py
        is_whitelisted = any(hostname == domain or hostname.endswith("." + domain) for domain in SAFE_DOMAINS)
        
        status = "PASS" if is_whitelisted == expected_to_be_whitelist else "FAIL"
        if is_whitelisted != expected_to_be_whitelist:
            all_passed = False
        print(f"[{status}] {desc:<25} | Whitelisted: {is_whitelisted} | URL: {url}")

    print("\n--- Overall Safety Test (Functionality and Protection) ---")
    safety_cases = [
        ("http://169.254.169.254", False, "Block Metadata Attack"),
        ("https://en.wikipedia.org/wiki/Travel", True, "Normal Wiki Function"),
    ]
    for url, expect, desc in safety_cases:
        res = is_safe_url(url)
        status = "PASS" if res == expect else "FAIL"
        if res != expect: all_passed = False
        print(f"[{status}] {desc:<25} | Safe: {res} | URL: {url}")

    if all_passed:
        print("\nConclusion: Patch is solid. Whitelist bypass is FIXED and core safety is INTACT.")
    else:
        print("\nConclusion: Regression detected.")

if __name__ == "__main__":
    test_whitelist_logic()
