import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { imageUrl, image, mime_type: reqMimeType } = body;

        let base64Image = image;
        let mimeType = reqMimeType || "image/jpeg";

        // 如果沒有提供直接的 Base64，但有 URL，則進行抓取 (向後相容)
        if (!base64Image && imageUrl) {
            console.log(`[Proxy] Fetching image from URL for backward compatibility: ${imageUrl.substring(0, 50)}...`);
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image from URL: ${imageResponse.statusText}`);
            }

            mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            base64Image = buffer.toString("base64");
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
