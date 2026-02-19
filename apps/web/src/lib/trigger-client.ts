import { configure, tasks } from "@trigger.dev/sdk/v3";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const accessToken = process.env.TRIGGER_API_KEY;
  if (!accessToken) {
    throw new Error("TRIGGER_API_KEY is missing");
  }
  configure({ accessToken });
  configured = true;
}

export async function triggerAndWait<TPayload extends object, TOutput = unknown>(taskId: string, payload: TPayload): Promise<TOutput> {
  ensureConfigured();
  const result = await tasks.triggerAndWait(taskId, payload as never);
  if (!result.ok) {
    const message = result.error instanceof Error ? result.error.message : "Trigger task failed";
    throw new Error(message);
  }
  return result.output as TOutput;
}
