import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: NextRequest) {
    const uri = request.nextUrl.searchParams.get("uri");
    if (!uri) {
        return NextResponse.json({ error: "Missing URI" }, { status: 400 });
    }

    try {
        const buffer = await QRCode.toBuffer(uri, {
            width: 280,
            margin: 2,
            color: { dark: "#1a2e1e", light: "#ffffff" },
            errorCorrectionLevel: "M",
        });

        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ error: "Failed to generate QR" }, { status: 500 });
    }
}
