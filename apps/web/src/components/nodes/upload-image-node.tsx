"use client";

import Image from "next/image";
import type { NodeProps } from "@xyflow/react";
import { NodeShell } from "./node-shell";
import { useWorkflowStore, type WorkflowNodeData } from "@/store/workflow-store";

type WorkflowNodeProps = NodeProps & { id: string; data: WorkflowNodeData };

export function UploadImageNode({ id, data }: WorkflowNodeProps) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  return (
    <NodeShell id={id} title="Upload Image" outputs={[{ id: "output_image", label: "image" }]}>
      <input
        className="input w-full"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch("/api/uploads/image", { method: "POST", body: formData });
          if (!response.ok) return;
          const payload = (await response.json()) as { url: string };
          updateNodeData(id, { imageUrl: payload.url });
        }}
      />
      {data.imageUrl ? (
        <div className="relative h-36 rounded-md overflow-hidden border border-slate-700">
          <Image src={data.imageUrl} fill alt="Uploaded" className="object-cover" />
        </div>
      ) : null}
    </NodeShell>
  );
}