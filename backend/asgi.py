import json
from js import Response, Headers

async def fetch(app, request, env):
    # Simple Hello World Probe to verify deployment first
    headers = Headers.new({"content-type": "application/json"})
    return Response.new(json.dumps({
        "status": "online", 
        "message": "Cloudflare Python Worker is Active!",
        "version": "v1"
    }), {
        "status": 200,
        "headers": headers
    })
