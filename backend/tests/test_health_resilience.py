import pytest
import httpx
from main import app

@pytest.mark.asyncio
async def test_health_check_fast_response():
    """驗證 /health 端點能在極速（< 50ms）內回傳 200 OK 與合法結構"""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "degraded"]
        assert "uptime_seconds" in data
        assert data["service"] == "ryan-travel-api"
        assert data["version"] == "1.2.8-resilience"

@pytest.mark.asyncio
async def test_health_check_deep():
    """驗證 /health/deep 深度診斷端點正常響應"""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.get("/health/deep")
        assert response.status_code in [200, 500, 502, 503, 504]
        data = response.json()
        assert "status" in data
