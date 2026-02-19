"use client";

import Image from "next/image";
import type { NodeProps } from "@xyflow/react";
import { useNodeConnections } from "@xyflow/react";
import { NodeShell } from "./node-shell";
import { useWorkflowStore, type WorkflowNodeData } from "@/store/workflow-store";

type WorkflowNodeProps = NodeProps & { id: string; data: WorkflowNodeData };

export function ExtractFrameNode({ id, data }: WorkflowNodeProps) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const timestampConnected = useNodeConnections({ handleType: "target", id: "timestamp" }).length > 0;

  return (
    <NodeShell
      id={id}
      title="Extract Frame from Video"
      inputs={[{ id: "video_url" }, { id: "timestamp" }]}
      outputs={[{ id: "output_image", label: "image" }]}
      running={data.running}
    >
      <input
        className="input w-full"
        disabled={timestampConnected}
        value={data.timestamp ?? "0"}
        onChange={(event) => updateNodeData(id, { timestamp: event.target.value })}
        placeholder="0 or 50%"
      />
      {data.imageUrl ? (
        <div className="relative h-32 rounded-md overflow-hidden border border-slate-700">
          <Image src={data.imageUrl} fill alt="Frame" className="object-cover" />
        </div>
      ) : null}
    </NodeShell>
  );
}