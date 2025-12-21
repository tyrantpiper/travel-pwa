import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
    const body = await request.json();
    const { paramsToSign } = body;

    // Debug logging
    console.log("Sign API called with:", paramsToSign);
    console.log("Env check:", {
        cloud_name: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        api_key: !!process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
        api_secret: !!process.env.CLOUDINARY_API_SECRET,
        api_secret_length: process.env.CLOUDINARY_API_SECRET?.length
    });

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) {
        return NextResponse.json({ error: "CLOUDINARY_API_SECRET not configured" }, { status: 500 });
    }

    const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        apiSecret
    );

    console.log("Generated signature:", signature);
    return NextResponse.json({ signature });
}
