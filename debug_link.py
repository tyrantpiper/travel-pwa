import httpx
import asyncio

async def test():
    url = "https://maps.app.goo.gl/MonZuXjVsjGTcChE6"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        resp = await client.get(url)
        print(f"Final URL: {resp.url}")

asyncio.run(test())
