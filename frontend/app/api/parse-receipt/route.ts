import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { imageUrl, image, mime_type: reqMimeType } = body;

        let base64Image = image;
        let mimeType = reqMimeType || "image/jpeg";

        // 🛡️ SSRF Protection: Validate imageUrl before fetching
        if (!base64Image && imageUrl) {
            try {
                const url = new URL(imageUrl);
                
                // 1. Only allow HTTPS
                if (url.protocol !== "https:") {
                    throw new Error("Only HTTPS URLs are allowed");
                }
                
                // 2. Domain Whitelist (Cloudinary as primary source)
                const allowedDomains = ["res.cloudinary.com"];
                const hostname = url.hostname;
                if (!allowedDomains.includes(hostname) && !allowedDomains.some(domain => hostname.endsWith("." + domain))) {
                    console.warn(`[Proxy] Blocked SSRF attempt to non-whitelisted domain: ${hostname}`);
                    return NextResponse.json({ error: "Unauthorized image source" }, { status: 403 });
                }

                console.log(`[Proxy] Fetching image from trusted URL: ${url.origin}${url.pathname.substring(0, 20)}...`);
                
                // 3. URL Reconstruction (🛡️ SSRF Mitigation)
                // We DO NOT use url.toString() to prevent taint propagation.
                // We rebuild the URL from strictly validated components (hostname/pathname).
                const safeUrl = `https://${hostname}${url.pathname}`;
                const imageResponse = await fetch(safeUrl);
                if (!imageResponse.ok) {
                    throw new Error(`Failed to fetch image from URL: ${imageResponse.statusText}`);
                }

                mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
                const arrayBuffer = await imageResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                base64Image = buffer.toString("base64");
            } catch (e) {
                console.error("[Proxy] URL Validation Error:", e);
                return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid URL" }, { status: 400 });
            }
        }

        if (!base64Image) {
            return NextResponse.json({ error: "No image data or URL provided" }, { status: 400 });
        }

        // 4. Send to Python Backend /api/ai/parse_receipt
        // Note: Using NEXT_PUBLIC_API_URL or environment variable for the backend
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

        // Pass along the authorization token from the request headers
        const authHeader = request.headers.get("authorization");
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (authHeader) headers["Authorization"] = authHeader;

        const backendResponse = await fetch(`${backendUrl}/api/ai/parse-receipt`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                image: base64Image,
                mime_type: mimeType
            })
        });

        if (!backendResponse.ok) {
            const status = backendResponse.status;
            let errorDetail = "Backend parse error";
            try {
                const errData = await backendResponse.json();
                errorDetail = errData.detail || errData.message || errorDetail;
            } catch (e) {
                console.warn('[parse-receipt] Failed to parse JSON response:', e);
            }
            
            return NextResponse.json({ detail: errorDetail }, { status });
        }

        // 5. Return the parsed extraction to the frontend
        const parsedData = await backendResponse.json();
        return NextResponse.json(parsedData);

    } catch (error) {
        console.error("Parse Receipt Proxy Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
