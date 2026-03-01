import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const SECRET_KEY = new TextEncoder().encode(
    process.env.JWT_SECRET || "dev-secret-change-in-production"
);

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("auth_token")?.value;

        if (!token) {
            return NextResponse.json({ user: null }, { status: 401 });
        }

        const { payload } = await jwtVerify(token, SECRET_KEY);

        return NextResponse.json({
            user: {
                userId: payload.userId as string,
                name: (payload.name as string) || "",
                email: payload.email as string,
                role: payload.role as string,
            },
        });
    } catch {
        return NextResponse.json({ user: null }, { status: 401 });
    }
}
