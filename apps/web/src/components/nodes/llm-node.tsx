"use client";

import { useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { useNodeConnections } from "@xyflow/react";
import { NodeShell } from "./node-shell";
import { useWorkflowStore, type WorkflowNodeData } from "@/store/workflow-store";

const models = ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"];

type WorkflowNodeProps = NodeProps & { id: string; data: WorkflowNodeData };

export function LlmNode({ id, data }: WorkflowNodeProps) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const [expanded, setExpanded] = useState(true);
  const systemConnected = useNodeConnections({ handleType: "target", id: "system_prompt" }).length > 0;
  const userConnected = useNodeConnections({ handleType: "target", id: "user_message" }).length > 0;
  const placeholder = useMemo(() => (data.running ? "Running via Trigger.dev..." : "Response appears here"), [data.running]);

  return (
    <NodeShell
      id={id}
      title="Run Any LLM"
      inputs={[{ id: "system_prompt" }, { id: "user_message" }, { id: "images" }]}
      outputs={[{ id: "output", label: "text" }]}
      running={data.running}
    >
      <select className="input w-full" value={data.model ?? "gemini-2.0-flash"} onChange={(event) => updateNodeData(id, { model: event.target.value })}>
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      <textarea
        className="input w-full min-h-16"
        disabled={systemConnected}
        value={data.systemPrompt ?? ""}
        onChange={(event) => updateNodeData(id, { systemPrompt: event.target.value })}
        placeholder="System prompt (optional)"
      />
      <textarea
        className="input w-full min-h-16"
        disabled={userConnected}
        value={data.userMessage ?? ""}
        onChange={(event) => updateNodeData(id, { userMessage: event.target.value })}
        placeholder="User message"
      />
      <button
        className="button w-full"
        disabled={data.running}
        onClick={async () => {
          await fetch(`/api/nodes/${id}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeIds: [id], nodes, edges }),
          });
        }}
      >
        Run Node
      </button>
      <button className="button w-full" disabled={data.running} onClick={() => setExpanded((current) => !current)}>
        {expanded ? "Hide result" : "Show result"}
      </button>
      {expanded ? <div className="input w-full min-h-24 text-sm whitespace-pre-wrap">{data.result || placeholder}</div> : null}
      {data.error ? <div className="text-xs text-red-400">{data.error}</div> : null}
    </NodeShell>
  );
}