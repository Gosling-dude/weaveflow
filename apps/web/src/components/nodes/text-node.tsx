"use client";

import type { NodeProps } from "@xyflow/react";
import { NodeShell } from "./node-shell";
import { useWorkflowStore, type WorkflowNodeData } from "@/store/workflow-store";

type WorkflowNodeProps = NodeProps & { id: string; data: WorkflowNodeData };

export function TextNode({ id, data }: WorkflowNodeProps) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  return (
    <NodeShell id={id} title="Text Node" outputs={[{ id: "output", label: "text" }]}>
      <textarea
        className="input w-full min-h-24 resize-y"
        value={data.textValue ?? ""}
        onChange={(event) => updateNodeData(id, { textValue: event.target.value })}
        placeholder="Enter text..."
      />
    </NodeShell>
  );
}
