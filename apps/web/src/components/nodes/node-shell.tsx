"use client";

import { Handle, Position } from "@xyflow/react";

type Props = {
  id: string;
  title: string;
  running?: boolean;
  children: React.ReactNode;
  outputs?: Array<{ id: string; label?: string }>;
  inputs?: Array<{ id: string; label?: string }>;
};

export function NodeShell({ id, title, children, outputs = [{ id: "output" }], inputs = [], running }: Props) {
  return (
    <div className={`panel min-w-[290px] rounded-xl p-3 ${running ? "running-glow" : ""}`}>
      <div className="font-medium text-sm mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
      {inputs.map((input, idx) => (
        <div key={input.id}>
          <Handle type="target" id={input.id} position={Position.Left} style={{ top: 36 + idx * 28, background: "#6366f1" }} />
          {input.label ? <span className="text-[10px] text-slate-400 absolute -left-20" style={{ top: 31 + idx * 28 }}>{input.label}</span> : null}
        </div>
      ))}
      {outputs.map((output, idx) => (
        <div key={output.id}>
          <Handle type="source" id={output.id} position={Position.Right} style={{ top: 36 + idx * 28, background: "#8b5cf6" }} />
          {output.label ? <span className="text-[10px] text-slate-400 absolute -right-20" style={{ top: 31 + idx * 28 }}>{output.label}</span> : null}
        </div>
      ))}
      {inputs.length ? <div className="mt-2 text-[10px] text-slate-400">Connected input values override manual fields.</div> : null}
    </div>
  );
}