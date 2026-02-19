"use client";

import { Search, Type, ImageUp, Video, Bot, Crop, Frame } from "lucide-react";
import { useMemo, useState } from "react";
import { useWorkflowStore, type WorkflowNodeData } from "@/store/workflow-store";

const items: Array<{ label: string; type: WorkflowNodeData["type"]; icon: React.ComponentType<{ className?: string }> }> = [
  { label: "Text Node", type: "text", icon: Type },
  { label: "Upload Image Node", type: "uploadImage", icon: ImageUp },
  { label: "Upload Video Node", type: "uploadVideo", icon: Video },
  { label: "Run Any LLM Node", type: "llm", icon: Bot },
  { label: "Crop Image Node", type: "cropImage", icon: Crop },
  { label: "Extract Frame from Video Node", type: "extractFrame", icon: Frame },
];

export default function LeftSidebar() {
  const [query, setQuery] = useState("");
  const addNode = useWorkflowStore((state) => state.addNode);
  const filtered = useMemo(() => items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <aside className="panel w-[280px] min-w-[250px] h-full border-r border-slate-800 p-3 overflow-auto">
      <div className="relative mb-3">
        <Search className="size-4 absolute top-2.5 left-2.5 text-slate-400" />
        <input className="input w-full pl-8" placeholder="Search nodes" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Quick Access</div>
      <div className="space-y-2">
        {filtered.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} className="button w-full flex items-center gap-2" onClick={() => addNode(item.type)}>
              <Icon className="size-4" />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}