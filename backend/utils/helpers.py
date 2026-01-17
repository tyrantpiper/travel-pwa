"""
Shared Helper Functions
-----------------------
Centralized utility functions for use across all routers.
"""

import random
import string


def generate_room_code() -> str:
    """
    產生 4 位數房間代碼
    
    用於行程分享功能，讓用戶可以透過房間碼加入行程。
    
    Returns:
        str: 4 位數的隨機數字字串 (e.g., "1234", "0987")
    """
    return ''.join(random.choices(string.digits, k=4))

def generate_public_id() -> str:
    """
    產生隨機公開 ID (URL 使用)
    格式: pub_ 加上 8 位英數混合字串
    """
    chars = string.ascii_lowercase + string.digits
    suffix = ''.join(random.choices(chars, k=8))
    return f"pub_{suffix}"
