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
    try {
      const selectedIds = reactFlow.getNodes().filter((node) => node.selected).map((node) => node.id);
      const response = await fetch("/api/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          nodeIds: scope === "full" ? undefined : selectedIds,
          workflowId: workflowId ?? undefined,
          nodes,
          edges,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error("Workflow run failed:", err);
        alert(`Failed to start run: ${err.error ? JSON.stringify(err.error) : "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to start workflow run");
    }
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
    <div className="absolute top-0 left-0 right-0 h-[56px] z-50 flex items-center justify-between px-4 bg-[#09090B] border-b border-[#18181B]">
      <div className="flex items-center gap-4">
        <input
          className="bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-1.5 text-sm text-white font-medium focus:outline-none focus:border-[#A855F7] transition-colors w-64 placeholder:text-[#71717A]"
          placeholder="Untitled Project"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="flex items-center gap-2">
          <button className="text-xs font-semibold text-[#A1A1AA] hover:text-white transition-colors px-2 py-1 cursor-pointer" onClick={() => void saveWorkflow()}>
            Save
          </button>
          <button className="text-xs font-semibold text-[#A1A1AA] hover:text-white transition-colors px-2 py-1 cursor-pointer" onClick={undo}>
            Undo
          </button>
          <button className="text-xs font-semibold text-[#A1A1AA] hover:text-white transition-colors px-2 py-1 cursor-pointer" onClick={redo}>
            Redo
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="text-xs font-semibold text-[#A1A1AA] hover:text-white transition-colors px-2 py-1 cursor-pointer" onClick={loadSampleWorkflow}>
          Load Sample
        </button>
        <button className="text-xs font-semibold text-[#A1A1AA] hover:text-white transition-colors px-2 py-1 cursor-pointer" onClick={exportJson}>
          Export
        </button>
        <label className="text-xs font-semibold text-[#A1A1AA] hover:text-white transition-colors px-2 py-1 cursor-pointer">
          Import
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

        <div className="w-[1px] h-4 bg-[#27272A] mx-1" />

        <button className="button py-1.5 px-3 bg-[#18181B] border-[#27272A] hover:bg-[#27272A]" onClick={() => runWorkflow("partial")}>
          Run Selected
        </button>
        <button className="button py-1.5 px-3 bg-[#A855F7] border-[#9333EA] text-white hover:bg-[#9333EA]" onClick={() => runWorkflow("full")}>
          Run Workflow
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <LeftSidebar />
      <div className="flex-1 relative bg-[#000000]">
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
          defaultEdgeOptions={{ animated: false, style: { stroke: "#3F3F46", strokeWidth: 2 }, type: "smoothstep" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1F1F1F" />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            className="!bg-[#09090B] !border !border-[#27272A] !rounded-lg overflow-hidden shadow-lg mb-4 mr-4"
            maskColor="rgba(0, 0, 0, 0.7)"
            nodeColor={(n) => n.data.running ? "#22C55E" : "#18181B"}
          />
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