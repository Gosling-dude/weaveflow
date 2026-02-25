"use client";

import { useEffect, useState } from "react";

type RunNode = {
  id: string;
  nodeId: string;
  status: "running" | "success" | "failed";
  inputs: unknown;
  outputs: unknown;
  error: string | null;
  durationMs: number | null;
};

type Run = {
  id: string;
  type: "full" | "single" | "partial";
  status: "running" | "success" | "failed" | "partial";
  startedAt: string;
  durationMs: number | null;
  nodes: RunNode[];
};

function badgeClass(status: Run["status"] | RunNode["status"]) {
  if (status === "success") return "bg-green-500/20 text-green-300 border-green-400/30";
  if (status === "failed") return "bg-red-500/20 text-red-300 border-red-400/30";
  if (status === "running") return "bg-yellow-500/20 text-yellow-300 border-yellow-400/30";
  return "bg-slate-500/20 text-slate-300 border-slate-400/30";
}

export default function HistorySidebar() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    const loadRuns = async () => {
      const response = await fetch("/api/runs", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { runs: Run[] };
      setRuns(payload.runs);
    };
    loadRuns();
    const intervalId = setInterval(loadRuns, 4000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <aside className="panel w-[320px] min-w-[320px] max-w-[320px] h-full border-l border-[#27272A] p-4 flex flex-col z-10 bg-[#09090B] overflow-auto">
      <div className="text-[13px] font-semibold text-[#FFFFFF] mb-4 pb-3 border-b border-[#27272A]">Workflow History</div>
      <div className="space-y-3">
        {runs.map((run) => (
          <div key={run.id} className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden hover:border-[#3F3F46] transition-colors duration-200">
            <button
              className="w-full text-left p-3 hover:bg-[#27272A] transition-colors"
              onClick={() => setExpandedRunId((current) => (current === run.id ? null : run.id))}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-medium text-[#FFFFFF]">
                  {new Date(run.startedAt).toLocaleString()}
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${badgeClass(run.status)}`}>
                  {run.status}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-[#A1A1AA]">
                <span className="capitalize">{run.type} Run</span>
                <span>{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}</span>
              </div>
            </button>
            {expandedRunId === run.id ? (
              <div className="border-t border-[#27272A] bg-[#000000] p-3 space-y-2">
                {run.nodes.map((node) => (
                  <div key={node.id} className="text-xs rounded-md border border-[#27272A] bg-[#18181B] p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[11px] text-[#A1A1AA] truncate pr-2">{node.nodeId}</span>
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${badgeClass(node.status)}`}>
                        {node.status}
                      </span>
                    </div>
                    <div className="text-[#71717A] text-[11px] tabular-nums mt-1.5">
                      {node.durationMs ? `${(node.durationMs / 1000).toFixed(2)}s` : "—"}
                    </div>
                    {node.error ? <div className="text-[#EF4444] mt-2 bg-red-950/30 p-2 rounded border border-red-900/50 break-words">{node.error}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {runs.length === 0 ? (
          <div className="text-center text-[13px] text-[#71717A] mt-8">No runs found.</div>
        ) : null}
      </div>
    </aside>
  );
}