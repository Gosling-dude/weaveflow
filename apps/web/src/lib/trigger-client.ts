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

export async function triggerAndWait<TPayload extends object, TOutput = unknown>(taskId: string, payload: TPayload): Promise<TOutput> {
  ensureConfigured();
  const result = await tasks.trigger(taskId, payload as never);

  // Since we're using webhooks for outputs via the Next.js API, we don't return the output here.
  // We just return a dummy object because the actual output will be saved to the database via the webhook.
  return {} as TOutput;
}
