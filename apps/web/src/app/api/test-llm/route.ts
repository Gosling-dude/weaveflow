import { NextResponse } from "next/server";
import { triggerAndWait } from "@/lib/trigger-client";

export async function GET() {
    try {
        const result = await triggerAndWait("llm-node-task", {
            runId: "test-run",
            nodeId: "test-node",
            callbackUrl: "https://example.com/api/trigger/callback",
            model: "gemini-2.0-flash",
            systemPrompt: "You are a test bot",
            userMessage: "Say hello",
            images: []
        });

        return NextResponse.json({ success: true, result });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
    }
}
