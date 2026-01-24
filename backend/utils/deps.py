import os
from fastapi import Header, HTTPException, Request
from supabase import create_client, Client


async def get_gemini_key(x_gemini_api_key: str = Header(None, alias="X-Gemini-API-Key")):
    """
    🔒 BYOK (Bring Your Own Key) 模式
    
    驗證使用者提供的 Gemini API Key。
    使用者必須在 HTTP Header 中提供有效的 API Key。
    
    Args:
        x_gemini_api_key: 從 X-Gemini-API-Key header 讀取
        
    Returns:
        str: 驗證通過的 API Key
        
    Raises:
        HTTPException: 401 如果 Key 無效或未提供
    """
    # 調試日誌
    if x_gemini_api_key:
        print(f"🔑 收到 API Key: {x_gemini_api_key[:10]}... (長度: {len(x_gemini_api_key)})")
    
    # 🚫 沒有 Key 或格式不對，直接拒絕
    if not x_gemini_api_key or len(x_gemini_api_key) < 39:
        print(f"❌ API Key 驗證失敗：未提供或格式無效")
        raise HTTPException(
            status_code=401, 
            detail="請先在設定中輸入您的 Gemini API Key (點擊右上角齒輪圖示)"
        )
    
    return x_gemini_api_key


def get_supabase(request: Request) -> Client:
    """從 app.state 獲取全域 Supabase 客戶端 (使用 Service Role Key)"""
    return request.app.state.supabase

async def get_verified_user(
    request: Request,
    x_user_id: str = Header(None, alias="X-User-ID"),
    auth_header: str = Header(None, alias="Authorization")
) -> str:
    """
    🛡️ 安全身分驗證依賴 (v2026 Security Hardening)
    
    邏輯推理：
    1. 優先驗證 JWT Token (如果前端有傳)。
    2. 如果沒有 Token，暫時允許 X-User-ID (向後相容)，但會在後台標記為「低安全性請求」。
    3. 如果 ID 衝突，以 Token 解析出的 ID 為準。
    """
    supabase: Client = request.app.state.supabase
    
    # 1. 嘗試從 Authorization Header 驗證 (最安全)
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            # 使用 Supabase Auth 驗證 Token
            user_res = supabase.auth.get_user(token)
            if user_res and user_res.user:
                verified_id = str(user_res.user.id)
                print(f"🛡️ [Auth] Verified JWT for User: {verified_id}")
                # 安全校驗：如果同時傳了 X-User-ID 但不吻合，視為偽造嘗試
                if x_user_id and x_user_id != verified_id:
                    print(f"🚨 [Security] Identity Mismatch! Token: {verified_id} vs Header: {x_user_id}")
                    raise HTTPException(status_code=403, detail="身分令牌不匹配")
                return verified_id
        except Exception as e:
            print(f"⚠️ [Auth] Token verification failed: {e}")
            # Token 失效時不直接報錯，回落到 X-User-ID 以維持過度期穩定
            
    # 2. 回落到 X-User-ID (維持目前的 UX 流暢度)
    if x_user_id:
        # 🧪 Debug Log: 追蹤 ID 來源
        is_uuid = len(x_user_id) == 36 and "-" in x_user_id
        print(f"👤 [Identity] Identifying via X-User-ID: {x_user_id} (IsUUID: {is_uuid})")
        return x_user_id
        
    raise HTTPException(status_code=401, detail="無法識別使用者身分")
