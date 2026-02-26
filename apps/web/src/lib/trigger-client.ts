import { configure, tasks } from "@trigger.dev/sdk/v3";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const accessToken = process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY;
  if (!accessToken) {
    throw new Error("TRIGGER_SECRET_KEY or TRIGGER_API_KEY is missing");
  }
  configure({ accessToken });
  configured = true;
}

export async function triggerAndWait<TPayload extends object>(taskId: string, payload: TPayload): Promise<{ triggerId?: string }> {
  ensureConfigured();
  try {
    const result = await tasks.trigger(taskId, payload as never);
    console.log(`[Trigger.dev] Successfully enqueued task '${taskId}'. Trigger Run ID:`, result.id);
    return { triggerId: result.id };
  } catch (error) {
    console.error("Trigger SDK Error:", error);
    throw new Error(`Failed to enqueue task '${taskId}': ${error instanceof Error ? error.message : "Unknown API error"}`);
  }
}
