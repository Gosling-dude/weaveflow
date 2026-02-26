import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({
        triggerKeyPrefix: process.env.TRIGGER_SECRET_KEY?.slice(0, 7) || "missing"
    });
}
