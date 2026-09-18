import { useState } from "react";
import { Atom, Brain, ChevronDown, Clapperboard, Cpu, Fingerprint, Gem, Globe2, HeartPulse, Landmark, Loader2, PenLine, Smartphone, Sparkles, Wallet, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, type VisualMode } from "@/lib/api";
import { CUSTOM_NICHE, NICHES, NICHE_OPENERS, VIDEO_LENGTHS, VIDEO_TONES, nicheById } from "@/engine/niches";
import { HELP_PRESETS, briefOf, type HelpChoices, type Patch, type WizardState } from "@/pages/Create";
import { RecordingPanel } from "./RecordingPanel";

export const NICHE_ICONS: Record<string, typeof Wallet> = {
  finance: Wallet,
  documentary: Clapperboard,
  tech: Cpu,
  history: Landmark,
  science: Atom,
  psychology: Brain,
  health: HeartPulse,
  mysteries: Fingerprint,
  geography: Globe2,
  luxury: Gem,
  shorts: Smartphone,
  custom: Sparkles,
};

export const LANGUAGES = ["English", "Urdu", "Hindi", "Spanish", "French", "Italian", "Portuguese"];

export const VISUAL_MODES: Array<{ id: VisualMode; label: string; blurb: string }> = [
  { id: "stock", label: "Stock video", blurb: "Real footage from Pexels" },
  { id: "real", label: "Real photos", blurb: "Wikimedia, NASA and Creative Commons: people, places, history" },
  { id: "ai", label: "AI pictures", blurb: "A picture drawn for every scene" },
  { id: "mix", label: "Stock + AI", blurb: "Footage, with AI pictures where none fits" },
  { id: "none", label: "My own", blurb: "Colored backgrounds to replace with your clips" },
];

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.id} onClick={() => onChange(o.id)} className={cn("border px-2.5 py-1 text-xs", value === o.id ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground")}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NicheStep({ state, patch }: { state: WizardState; patch: Patch }) {
  const [busy, setBusy] = useState<"angles" | "script" | null>(null);
  const [fine, setFine] = useState(false);
  const [showNotes, setShowNotes] = useState(!!state.draft && state.help.script === "ai");
  const help = state.help;
  const setHelp = (p: Partial<HelpChoices>) => patch({ help: { ...help, ...p } });
  const niche = state.niche ? nicheById(state.niche) : null;
  const preset = HELP_PRESETS.find((p) => Object.entries(p.help).every(([k, v]) => help[k as keyof HelpChoices] === v))?.id ?? "custom";
  const recordingFirst = help.script === "mine" && help.voice === "mine" && !state.draft.trim();
  const scriptText = help.script === "mine" ? state.draft.trim() || state.recording?.text || "" : state.draft.trim();

  const ready =
    !!state.niche &&
    (help.script === "ai" ? !!state.idea.trim() || !!state.draft.trim() : help.script === "polish" ? !!state.draft.trim() : scriptText.length > 10);

  const pickNiche = (id: string) => {
    const openers = NICHE_OPENERS[id] ?? NICHE_OPENERS.custom;
    patch({
      niche: id,
      length: id === "shorts" ? "short" : state.length === "short" ? "5" : state.length,
      angles: null,
      help: { ...help, intro: help.intro ?? openers.intro, outro: help.outro ?? openers.outro },
    });
  };

  const run = async (kind: "angles" | "script") => {
    setBusy(kind);
    try {
      if (kind === "angles") {
        patch({ angles: await api.angles(briefOf(state)), angle: null, step: 2 });
      } else if (help.script === "mine") {
        const script = await api.splitScript({ ...briefOf(state), text: scriptText });
        patch({ script, angle: null, step: 3 });
      } else {
        const script = await api.writeScript(briefOf(state));
        patch({ script, angle: null, step: 3 });
      }
    } catch (err) {
      toast.error(kind === "angles" ? "Couldn't find ideas" : "Couldn't prepare the script", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <p className="eyebrow mb-2">01 / Your part, the AI's part</p>
        <h2 className="mb-4 font-display text-2xl font-semibold">How much should the AI do?</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HELP_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => patch({ help: { ...help, ...p.help }, recording: p.help.voice === "mine" ? state.recording : null })}
              className={cn("flex flex-col gap-1 border bg-panel p-4 text-left transition", preset === p.id ? "border-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))]" : "border-line hover:border-foreground")}
            >
              <span className="font-display text-[15px] font-semibold">{p.label}</span>
              <span className="text-[13px] leading-5 text-muted-foreground">{p.blurb}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setFine((v) => !v)} className="mt-3 flex items-center gap-1.5 text-sm font-medium">
          {preset === "custom" ? "Custom mix" : "Fine-tune each part"} <ChevronDown className={cn("size-4 transition", fine && "rotate-180")} />
        </button>
        {fine && (
          <div className="mt-3 grid gap-4 border border-line bg-panel p-4 md:grid-cols-2">
            <Choice
              label="Script"
              value={help.script}
              options={[
                { id: "ai", label: "AI writes it" },
                { id: "polish", label: "AI polishes my draft" },
                { id: "mine", label: "My script, word for word" },
              ]}
              onChange={(script) => setHelp({ script })}
            />
            <Choice
              label="Voice"
              value={help.voice}
              options={[
                { id: "ai", label: "AI voice (or my clone)" },
                { id: "mine", label: "My own recording" },
              ]}
              onChange={(voice) => setHelp({ voice })}
            />
            <Choice label="Visuals" value={help.visuals} options={VISUAL_MODES} onChange={(visuals) => setHelp({ visuals })} />
            <Choice
              label="Editing"
              value={help.simple ? "simple" : "full"}
              options={[
                { id: "full", label: "Full edit: transitions, zooms, titles" },
                { id: "simple", label: "Simple cuts" },
              ]}
              onChange={(v) => setHelp({ simple: v === "simple" })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={help.overlays} onChange={(e) => setHelp({ overlays: e.target.checked })} /> On-screen titles, numbers and lists
            </label>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow mb-2">02 / What kind of video?</p>
            <h2 className="font-display text-2xl font-semibold">Pick your channel's niche</h2>
          </div>
          {niche && <p className="max-w-sm text-right text-xs text-muted-foreground">Style: {niche.tone}. Cuts every {niche.style.shotSeconds}s.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...NICHES, CUSTOM_NICHE].map((n) => {
            const Icon = NICHE_ICONS[n.id] ?? Sparkles;
            const on = state.niche === n.id;
            return (
              <button
                key={n.id}
                onClick={() => pickNiche(n.id)}
                className={cn("group flex flex-col gap-2 border bg-panel p-4 text-left transition hover:-translate-y-0.5", on ? "border-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))]" : "border-line hover:border-foreground")}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("flex size-8 items-center justify-center", on ? "bg-primary text-primary-foreground" : "bg-panel-raised")}>
                    <Icon className="size-4" />
                  </span>
                  <span className="font-display text-[15px] font-semibold leading-tight">{n.label}</span>
                </div>
                <p className="text-[13px] leading-5 text-muted-foreground">{n.pitch}</p>
                {n.badges.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-1 pt-1">
                    {n.badges.map((b) => (
                      <span key={b} className="border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="border border-line bg-panel p-5 shadow-[6px_6px_0_0_hsl(var(--line))]">
        <p className="eyebrow mb-2">03 / {help.script === "mine" ? "Your script" : help.script === "polish" ? "Your draft" : "The idea"}</p>

        {help.script !== "mine" && (
          <>
            <textarea
              value={state.idea}
              onChange={(e) => patch({ idea: e.target.value, angles: null })}
              rows={help.script === "polish" ? 2 : 3}
              placeholder={help.script === "polish" ? "What is it about? (optional)" : niche?.examples[0] ? `e.g. ${niche.examples[0]}` : "What is the video about? A topic, a question, a story…"}
              className="w-full resize-none border-0 bg-transparent text-lg leading-relaxed outline-none placeholder:text-muted-foreground/70"
            />
            {help.script === "ai" && niche && niche.examples.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {niche.examples.map((ex) => (
                  <button key={ex} onClick={() => patch({ idea: ex, angles: null })} className="border border-line px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground">
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {help.script === "ai" && (
          <button onClick={() => setShowNotes((v) => !v)} className="mt-5 flex items-center gap-1.5 text-sm font-medium">
            <PenLine className="size-4" /> {showNotes ? "Your notes" : "Have notes or a few lines? Add them"}
            <ChevronDown className={cn("size-4 transition", showNotes && "rotate-180")} />
          </button>
        )}
        {(help.script !== "ai" || showNotes) && !recordingFirst && (
          <textarea
            value={state.draft}
            onChange={(e) => patch({ draft: e.target.value })}
            rows={help.script === "mine" ? 12 : 6}
            placeholder={
              help.script === "mine"
                ? "Paste your full script. Every word stays exactly as written; the AI only splits it into scenes and finds visuals for each."
                : help.script === "polish"
                  ? "Paste your rough script. The AI keeps your ideas, order and best lines, then tightens the wording and fills the gaps."
                  : "An outline or a few lines. The AI keeps them and writes the rest."
            }
            className="mt-2 w-full resize-y border border-line bg-panel-sunken p-3 text-sm leading-6 outline-none focus:border-foreground"
          />
        )}
        {help.script === "mine" && help.voice === "mine" && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">{state.draft.trim() ? "You'll record it at the voice step. No written script? Clear the box above and record first." : "No written script? Record or upload your narration and it becomes the script."}</p>
            {recordingFirst && <RecordingPanel language={state.language} scenes={[]} value={state.recording} onChange={(recording) => patch({ recording })} />}
          </div>
        )}
        {help.script === "mine" && scriptText && (
          <p className="mt-2 text-xs text-muted-foreground">
            {scriptText.split(/\s+/).length} words, about {Math.max(1, Math.round((scriptText.split(/\s+/).length / 150) * 10) / 10)} minutes.
          </p>
        )}

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{help.script === "mine" ? "Format" : "Length"}</p>
            <div className="flex flex-wrap gap-1.5">
              {(help.script === "mine" ? VIDEO_LENGTHS.filter((l) => l.id === "short" || l.id === "5").map((l) => ({ ...l, label: l.id === "short" ? "Vertical short (9:16)" : "Landscape video (16:9)" })) : VIDEO_LENGTHS).map((l) => (
                <button key={l.id} onClick={() => patch({ length: l.id, angles: null })} className={cn("border px-2.5 py-1 text-xs", state.length === l.id ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground")}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          {help.script !== "mine" ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Tone</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => patch({ tone: "" })} className={cn("border px-2.5 py-1 text-xs", !state.tone ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground")}>
                  Best for this niche
                </button>
                {VIDEO_TONES.map((t) => (
                  <button key={t} onClick={() => patch({ tone: t })} className={cn("border px-2.5 py-1 text-xs", state.tone === t ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground")}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div />
          )}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Narration language</p>
            <select value={state.language} onChange={(e) => patch({ language: e.target.value, voice: null })} className="h-8 w-full border border-line bg-panel-sunken px-2 text-sm outline-none">
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
          {!state.niche && <span className="mr-auto text-sm text-muted-foreground">Pick a niche above to continue.</span>}
          {state.niche && !ready && (
            <span className="mr-auto text-sm text-muted-foreground">
              {help.script === "ai" ? "Describe the idea or add your notes." : help.script === "polish" ? "Paste your draft." : help.voice === "mine" ? "Paste your script or add your recording." : "Paste your script."}
            </span>
          )}
          {help.script === "ai" ? (
            <>
              <Button variant="outline" className="gap-2 rounded-none" disabled={!ready || !!busy} onClick={() => run("script")}>
                {busy === "script" ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />} Write the script now
              </Button>
              <Button className="gap-2 rounded-none" disabled={!ready || !!busy} onClick={() => run("angles")}>
                {busy === "angles" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Find fresh angles
              </Button>
            </>
          ) : (
            <Button className="gap-2 rounded-none" disabled={!ready || !!busy} onClick={() => run("script")}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} {help.script === "mine" ? "Plan the scenes" : "Polish my script"}
            </Button>
          )}
        </div>
        {busy === "script" && <p className="mt-2 text-right text-xs text-muted-foreground">{help.script === "mine" ? "Planning scenes and visuals…" : "Writing a full script takes up to a minute."}</p>}
      </section>
    </div>
  );
}
