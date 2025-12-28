"""
Shared FastAPI Dependencies
---------------------------
Centralized dependency injection functions for use across all routers.
"""

from fastapi import Header, HTTPException, Request


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


def get_supabase(request: Request):
    """
    從 app.state 獲取 Supabase 客戶端
    
    這個依賴允許 routers 安全地訪問 Supabase 客戶端，
    而不需要直接導入或使用全域變數。
    
    用法：
        @router.get("/example")
        def example(supabase = Depends(get_supabase)):
            supabase.table("trips").select("*").execute()
    """
    return request.app.state.supabase
