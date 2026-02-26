import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        hasCallbackSecret: !!process.env.TRIGGER_CALLBACK_SECRET,
        len: process.env.TRIGGER_CALLBACK_SECRET?.length
    });
}
