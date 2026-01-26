import httpx
import asyncio

async def test():
    url = "https://maps.app.goo.gl/MonZuXjVsjGTcChE6"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    async with httpx.AsyncClient(follow_redirects=True, headers=headers) as client:
        resp = await client.get(url)
        print(f"URL: {resp.url}")

asyncio.run(test())
