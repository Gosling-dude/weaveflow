"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import LeftSidebar from "./left-sidebar";
import HistorySidebar from "./history-sidebar";
import { TextNode } from "@/components/nodes/text-node";
import { UploadImageNode } from "@/components/nodes/upload-image-node";
import { UploadVideoNode } from "@/components/nodes/upload-video-node";
import { CropImageNode } from "@/components/nodes/crop-image-node";
import { ExtractFrameNode } from "@/components/nodes/extract-frame-node";
import { LlmNode } from "@/components/nodes/llm-node";
import { useWorkflowStore } from "@/store/workflow-store";

const nodeTypes: NodeTypes = {
  text: TextNode,
  uploadImage: UploadImageNode,
  uploadVideo: UploadVideoNode,
  cropImage: CropImageNode,
  extractFrame: ExtractFrameNode,
  llm: LlmNode,
};

function EditorContent() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const deleteSelection = useWorkflowStore((state) => state.deleteSelection);
  const setSelectedNodeIds = useWorkflowStore((state) => state.setSelectedNodeIds);
  const loadSampleWorkflow = useWorkflowStore((state) => state.loadSampleWorkflow);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [title, setTitle] = useState("Product Marketing Kit Generator");
  const reactFlow = useReactFlow();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") undo();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") redo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelection, redo, undo]);

  const saveWorkflow = useCallback(async () => {
    const payload = { title, nodes, edges };
    const url = workflowId ? `/api/workflows/${workflowId}` : "/api/workflows";
    const method = workflowId ? "PUT" : "POST";
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) return;
    const result = (await response.json()) as { id: string };
    setWorkflowId(result.id);
  }, [edges, nodes, title, workflowId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (nodes.length === 0) return;
      void saveWorkflow();
    }, 2000);
    return () => clearTimeout(timeout);
  }, [nodes, edges, saveWorkflow]);

  useEffect(() => {
    const syncLatestRun = async () => {
      const response = await fetch("/api/runs", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        runs: Array<{
          id: string;
          status: "running" | "success" | "failed" | "partial";
          nodes: Array<{
            nodeId: string;
            status: "running" | "success" | "failed";
            outputs: unknown;
            error: string | null;
          }>;
        }>;
      };
      const run = payload.runs[0];
      if (!run) return;
      for (const runNode of run.nodes) {
        const outputContainer =
          typeof runNode.outputs === "object" && runNode.outputs !== null && "output" in runNode.outputs
            ? (runNode.outputs as { output?: unknown }).output
            : undefined;
        const outputText =
          typeof outputContainer === "object" && outputContainer !== null && "text" in outputContainer
            ? (outputContainer as { text?: unknown }).text
            : typeof outputContainer === "string"
              ? outputContainer
              : undefined;
        const outputUrl =
          typeof outputContainer === "object" && outputContainer !== null && "url" in outputContainer
            ? (outputContainer as { url?: unknown }).url
            : undefined;

        updateNodeData(runNode.nodeId, {
          running: runNode.status === "running",
          error: runNode.error ?? undefined,
          result: typeof outputText === "string" ? outputText : undefined,
          imageUrl: typeof outputUrl === "string" ? outputUrl : undefined,
        });
      }
    };

    void syncLatestRun();
    const interval = setInterval(() => {
      void syncLatestRun();
    }, 2000);

    return () => clearInterval(interval);
  }, [updateNodeData]);

  const runWorkflow = async (scope: "full" | "single" | "partial") => {
    const selectedIds = reactFlow.getNodes().filter((node) => node.selected).map((node) => node.id);
    await fetch("/api/workflows/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, nodeIds: scope === "full" ? undefined : selectedIds, workflowId, nodes, edges }),
    });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ title, nodes, edges }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `workflow-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = JSON.parse(String(reader.result)) as { title: string; nodes: typeof nodes; edges: typeof edges };
      useWorkflowStore.getState().setNodes(parsed.nodes);
      useWorkflowStore.getState().setEdges(parsed.edges);
      setTitle(parsed.title ?? "Imported workflow");
    };
    reader.readAsText(file);
  };

  const topBar = (
    <div className="panel absolute top-3 left-3 z-50 rounded-xl p-2 flex items-center gap-2 flex-wrap max-w-full">
      <input className="input w-72" value={title} onChange={(event) => setTitle(event.target.value)} />
      <button className="button" onClick={() => void saveWorkflow()}>
        Save
      </button>
      <button className="button" onClick={() => runWorkflow("full")}>
        Run Workflow
      </button>
      <button className="button" onClick={() => runWorkflow("partial")}>
        Run Selected
      </button>
      <button className="button" onClick={undo}>
        Undo
      </button>
      <button className="button" onClick={redo}>
        Redo
      </button>
      <button className="button" onClick={loadSampleWorkflow}>
        Load Sample
      </button>
      <button className="button" onClick={exportJson}>
        Export JSON
      </button>
      <label className="button cursor-pointer">
        Import JSON
        <input
          className="hidden"
          type="file"
          accept="application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importJson(file);
          }}
        />
      </label>
    </div>
  );

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <LeftSidebar />
      <div className="flex-1 relative">
        {topBar}
        <ReactFlow
          fitView
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={(selection) => setSelectedNodeIds((selection.nodes ?? []).map((node) => node.id))}
          defaultEdgeOptions={{ animated: true, style: { stroke: "#8b5cf6", strokeWidth: 2 }, type: "smoothstep" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#25314f" />
          <MiniMap position="bottom-right" pannable zoomable className="!bg-[#0d1320] !border !border-[#1f2b45]" />
          <Controls />
        </ReactFlow>
      </div>
      <HistorySidebar />
    </div>
  );
}

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <EditorContent />
    </ReactFlowProvider>
  );
}