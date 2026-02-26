"use client";

import type { NodeProps } from "@xyflow/react";
import { NodeShell } from "./node-shell";
import type { WorkflowNodeData } from "@/store/workflow-store";
import { useMemo } from "react";

type WorkflowNodeProps = NodeProps & { id: string; data: WorkflowNodeData };

export function OutputNode({ id, data }: WorkflowNodeProps) {
    const placeholder = useMemo(() => (data.running ? "Awaiting result..." : "Final output will appear here"), [data.running]);

    return (
        <NodeShell
            id={id}
            title="Workflow Output"
            inputs={[{ id: "output", label: "any" }]}
            outputs={[]}
            running={data.running}
        >
            <div className="input w-full min-h-24 text-sm whitespace-pre-wrap">
                {data.result || placeholder}
            </div>
            {data.error ? <div className="text-xs text-red-400">{data.error}</div> : null}
        </NodeShell>
    );
}
