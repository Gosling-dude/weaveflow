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

// Map title to exact Weavy Accent colors
const getAccentColor = (title: string) => {
  if (title.includes("LLM")) return "bg-[#A855F7]"; // Purple
  if (title.includes("Image") || title.includes("Video") || title.includes("Frame")) return "bg-[#3B82F6]"; // Blue
  return "bg-[#22C55E]"; // Green for text/others
};

export function NodeShell({ id, title, children, outputs = [{ id: "output" }], inputs = [], running }: Props) {
  const accentStr = getAccentColor(title);

  return (
    <div className={`relative min-w-[320px] rounded-xl bg-[#18181B] border border-[#27272A] p-4 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.5),0_4px_6px_-4px_rgba(0,0,0,0.5)] transition-shadow hover:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.6),0_8px_10px_-6px_rgba(0,0,0,0.6)] ${running ? "running-glow" : ""}`}>
      {/* Top Accent Line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-xl ${accentStr}`} />

      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#27272A] mt-1">
        <div className={`size-2.5 rounded-sm ${running ? "bg-[#22C55E] animate-pulse" : accentStr}`} />
        <div className="font-semibold text-sm text-[#FFFFFF]">{title}</div>
      </div>

      <div className="space-y-3 relative z-10">{children}</div>

      {inputs.map((input, idx) => (
        <div key={input.id}>
          <Handle type="target" id={input.id} position={Position.Left} className="!w-3 !h-3 !bg-[#3F3F46] !border-2 !border-[#18181B] transition-transform hover:scale-125 focus:!bg-[#A855F7]" style={{ top: 56 + idx * 32 }} />
          {input.label ? <span className="text-[11px] uppercase font-semibold text-[#71717A] absolute -left-24 text-right w-20" style={{ top: 51 + idx * 32 }}>{input.label}</span> : null}
        </div>
      ))}
      {outputs.map((output, idx) => (
        <div key={output.id}>
          <Handle type="source" id={output.id} position={Position.Right} className="!w-3 !h-3 !bg-[#A855F7] !border-2 !border-[#18181B] transition-transform hover:scale-125" style={{ top: 56 + idx * 32 }} />
          {output.label ? <span className="text-[11px] uppercase font-semibold text-[#71717A] absolute -right-24 text-left w-20" style={{ top: 51 + idx * 32 }}>{output.label}</span> : null}
        </div>
      ))}

      {inputs.length ? <div className="mt-4 pt-3 border-t border-[#27272A] text-[11px] text-[#71717A] text-center font-medium">Connected values override manual fields</div> : null}
    </div>
  );
}