"use client";

import type { NodeProps } from "@xyflow/react";
import { NodeShell } from "./node-shell";
import { useWorkflowStore, type WorkflowNodeData } from "@/store/workflow-store";

type WorkflowNodeProps = NodeProps & { id: string; data: WorkflowNodeData };

export function UploadVideoNode({ id, data }: WorkflowNodeProps) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  return (
    <NodeShell id={id} title="Upload Video" outputs={[{ id: "output_video", label: "video" }]}>
      <input
        className="input w-full"
        type="file"
        accept=".mp4,.mov,.webm,.m4v"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch("/api/uploads/video", { method: "POST", body: formData });
          if (!response.ok) return;
          const payload = (await response.json()) as { url: string };
          updateNodeData(id, { videoUrl: payload.url });
        }}
      />
      {data.videoUrl ? <video className="w-full rounded-md border border-slate-700" src={data.videoUrl} controls /> : null}
    </NodeShell>
  );
}