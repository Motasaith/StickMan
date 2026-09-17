import { useMemo, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ILLUSTRATIONS, ILLUSTRATION_CATEGORIES, type Illustration } from "@/engine/illustrations";
import { useStore } from "@/store";
import { uniqueId } from "@/engine/scene";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PanelHeader, SearchBox, addAt } from "./common";

export function IllustrationsTab() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [topic, setTopic] = useState("");
  const [drawing, setDrawing] = useState(false);
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return ILLUSTRATIONS.filter((i) => (cat === "all" || i.category === cat) && words.every((w) => `${i.id} ${i.name} ${i.tags}`.toLowerCase().includes(w)));
  }, [q, cat]);

  const add = (ill: Illustration) =>
    addAt(ill.id, (id, at, s) => {
      const size = Math.round(Math.min(s.scene.width, s.scene.height) * 0.5);
      return { op: "illustration", id, name: ill.id, x: s.scene.width / 2 - size / 2, y: s.scene.height / 2 - size / 2, w: size, h: size, at, enter: "pop" };
    });

  const draw = async () => {
    const t = topic.trim();
    if (!t) return;
    setDrawing(true);
    try {
      const out = await api.illustrate(t);
      const s = useStore.getState();
      const assetId = uniqueId(s.scene, `ai_${out.name}`.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 30));
      addAt(out.name, (id, at, st) => {
        const size = Math.round(Math.min(st.scene.width, st.scene.height) * 0.5);
        return [
          { op: "svgAsset", id: assetId, name: out.name, svg: out.svg },
          { op: "svg", id, name: out.name, svg: out.svg, x: st.scene.width / 2 - size / 2, y: st.scene.height / 2 - size / 2, w: size, h: size, at, enter: "pop" },
        ];
      });
      setTopic("");
      toast.success(`Drew "${out.name}"`, { description: "It's in your media library too." });
    } catch (err) {
      toast.error("The AI couldn't draw that", { description: (err as Error).message });
    } finally {
      setDrawing(false);
    }
  };

  return (
    <>
      <PanelHeader title="Illustrations" subtitle={`${ILLUSTRATIONS.length} animated drawings for slides and explainers.`}>
        <form
          className="mb-3 rounded-lg border border-primary/40 bg-primary/[0.06] p-2"
          onSubmit={(e) => {
            e.preventDefault();
            void draw();
          }}
        >
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> Draw with AI
            <span className="font-normal text-muted-foreground">(about a minute)</span>
          </p>
          <div className="flex gap-1.5">
            <input data-ai-draw className="field-text min-w-0 flex-1" value={topic} placeholder="a dentist chair with a lamp" onChange={(e) => setTopic(e.target.value)} />
            <Button type="submit" size="sm" className="h-8 shrink-0 gap-1" disabled={drawing || !topic.trim()} title="Draw a new animated illustration">
              {drawing ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} {drawing ? "Drawing" : "Draw"}
            </Button>
          </div>
        </form>
        <SearchBox value={q} onChange={setQ} placeholder="Search: teeth, growth, rocket…" />
        <div className="mt-2 flex flex-wrap gap-1">
          {["all", ...ILLUSTRATION_CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn("chip h-6 px-2 text-[11px] capitalize", cat === c && "border-primary text-primary")}>
              {c}
            </button>
          ))}
        </div>
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="grid grid-cols-3 gap-2">
          {list.map((ill) => (
            <button key={ill.id} title={ill.name} onClick={() => add(ill)} className="group flex flex-col items-center rounded-lg border border-line bg-[#f3f0e8] p-1.5 transition hover:border-primary">
              <img src={`/illustrations/${ill.id}.svg`} alt={ill.name} className="aspect-square w-full transition group-hover:scale-105" loading="lazy" />
              <span className="mt-1 w-full truncate text-center text-[10px] text-[#3a3a34]">{ill.name}</span>
            </button>
          ))}
        </div>
        {list.length === 0 && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Nothing in the library matches.</p>
            {q.trim() && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-primary/40 text-primary"
                onClick={() => {
                  setTopic(q.trim());
                  requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-ai-draw]")?.focus());
                }}
              >
                <Sparkles className="size-3.5" /> Draw "{q.trim().slice(0, 30)}" with AI
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
