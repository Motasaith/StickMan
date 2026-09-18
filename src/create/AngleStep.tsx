import { useState } from "react";
import { ArrowRight, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, type VideoAngle } from "@/lib/api";
import { briefOf, type Patch, type WizardState } from "@/pages/Create";

const LEVEL: Record<string, { label: string; tone: string }> = {
  low: { label: "Open field", tone: "border-good/60 bg-good/10 text-good" },
  medium: { label: "Some competition", tone: "border-warn/60 bg-warn/10 text-warn" },
  high: { label: "Crowded", tone: "border-destructive/60 bg-destructive/10 text-destructive" },
};

const views = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

export function AngleStep({ state, patch, youtube }: { state: WizardState; patch: Patch; youtube: boolean }) {
  const [busy, setBusy] = useState<"more" | "write" | null>(null);
  const [own, setOwn] = useState(state.angle && !state.angles?.angles.some((a) => a.title === state.angle?.title) ? state.angle.title : "");
  const data = state.angles;

  const more = async () => {
    setBusy("more");
    try {
      patch({ angles: await api.angles(briefOf(state)), angle: null });
    } catch (err) {
      toast.error("Couldn't find more ideas", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const write = async () => {
    const angle = own.trim() ? { title: own.trim() } : state.angle;
    if (!angle) return;
    setBusy("write");
    try {
      const script = await api.writeScript({ ...briefOf(state), angle });
      patch({ script, angle, step: 3 });
    } catch (err) {
      toast.error("Couldn't write the script", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const pick = (a: VideoAngle) => {
    setOwn("");
    patch({ angle: { title: a.title, hook: a.hook } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Stand out</p>
          <h2 className="font-display text-2xl font-semibold">Pick an angle nobody has worn out</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {youtube ? "Competition comes from live YouTube search results." : "Competition is the AI's judgment. Add your YouTube API key in Settings to check real YouTube results."}
          </p>
        </div>
        <Button variant="outline" className="gap-2 rounded-none" disabled={!!busy} onClick={more}>
          {busy === "more" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} More ideas
        </Button>
      </div>

      {data && data.saturated.length > 0 && (
        <div className="border border-line bg-panel-raised p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Already everywhere on YouTube (avoid)</p>
          <ul className="flex flex-wrap gap-2">
            {data.saturated.map((s) => (
              <li key={s} className="border border-line bg-panel px-2 py-1 text-xs text-muted-foreground line-through decoration-muted-foreground/40">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {data?.angles.map((a) => {
          const on = !own && state.angle?.title === a.title;
          const c = a.competition;
          return (
            <button
              key={a.title}
              onClick={() => pick(a)}
              className={cn("flex flex-col gap-2 border bg-panel p-4 text-left transition", on ? "border-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))]" : "border-line hover:border-foreground")}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-lg font-semibold leading-snug">{a.title}</p>
                {c && <span className={cn("shrink-0 border px-1.5 py-0.5 text-[10px] font-medium uppercase", LEVEL[c.level].tone)}>{LEVEL[c.level].label}</span>}
              </div>
              {a.hook && <p className="text-sm italic leading-6">"{a.hook}"</p>}
              {a.whyFresh && <p className="text-[13px] leading-5 text-muted-foreground">{a.whyFresh}</p>}
              {c && c.top.length > 0 && (
                <div className="mt-1 border-t border-line pt-2 text-[11px] text-muted-foreground">
                  <p className="mb-1 flex items-center gap-1">
                    <TrendingUp className="size-3" /> {c.bigVideos} of the top results have over 100K views. Biggest:
                  </p>
                  {c.top.map((t) => (
                    <p key={t.title} className="truncate">
                      {views(t.views)} · {t.title}
                    </p>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="border border-line bg-panel p-4">
        <p className="mb-2 text-sm font-medium">Or use your own title</p>
        <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Type a title…" className="h-10 w-full border border-line bg-panel-sunken px-3 text-sm outline-none focus:border-foreground" />
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" className="rounded-none" onClick={() => patch({ step: 1 })}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          {busy === "write" && <span className="text-xs text-muted-foreground">Writing a full script takes up to a minute…</span>}
          <Button className="gap-2 rounded-none" disabled={(!state.angle && !own.trim()) || !!busy} onClick={write}>
            {busy === "write" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Write the script
          </Button>
        </div>
      </div>
    </div>
  );
}
