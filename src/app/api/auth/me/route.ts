import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
        const userId = payload.userId as string;

        // Look up user for TOTP status
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { totpSecret: true },
        });

        return NextResponse.json({
            user: {
                userId,
                name: (payload.name as string) || "",
                email: payload.email as string,
                role: payload.role as string,
            },
            totpEnabled: !!user?.totpSecret,
        });
    } catch {
        return NextResponse.json({ user: null }, { status: 401 });
    }
}
