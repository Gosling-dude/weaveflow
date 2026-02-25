"use client";

import { Search, Type, ImageUp, Video, Bot, Crop, Frame } from "lucide-react";
import { useState } from "react";
import { useWorkflowStore, type WorkflowNodeData } from "@/store/workflow-store";

const items: Array<{ title: string; type: WorkflowNodeData["type"]; icon: React.ComponentType<{ className?: string }> }> = [
  { title: "Search", type: "text", icon: Search },
  { title: "Text Node", type: "text", icon: Type },
  { title: "Upload Image", type: "uploadImage", icon: ImageUp },
  { title: "Upload Video", type: "uploadVideo", icon: Video },
  { title: "Run LLM", type: "llm", icon: Bot },
  { title: "Crop Image", type: "cropImage", icon: Crop },
  { title: "Extract Frame", type: "extractFrame", icon: Frame },
];

export default function LeftSidebar() {
  const addNode = useWorkflowStore((state) => state.addNode);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  return (
    <aside className="panel w-[60px] min-w-[60px] h-full border-r border-[#27272A] p-2 flex flex-col items-center gap-2 z-10 bg-[#09090B]">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isActive = activeIdx === idx;
        return (
          <button
            key={item.title}
            title={item.title}
            className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#27272A] transition-colors group"
            onClick={() => {
              if (item.type !== "text" || item.title === "Text Node") addNode(item.type);
              setActiveIdx(idx);
            }}
          >
            {isActive && (
              <div className="absolute left-[-8px] w-1 h-5 bg-[#A855F7] rounded-r-md" />
            )}
            <Icon className={`size-5 transition-opacity ${isActive ? "text-[#A855F7] opacity-100" : "text-white opacity-60 group-hover:opacity-100"}`} />
          </button>
        );
      })}
    </aside>
  );
}