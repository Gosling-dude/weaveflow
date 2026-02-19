"use client";

import Image from "next/image";
import type { NodeProps } from "@xyflow/react";
import { useNodeConnections } from "@xyflow/react";
import { NodeShell } from "./node-shell";
import { useWorkflowStore, type WorkflowNodeData } from "@/store/workflow-store";

type WorkflowNodeProps = NodeProps & { id: string; data: WorkflowNodeData };

export function CropImageNode({ id, data }: WorkflowNodeProps) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const xConnected = useNodeConnections({ handleType: "target", id: "x_percent" }).length > 0;
  const yConnected = useNodeConnections({ handleType: "target", id: "y_percent" }).length > 0;
  const widthConnected = useNodeConnections({ handleType: "target", id: "width_percent" }).length > 0;
  const heightConnected = useNodeConnections({ handleType: "target", id: "height_percent" }).length > 0;

  return (
    <NodeShell
      id={id}
      title="Crop Image"
      inputs={[
        { id: "image_url" },
        { id: "x_percent" },
        { id: "y_percent" },
        { id: "width_percent" },
        { id: "height_percent" },
      ]}
      outputs={[{ id: "output_image", label: "image" }]}
      running={data.running}
    >
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input w-full"
          disabled={xConnected}
          value={data.crop?.xPercent ?? "0"}
          onChange={(event) => updateNodeData(id, { crop: { ...(data.crop ?? { xPercent: "0", yPercent: "0", widthPercent: "100", heightPercent: "100" }), xPercent: event.target.value } })}
          placeholder="x%"
        />
        <input
          className="input"
          disabled={yConnected}
          value={data.crop?.yPercent ?? "0"}
          onChange={(event) => updateNodeData(id, { crop: { ...(data.crop ?? { xPercent: "0", yPercent: "0", widthPercent: "100", heightPercent: "100" }), yPercent: event.target.value } })}
          placeholder="y%"
        />
        <input
          className="input"
          disabled={widthConnected}
          value={data.crop?.widthPercent ?? "100"}
          onChange={(event) =>
            updateNodeData(id, { crop: { ...(data.crop ?? { xPercent: "0", yPercent: "0", widthPercent: "100", heightPercent: "100" }), widthPercent: event.target.value } })
          }
          placeholder="width%"
        />
        <input
          className="input"
          disabled={heightConnected}
          value={data.crop?.heightPercent ?? "100"}
          onChange={(event) =>
            updateNodeData(id, { crop: { ...(data.crop ?? { xPercent: "0", yPercent: "0", widthPercent: "100", heightPercent: "100" }), heightPercent: event.target.value } })
          }
          placeholder="height%"
        />
      </div>
      {data.imageUrl ? (
        <div className="relative h-32 rounded-md overflow-hidden border border-slate-700">
          <Image src={data.imageUrl} fill alt="Cropped" className="object-cover" />
        </div>
      ) : null}
    </NodeShell>
  );
}