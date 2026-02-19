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
    <aside className="panel w-[360px] min-w-[320px] max-w-[380px] h-full border-l border-slate-800 p-3 overflow-auto">
      <div className="text-sm font-semibold mb-3">Workflow History</div>
      <div className="space-y-2">
        {runs.map((run) => (
          <div key={run.id} className="panel rounded-lg p-2">
            <button className="w-full text-left" onClick={() => setExpandedRunId((current) => (current === run.id ? null : run.id))}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-300">{new Date(run.startedAt).toLocaleString()}</div>
                <span className={`text-[10px] px-2 py-0.5 rounded border ${badgeClass(run.status)}`}>{run.status}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {run.type} • {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
              </div>
            </button>
            {expandedRunId === run.id ? (
              <div className="mt-2 border-t border-slate-800 pt-2 space-y-1">
                {run.nodes.map((node) => (
                  <div key={node.id} className="text-xs rounded-md border border-slate-800 p-2">
                    <div className="flex items-center justify-between">
                      <span>{node.nodeId}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeClass(node.status)}`}>{node.status}</span>
                    </div>
                    <div className="text-slate-400 mt-1">{node.durationMs ? `${(node.durationMs / 1000).toFixed(2)}s` : "—"}</div>
                    {node.error ? <div className="text-red-300 mt-1">{node.error}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
}