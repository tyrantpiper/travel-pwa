import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

export async function GET() {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    // Test signature generation
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = { timestamp, folder: "test" };

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
    });

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret!);

    return NextResponse.json({
        cloudName,
        apiKey: apiKey ? apiKey.slice(0, 4) + "..." : null,
        apiSecretLength: apiSecret?.length,
        apiSecretFirst4: apiSecret?.slice(0, 4),
        apiSecretLast4: apiSecret?.slice(-4),
        testSignature: signature,
        paramsUsed: paramsToSign,
        message: "If you see this, the API route is working. Now verify these values match your Cloudinary dashboard."
    });
}
