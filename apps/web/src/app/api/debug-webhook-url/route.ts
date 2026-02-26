import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildCallbackUrl() {
    let appUrl: string | undefined;

    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        appUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    } else if (process.env.VERCEL_URL) {
        appUrl = `https://${process.env.VERCEL_URL}`;
    } else {
        appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
    }

    if (!appUrl) return undefined;
    return `${appUrl.replace(/\/$/, "")}/api/trigger/callback`;
}

export async function GET() {
    return NextResponse.json({
        webhookUrl: buildCallbackUrl(),
        env: {
            VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
            VERCEL_URL: process.env.VERCEL_URL || null,
            NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || null,
            APP_URL: process.env.APP_URL || null,
            NODE_ENV: process.env.NODE_ENV || null,
        }
    });
}
