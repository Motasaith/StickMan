import { useState } from "react";
import { AlertTriangle, ArrowRight, Film, Image as ImageIcon, Loader2, Plus, RefreshCw, Sparkles, Trash2, Type, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { scriptSeconds, type ScriptOverlay, type ScriptScene, type VideoScript } from "@/engine/footage";
import { briefOf, type Patch, type WizardState } from "@/pages/Create";

const REWRITES = ["Make it more gripping", "Simpler words", "Shorter", "Add a vivid detail", "More suspense"];

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function overlayLabel(o: ScriptOverlay): string {
  if (o.kind === "stat") return `Number: ${o.prefix ?? ""}${o.value ?? ""}${o.suffix ?? ""} ${o.text}`;
  if (o.kind === "list") return `List: ${(o.items ?? []).join(" · ")}`;
  if (o.kind === "lowerThird") return `Name bar: ${o.text}${o.sub ? ` (${o.sub})` : ""}`;
  if (o.kind === "quote") return `Quote: ${o.text}`;
  return `Title: ${o.text}`;
}

export function ScriptStep({ state, patch }: { state: WizardState; patch: Patch }) {
  const script = state.script!;
  const [busy, setBusy] = useState<string | null>(null);
  const setScript = (next: VideoScript) => patch({ script: next });
  const setScene = (i: number, p: Partial<ScriptScene>) => setScript({ ...script, scenes: script.scenes.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  const words = script.scenes.reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0);
  const seconds = scriptSeconds(script);

  const rewrite = async (i: number, instruction: string) => {
    setBusy(`scene-${i}`);
    try {
      const scene = await api.rewriteScene(script, i, instruction, state.tone || undefined);
      setScene(i, scene);
    } catch (err) {
      toast.error("Couldn't rewrite that scene", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const again = async () => {
    setBusy("all");
    try {
      setScript(await api.writeScript({ ...briefOf(state), angle: state.angle ?? undefined }));
    } catch (err) {
      toast.error("Couldn't write a new script", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const addAfter = (i: number) => {
    const prev = script.scenes[i];
    const scene: ScriptScene = { id: `s${Date.now().toString(36)}`, chapter: prev?.chapter, narration: "", visuals: prev?.visuals.slice(0, 1) ?? [], media: "video", overlay: null };
    const scenes = [...script.scenes];
    scenes.splice(i + 1, 0, scene);
    setScript({ ...script, scenes });
  };

  const remove = (i: number) => setScript({ ...script, scenes: script.scenes.filter((_, k) => k !== i) });
  const empty = script.scenes.some((s) => !s.narration.trim());

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="border border-line bg-panel p-5">
          <p className="eyebrow mb-2">Title</p>
          <input value={script.title} onChange={(e) => setScript({ ...script, title: e.target.value })} className="w-full bg-transparent font-display text-2xl font-semibold outline-none" />
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Thumbnail text</span>
              <input value={script.thumbnailText} onChange={(e) => setScript({ ...script, thumbnailText: e.target.value })} className="h-8 w-56 border border-line bg-panel-sunken px-2 outline-none focus:border-foreground" />
            </label>
            <span className="font-mono text-xs text-muted-foreground">
              {script.scenes.length} scenes · {words} words · about {fmtTime(seconds)} · {script.format}
            </span>
          </div>
        </div>

        {script.scenes.map((sc, i) => {
          const newChapter = sc.chapter && sc.chapter !== script.scenes[i - 1]?.chapter;
          return (
            <div key={sc.id}>
              {newChapter && <p className="mb-2 mt-6 font-display text-lg font-semibold">{sc.chapter}</p>}
              <div className={cn("group border border-line bg-panel p-4", busy === `scene-${i}` && "opacity-60")}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">SCENE {i + 1}</span>
                  <span className="ml-auto flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-accent" disabled={!!busy}>
                          {busy === `scene-${i}` ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Rewrite
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-60 p-2" align="end">
                        <RewriteMenu onPick={(ins) => void rewrite(i, ins)} />
                      </PopoverContent>
                    </Popover>
                    <button className="p-1 hover:bg-accent" title="Add a scene after this" onClick={() => addAfter(i)}>
                      <Plus className="size-3.5" />
                    </button>
                    <button className="p-1 hover:bg-accent" title="Remove this scene" disabled={script.scenes.length < 2} onClick={() => remove(i)}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
                <textarea
                  value={sc.narration}
                  onChange={(e) => setScene(i, { narration: e.target.value })}
                  rows={Math.max(2, Math.ceil(sc.narration.length / 90))}
                  placeholder="What the narrator says…"
                  className="w-full resize-none bg-transparent text-[15px] leading-7 outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2 text-xs">
                  <button
                    onClick={() => setScene(i, { media: sc.media === "photo" ? "video" : "photo" })}
                    className="flex items-center gap-1 border border-line px-1.5 py-0.5 text-muted-foreground hover:border-foreground hover:text-foreground"
                    title="Footage type"
                  >
                    {sc.media === "photo" ? <ImageIcon className="size-3" /> : <Film className="size-3" />} {sc.media === "photo" ? "Photos" : "Video"}
                  </button>
                  <input
                    value={sc.visuals.join(", ")}
                    onChange={(e) => setScene(i, { visuals: e.target.value.split(",").map((v) => v.trimStart()).slice(0, 4) })}
                    onBlur={() => setScene(i, { visuals: sc.visuals.map((v) => v.trim()).filter(Boolean) })}
                    className="min-w-[200px] flex-1 bg-transparent text-muted-foreground outline-none focus:text-foreground"
                    placeholder="Footage to search for, comma separated"
                  />
                </div>
                {sc.overlay && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Type className="size-3 text-primary" />
                    <span className="truncate">{overlayLabel(sc.overlay)}</span>
                    <button className="ml-auto p-0.5 text-muted-foreground hover:text-foreground" title="Remove the on-screen text" onClick={() => setScene(i, { overlay: null })}>
                      <X className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" className="rounded-none" onClick={() => patch({ step: state.angles ? 2 : 1 })}>
            Back
          </Button>
          <Button className="gap-2 rounded-none" disabled={empty || !!busy} onClick={() => patch({ step: 4 })}>
            <ArrowRight className="size-4" /> Choose the voice
          </Button>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Button variant="outline" className="w-full gap-2 rounded-none" disabled={!!busy} onClick={again}>
          {busy === "all" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Write a different version
        </Button>
        {script.checks.length > 0 && (
          <div className="border border-warn/50 bg-warn/10 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangle className="size-4 text-warn" /> Check before you publish
            </p>
            <p className="mb-2 text-xs text-muted-foreground">AI can get facts wrong. Verify these claims, or edit them out.</p>
            <ul className="list-disc space-y-1 pl-4 text-xs leading-5">
              {script.checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="border border-line bg-panel p-4 text-xs">
          <p className="mb-1 text-sm font-semibold">YouTube details</p>
          <p className="mb-2 leading-5 text-muted-foreground">{script.description}</p>
          <div className="flex flex-wrap gap-1">
            {script.tags.map((t) => (
              <span key={t} className="border border-line px-1.5 py-0.5">
                {t}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function RewriteMenu({ onPick }: { onPick: (instruction: string) => void }) {
  const [own, setOwn] = useState("");
  return (
    <div className="space-y-1">
      {REWRITES.map((r) => (
        <button key={r} onClick={() => onPick(r)} className="block w-full px-2 py-1.5 text-left text-sm hover:bg-accent">
          {r}
        </button>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (own.trim()) onPick(own.trim());
        }}
      >
        <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Or say how…" className="field-text mt-1" />
      </form>
    </div>
  );
}
