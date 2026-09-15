import { useState } from "react";
import { BarChart3, CheckSquare, Columns2, Hash, Image as ImageIcon, ListOrdered, Presentation, Quote, Sparkles, SplitSquareHorizontal, Type, X } from "lucide-react";
import { THEMES } from "@/engine/themes";
import type { Slide } from "@/engine/scene";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { drawBackgroundCss } from "../backgroundCss";
import { PanelHeader, GroupLabel } from "./common";

const LAYOUTS = [
  { layout: "title", label: "Title", icon: Presentation, spec: { title: "Your big idea", subtitle: "A short subtitle", illustration: "lightbulb" } },
  { layout: "bullets", label: "Points", icon: ListOrdered, spec: { title: "Three key points", bullets: ["The first point", "The second point", "The third point"], illustration: "checklist" } },
  { layout: "split", label: "Picture + text", icon: SplitSquareHorizontal, spec: { title: "A closer look", body: "Explain the idea in one or two sentences.", illustration: "magnifier" } },
  { layout: "illustration", label: "Big picture", icon: ImageIcon, spec: { title: "Picture this", illustration: "rocket", body: "One sentence about it." } },
  { layout: "stat", label: "Big number", icon: Hash, spec: { title: "Did you know?", stat: { value: 75, label: "of people agree", suffix: "%" } } },
  { layout: "chart", label: "Chart", icon: BarChart3, spec: { title: "Growth over time", chart: { kind: "bar", data: [{ label: "2022", value: 20 }, { label: "2023", value: 45 }, { label: "2024", value: 70 }] } } },
  { layout: "steps", label: "Steps", icon: CheckSquare, spec: { title: "How it works", steps: ["Plan", "Build", "Launch"] } },
  { layout: "comparison", label: "Compare", icon: Columns2, spec: { title: "Before and after", comparison: { leftTitle: "Do", left: ["Something good", "Another good thing"], rightTitle: "Don't", right: ["Something bad", "Another bad thing"] } } },
  { layout: "quote", label: "Quote", icon: Quote, spec: { quote: { text: "The best way to predict the future is to create it.", author: "Peter Drucker" } } },
  { layout: "section", label: "Section", icon: Type, spec: { title: "Part two" } },
  { layout: "closing", label: "Closing", icon: Sparkles, spec: { title: "Thank you!", subtitle: "Questions?", illustration: "happyface" } },
] as const;

// A shared empty list: a new [] from the selector would re-render forever.
const NO_SLIDES: Slide[] = [];

export function SlidesTab() {
  const slides = useStore((s) => s.scene.slides ?? NO_SLIDES);
  const theme = useStore((s) => s.scene.theme ?? "clean");
  const selectedId = useStore((s) => s.selectedId);
  const time = useStore((s) => s.time);
  const [narrate, setNarrate] = useState(true);

  const add = (l: (typeof LAYOUTS)[number]) => {
    const s = useStore.getState();
    const narration = narrate ? `This slide is about ${"title" in l.spec && l.spec.title ? l.spec.title.toLowerCase() : "an important idea"}.` : undefined;
    s.run([{ op: "slide", layout: l.layout, ...l.spec, narration, theme }]);
    const last = useStore.getState().scene.slides?.at(-1);
    if (last) {
      useStore.getState().select(`slide:${last.id}`);
      useStore.getState().setMode("edit");
      useStore.getState().setTime(last.start + last.duration * 0.6);
    }
  };

  return (
    <>
      <PanelHeader title="Slides" subtitle="Designed slides with animated entrances, narration and captions. Or ask the AI Director for a whole presentation." />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <GroupLabel>Theme</GroupLabel>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => useStore.getState().run([{ op: "theme", theme: t.id }])}
              className={cn("overflow-hidden rounded-lg border text-left transition", theme === t.id ? "border-primary ring-1 ring-primary" : "border-line hover:border-primary/60")}
            >
              <div className="relative flex h-12 items-end gap-1 p-1.5" style={{ background: drawBackgroundCss(t.cover) }}>
                <span className="h-1.5 w-8 rounded" style={{ background: t.coverText }} />
                <span className="ml-auto size-3 rounded-full" style={{ background: t.accent2 }} />
              </div>
              <div className="px-2 py-1 text-[11px]">{t.label}</div>
            </button>
          ))}
        </div>

        <GroupLabel>Add a slide</GroupLabel>
        <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={narrate} onChange={(e) => setNarrate(e.target.checked)} /> Add narration (edit the script in the slide panel)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {LAYOUTS.map((l) => (
            <button key={l.layout} className="tile h-16" onClick={() => add(l)}>
              <l.icon className="size-5 text-foreground" />
              {l.label}
            </button>
          ))}
        </div>

        {slides.length > 0 && (
          <>
            <GroupLabel>This presentation ({slides.length})</GroupLabel>
            <div className="flex flex-col gap-1.5">
              {slides.map((sl, i) => {
                const active = time >= sl.start && time < sl.start + sl.duration;
                return (
                  <div
                    key={sl.id}
                    className={cn("group flex cursor-pointer items-center gap-2 rounded-lg border p-1.5 transition", selectedId === `slide:${sl.id}` ? "border-primary" : active ? "border-line bg-accent" : "border-line hover:bg-accent")}
                    onClick={() => {
                      const s = useStore.getState();
                      s.setPlaying(false);
                      s.setTime(sl.start + Math.min(sl.duration * 0.7, 3));
                      s.select(`slide:${sl.id}`);
                      s.setMode("edit");
                    }}
                  >
                    <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white" style={{ background: drawBackgroundCss(sl.background) }}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{sl.title}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {sl.layout} · {sl.duration.toFixed(1)}s
                      </p>
                    </div>
                    <button
                      className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                      title="Remove slide"
                      onClick={(e) => {
                        e.stopPropagation();
                        useStore.getState().run([{ op: "removeSlide", id: sl.id }]);
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
