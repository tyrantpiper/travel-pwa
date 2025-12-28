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
