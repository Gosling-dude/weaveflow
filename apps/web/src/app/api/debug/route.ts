import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        APP_URL: process.env.APP_URL,
        VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
        VERCEL_URL: process.env.VERCEL_URL,
    });
}
