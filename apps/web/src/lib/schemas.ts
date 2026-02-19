import { z } from "zod";

export const nodeTypeEnum = z.enum(["text", "uploadImage", "uploadVideo", "llm", "cropImage", "extractFrame"]);
export type NodeType = z.infer<typeof nodeTypeEnum>;

export const handleDataTypeEnum = z.enum(["text", "image", "video"]);
export type HandleDataType = z.infer<typeof handleDataTypeEnum>;

export const workflowNodeDataSchema = z.object({
  title: z.string(),
  type: nodeTypeEnum,
  running: z.boolean().default(false),
  result: z.string().optional(),
  error: z.string().optional(),
  model: z.string().optional(),
  textValue: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  timestamp: z.string().optional(),
  crop: z
    .object({
      xPercent: z.string().default("0"),
      yPercent: z.string().default("0"),
      widthPercent: z.string().default("100"),
      heightPercent: z.string().default("100"),
    })
    .optional(),
});

export const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

export const workflowPayloadSchema = z.object({
  title: z.string().min(1),
  nodes: z.array(z.any()),
  edges: z.array(workflowEdgeSchema),
});

export const runRequestSchema = z.object({
  workflowId: z.string().optional(),
  scope: z.enum(["full", "single", "partial"]),
  nodeIds: z.array(z.string()).optional(),
  nodes: z.array(z.any()),
  edges: z.array(workflowEdgeSchema),
});

export const runStatusEnum = z.enum(["running", "success", "failed", "partial"]);