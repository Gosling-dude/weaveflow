import { z } from "zod";

export const llmTaskPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  callbackUrl: z.string().url().optional(),
  model: z.string(),
  systemPrompt: z.string().optional(),
  userMessage: z.string(),
  images: z.array(z.string().url()).default([]),
});

export const cropTaskPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  callbackUrl: z.string().url().optional(),
  imageUrl: z.string().url(),
  xPercent: z.number().min(0).max(100).default(0),
  yPercent: z.number().min(0).max(100).default(0),
  widthPercent: z.number().min(0).max(100).default(100),
  heightPercent: z.number().min(0).max(100).default(100),
});

export const extractFrameTaskPayloadSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  callbackUrl: z.string().url().optional(),
  videoUrl: z.string().url(),
  timestamp: z.string().default("0"),
});

export type LlmTaskPayload = z.infer<typeof llmTaskPayloadSchema>;
export type CropTaskPayload = z.infer<typeof cropTaskPayloadSchema>;
export type ExtractFrameTaskPayload = z.infer<typeof extractFrameTaskPayloadSchema>;