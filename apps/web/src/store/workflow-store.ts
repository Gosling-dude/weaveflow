"use client";

import { addEdge, applyEdgeChanges, applyNodeChanges, type Edge, type Node, type OnConnect } from "@xyflow/react";
import { create } from "zustand";
import { nanoid } from "nanoid/non-secure";

export type WorkflowNodeData = {
  title: string;
  type: "text" | "uploadImage" | "uploadVideo" | "llm" | "cropImage" | "extractFrame";
  running?: boolean;
  result?: string;
  error?: string;
  textValue?: string;
  systemPrompt?: string;
  userMessage?: string;
  model?: string;
  imageUrl?: string;
  videoUrl?: string;
  timestamp?: string;
  crop?: { xPercent: string; yPercent: string; widthPercent: string; heightPercent: string };
};

type Snapshot = { nodes: Node<WorkflowNodeData>[]; edges: Edge[] };

type WorkflowState = {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  selectedNodeIds: string[];
  past: Snapshot[];
  future: Snapshot[];
  onNodesChange: (changes: unknown) => void;
  onEdgesChange: (changes: unknown) => void;
  onConnect: OnConnect;
  addNode: (type: WorkflowNodeData["type"]) => void;
  setNodes: (nodes: Node<WorkflowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, patch: Partial<WorkflowNodeData>) => void;
  deleteSelection: () => void;
  setSelectedNodeIds: (nodeIds: string[]) => void;
  undo: () => void;
  redo: () => void;
  loadSampleWorkflow: () => void;
};

const pushHistory = (state: WorkflowState): Pick<WorkflowState, "past" | "future"> => ({
  past: [...state.past, { nodes: state.nodes, edges: state.edges }],
  future: [],
});

const allowedTargetTypes: Record<string, string[]> = {
  system_prompt: ["text"],
  user_message: ["text"],
  images: ["image"],
  image_url: ["image"],
  x_percent: ["text"],
  y_percent: ["text"],
  width_percent: ["text"],
  height_percent: ["text"],
  video_url: ["video"],
  timestamp: ["text"],
};

function outputTypeFromSourceHandle(handle = "output") {
  if (handle.includes("image")) return "image";
  if (handle.includes("video")) return "video";
  return "text";
}

function createNode(type: WorkflowNodeData["type"], x = 180, y = 120): Node<WorkflowNodeData> {
  return {
    id: nanoid(),
    type,
    position: { x, y },
    data: {
      title:
        type === "uploadImage"
          ? "Upload Image"
          : type === "uploadVideo"
            ? "Upload Video"
            : type === "cropImage"
              ? "Crop Image"
              : type === "extractFrame"
                ? "Extract Frame from Video"
                : type === "llm"
                  ? "Run Any LLM"
                  : "Text Node",
      type,
      textValue: type === "text" ? "" : undefined,
      timestamp: type === "extractFrame" ? "50%" : undefined,
      crop: type === "cropImage" ? { xPercent: "0", yPercent: "0", widthPercent: "100", heightPercent: "100" } : undefined,
      model: type === "llm" ? "gemini-2.0-flash" : undefined,
    },
  };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  past: [],
  future: [],

  onNodesChange: (changes) => {
    const { nodes } = get();
    set({ nodes: applyNodeChanges(changes as Parameters<typeof applyNodeChanges>[0], nodes) as Node<WorkflowNodeData>[] });
  },
  onEdgesChange: (changes) => {
    const { edges } = get();
    set({ edges: applyEdgeChanges(changes as Parameters<typeof applyEdgeChanges>[0], edges) });
  },
  onConnect: (params) => {
    if (!params.targetHandle || !params.source || !params.target) return;
    const sourceNode = get().nodes.find((node) => node.id === params.source);
    if (!sourceNode) return;
    const outType = outputTypeFromSourceHandle(params.sourceHandle ?? "output");
    const allowed = allowedTargetTypes[params.targetHandle] ?? [];
    if (!allowed.includes(outType)) return;
    set((state) => ({
      ...pushHistory(state),
      edges: addEdge(
        {
          ...params,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#8b5cf6", strokeWidth: 2 },
        },
        state.edges,
      ),
    }));
  },
  addNode: (type) => {
    const { nodes } = get();
    const nextNode = createNode(type, 160 + nodes.length * 40, 100 + nodes.length * 20);
    set((state) => ({ ...pushHistory(state), nodes: [...state.nodes, nextNode] }));
  },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  updateNodeData: (nodeId, patch) => {
    set((state) => ({
      nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node)),
    }));
  },
  deleteSelection: () => {
    set((state) => ({
      ...pushHistory(state),
      nodes: state.nodes.filter((node) => !state.selectedNodeIds.includes(node.id)),
      edges: state.edges.filter((edge) => !state.selectedNodeIds.includes(edge.source) && !state.selectedNodeIds.includes(edge.target)),
      selectedNodeIds: [],
    }));
  },
  setSelectedNodeIds: (nodeIds) => set({ selectedNodeIds: nodeIds }),
  undo: () => {
    const { past, nodes, edges, future } = get();
    const previous = past[past.length - 1];
    if (!previous) return;
    set({
      nodes: previous.nodes,
      edges: previous.edges,
      past: past.slice(0, -1),
      future: [...future, { nodes, edges }],
    });
  },
  redo: () => {
    const { future, nodes, edges, past } = get();
    const next = future[future.length - 1];
    if (!next) return;
    set({
      nodes: next.nodes,
      edges: next.edges,
      future: future.slice(0, -1),
      past: [...past, { nodes, edges }],
    });
  },
  loadSampleWorkflow: () => {
    const n1 = createNode("uploadImage", 80, 80);
    n1.data.imageUrl = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop";
    const n2 = createNode("cropImage", 360, 80);
    const n3 = createNode("text", 80, 320);
    n3.data.textValue = "You are a professional marketing copywriter. Generate a compelling one-paragraph product description.";
    const n4 = createNode("text", 80, 470);
    n4.data.textValue = "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.";
    const n5 = createNode("llm", 640, 200);
    const n6 = createNode("uploadVideo", 80, 650);
    n6.data.videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
    const n7 = createNode("extractFrame", 360, 650);
    const n8 = createNode("text", 640, 560);
    "You are a social media manager. Create a tweet-length marketing post based on the product image and video frame.";

    const edges: Edge[] = [
      { id: nanoid(), source: n1.id, target: n2.id, sourceHandle: "output_image", targetHandle: "image_url", type: "smoothstep", animated: true, style: { stroke: "#8b5cf6" } },
      { id: nanoid(), source: n2.id, target: n5.id, sourceHandle: "output_image", targetHandle: "images", type: "smoothstep", animated: true, style: { stroke: "#8b5cf6" } },
      { id: nanoid(), source: n3.id, target: n5.id, sourceHandle: "output", targetHandle: "system_prompt", type: "smoothstep", animated: true, style: { stroke: "#8b5cf6" } },
      { id: nanoid(), source: n4.id, target: n5.id, sourceHandle: "output", targetHandle: "user_message", type: "smoothstep", animated: true, style: { stroke: "#8b5cf6" } },
      { id: nanoid(), source: n6.id, target: n7.id, sourceHandle: "output_video", targetHandle: "video_url", type: "smoothstep", animated: true, style: { stroke: "#8b5cf6" } },
    ];

    set((state) => ({ ...pushHistory(state), nodes: [n1, n2, n3, n4, n5, n6, n7, n8], edges }));
  },
}));