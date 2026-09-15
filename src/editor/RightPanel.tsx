import { SlidersHorizontal, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { AIPanel } from "./right/AIPanel";
import { Inspector } from "./right/Inspector";

export function RightPanel() {
  const mode = useStore((s) => s.mode);
  const busy = useStore((s) => s.aiBusy);
  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-line bg-panel xl:w-[410px]">
      <div className="flex shrink-0 gap-1 border-b border-line p-2">
        {(
          [
            { id: "ai", label: "AI Director", icon: Wand2 },
            { id: "edit", label: "Edit", icon: SlidersHorizontal },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => useStore.getState().setMode(m.id)}
            className={cn("flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm transition", mode === m.id ? "bg-panel-raised text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <m.icon className={cn("size-4", mode === m.id && "text-primary")} />
            {m.label}
            {m.id === "ai" && busy && <span className="size-1.5 animate-pulse-dot rounded-full bg-primary" />}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{mode === "ai" ? <AIPanel /> : <Inspector />}</div>
    </aside>
  );
}
