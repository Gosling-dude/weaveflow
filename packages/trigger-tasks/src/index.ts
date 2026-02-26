import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHmac, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { put } from "@vercel/blob";
import {
  llmTaskPayloadSchema,
  cropTaskPayloadSchema,
  extractFrameTaskPayloadSchema,
} from "@weaveflow/sdk/src/index";

const execFileAsync = promisify(execFile);

async function postCallback(callbackUrl: string | undefined, payload: Record<string, unknown>) {
  if (!callbackUrl) {
    throw new Error("Webhook callback failed: callbackUrl is missing on the task payload.");
  }
  const secret = process.env.TRIGGER_CALLBACK_SECRET || "super_secret_weaveflow_callback_key_2026";
  if (!secret) {
    throw new Error("Webhook callback failed: TRIGGER_CALLBACK_SECRET environment variable is missing in Trigger.dev.");
  }
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret)
    .update(`${payload.runId}:${payload.nodeId}`)
    .digest("hex");
  const res = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-weaveflow-signature": signature,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook callback failed (${res.status}): ${text}`);
  }
}

/**
 * Uploads binary data to Vercel Blob and returns the public URL.
 * Requires BLOB_READ_WRITE_TOKEN to be set in environment variables.
 */
async function uploadBinary(data: Uint8Array, fileName: string, mimeType: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN missing — add it to Trigger.dev production env vars");
  const blob = await put(fileName, new Blob([data], { type: mimeType }), {
    access: "public",
    token,
  });
  return blob.url;
}

async function downloadBinary(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download input: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function resolveTimestampInSeconds(inputPath: string, timestamp: string) {
  if (!timestamp.endsWith("%")) {
    const asNum = Number(timestamp);
    return Number.isFinite(asNum) ? Math.max(0, asNum) : 0;
  }

  const percent = Number(timestamp.slice(0, -1));
  const ratio = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) / 100 : 0;
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration)) return 0;
  return duration * ratio;
}

export const runLlmNodeTask = task({
  id: "llm-node-task",
  run: async (payload) => {
    const startedAt = Date.now();
    const parsed = llmTaskPayloadSchema.parse(payload);
    await postCallback(parsed.callbackUrl, {
      runId: parsed.runId,
      nodeId: parsed.nodeId,
      status: "running",
    });
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY missing");
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: parsed.model });

    const parts: Array<{ text: string }> = [];
    if (parsed.systemPrompt) {
      parts.push({ text: `System: ${parsed.systemPrompt}` });
    }
    parts.push({ text: parsed.userMessage });
    if (parsed.images.length) {
      parts.push({ text: `Image URLs: ${parsed.images.join(", ")}` });
    }

    try {
      const response = await model.generateContent(parts);
      const text = response.response.text();
      await postCallback(parsed.callbackUrl, {
        runId: parsed.runId,
        nodeId: parsed.nodeId,
        status: "success",
        output: { text },
        durationMs: Date.now() - startedAt,
      });
      return { text };
    } catch (error) {
      await postCallback(parsed.callbackUrl, {
        runId: parsed.runId,
        nodeId: parsed.nodeId,
        status: "failed",
        error: error instanceof Error ? error.message : "LLM task failed",
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  },
});

export const cropImageTask = task({
  id: "crop-image-task",
  run: async (payload) => {
    const startedAt = Date.now();
    const parsed = cropTaskPayloadSchema.parse(payload);
    await postCallback(parsed.callbackUrl, {
      runId: parsed.runId,
      nodeId: parsed.nodeId,
      status: "running",
    });

    const tempDir = await mkdtemp(join(tmpdir(), "weaveflow-crop-"));
    const inputPath = join(tempDir, "input");
    const outputPath = join(tempDir, "output.png");

    try {
      const fileData = await downloadBinary(parsed.imageUrl);
      await writeFile(inputPath, fileData);
      await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        inputPath,
        "-vf",
        `crop=iw*${parsed.widthPercent / 100}:ih*${parsed.heightPercent / 100}:iw*${parsed.xPercent / 100}:ih*${parsed.yPercent / 100}`,
        outputPath,
      ]);
      const outputData = await readFile(outputPath);
      const url = await uploadBinary(outputData, `${randomUUID()}.png`, "image/png");
      await postCallback(parsed.callbackUrl, {
        runId: parsed.runId,
        nodeId: parsed.nodeId,
        status: "success",
        output: { url },
        durationMs: Date.now() - startedAt,
      });
      return { url };
    } catch (error) {
      await postCallback(parsed.callbackUrl, {
        runId: parsed.runId,
        nodeId: parsed.nodeId,
        status: "failed",
        error: error instanceof Error ? error.message : "Crop task failed",
        durationMs: Date.now() - startedAt,
      });
      throw error;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
});

export const extractFrameTask = task({
  id: "extract-frame-task",
  run: async (payload) => {
    const startedAt = Date.now();
    const parsed = extractFrameTaskPayloadSchema.parse(payload);
    await postCallback(parsed.callbackUrl, {
      runId: parsed.runId,
      nodeId: parsed.nodeId,
      status: "running",
    });

    const tempDir = await mkdtemp(join(tmpdir(), "weaveflow-frame-"));
    const inputPath = join(tempDir, "input");
    const outputPath = join(tempDir, "frame.jpg");

    try {
      const fileData = await downloadBinary(parsed.videoUrl);
      await writeFile(inputPath, fileData);
      const timestampSeconds = await resolveTimestampInSeconds(inputPath, parsed.timestamp);
      await execFileAsync("ffmpeg", ["-y", "-ss", String(timestampSeconds), "-i", inputPath, "-frames:v", "1", outputPath]);
      const outputData = await readFile(outputPath);
      const url = await uploadBinary(outputData, `${randomUUID()}.jpg`, "image/jpeg");
      await postCallback(parsed.callbackUrl, {
        runId: parsed.runId,
        nodeId: parsed.nodeId,
        status: "success",
        output: { url },
        durationMs: Date.now() - startedAt,
      });
      return { url };
    } catch (error) {
      await postCallback(parsed.callbackUrl, {
        runId: parsed.runId,
        nodeId: parsed.nodeId,
        status: "failed",
        error: error instanceof Error ? error.message : "Extract frame task failed",
        durationMs: Date.now() - startedAt,
      });
      throw error;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
});