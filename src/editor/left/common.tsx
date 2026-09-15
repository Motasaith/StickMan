import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { useStore } from "@/store";
import { uniqueId } from "@/engine/scene";

export function PanelHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="border-b border-line px-4 pb-3 pt-4">
      <p className="font-display text-[15px] font-semibold">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, onEnter }: { value: string; onChange: (v: string) => void; placeholder: string; onEnter?: () => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input className="text-input pl-8" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onEnter?.()} />
    </div>
  );
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="eyebrow mb-2 mt-4 first:mt-0">{children}</p>;
}

/** Run a create op built for the playhead time and a fresh id, then select what it made. */
export function addAt(base: string, make: (id: string, at: number, s: ReturnType<typeof useStore.getState>) => Record<string, unknown> | Record<string, unknown>[]) {
  const s = useStore.getState();
  const id = uniqueId(s.scene, base.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 24) || "item");
  const at = Math.round(s.time * 100) / 100;
  const made = make(id, at, s);
  const ops = Array.isArray(made) ? made : [made];
  const results = s.run(ops);
  const bad = results.find((r) => !r.ok);
  if (bad) {
    void import("sonner").then(({ toast }) => toast.error("Couldn't add that", { description: bad.message }));
    return;
  }
  const after = useStore.getState();
  if (after.scene.objects.some((o) => o.id === id)) {
    after.select(id);
    after.setMode("edit");
  }
}

/** Where in the frame new things go: the middle, nudged so repeats don't stack exactly. */
export function spot(s: ReturnType<typeof useStore.getState>, w: number, h: number) {
  const n = s.scene.objects.length % 5;
  return { x: s.scene.width / 2 - w / 2 + (n - 2) * 110, y: s.scene.height / 2 - h / 2 + (n - 2) * 40 };
}
