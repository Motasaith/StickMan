import { useState } from "react";
import { Atom, Brain, ChevronDown, Clapperboard, Cpu, Fingerprint, Gem, Globe2, HeartPulse, Landmark, Loader2, PenLine, Smartphone, Sparkles, Wallet, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { CUSTOM_NICHE, NICHES, VIDEO_LENGTHS, VIDEO_TONES, nicheById } from "@/engine/niches";
import { briefOf, type Patch, type WizardState } from "@/pages/Create";

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

export function NicheStep({ state, patch }: { state: WizardState; patch: Patch }) {
  const [busy, setBusy] = useState<"angles" | "script" | null>(null);
  const [showDraft, setShowDraft] = useState(!!state.draft);
  const niche = state.niche ? nicheById(state.niche) : null;
  const ready = !!state.niche && (!!state.idea.trim() || !!state.draft.trim());

  const findAngles = async () => {
    setBusy("angles");
    try {
      const angles = await api.angles(briefOf(state));
      patch({ angles, angle: null, step: 2 });
    } catch (err) {
      toast.error("Couldn't find ideas", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const writeNow = async () => {
    setBusy("script");
    try {
      const script = await api.writeScript(briefOf(state));
      patch({ script, angle: null, step: 3 });
    } catch (err) {
      toast.error("Couldn't write the script", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow mb-2">01 / What kind of video?</p>
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
                onClick={() => patch({ niche: n.id, length: n.id === "shorts" ? "short" : state.length === "short" ? "5" : state.length, angles: null })}
                className={cn(
                  "group flex flex-col gap-2 border bg-panel p-4 text-left transition hover:-translate-y-0.5",
                  on ? "border-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))]" : "border-line hover:border-foreground"
                )}
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
        <p className="eyebrow mb-2">02 / The idea</p>
        <textarea
          value={state.idea}
          onChange={(e) => patch({ idea: e.target.value, angles: null })}
          rows={3}
          placeholder={niche?.examples[0] ? `e.g. ${niche.examples[0]}` : "What is the video about? A topic, a question, a story…"}
          className="w-full resize-none border-0 bg-transparent text-lg leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />
        {niche && niche.examples.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {niche.examples.map((ex) => (
              <button key={ex} onClick={() => patch({ idea: ex, angles: null })} className="border border-line px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground">
                {ex}
              </button>
            ))}
          </div>
        )}

        <button onClick={() => setShowDraft((v) => !v)} className="mt-5 flex items-center gap-1.5 text-sm font-medium">
          <PenLine className="size-4" /> {showDraft ? "Your script or notes" : "Already have part of a script? Add it"}
          <ChevronDown className={cn("size-4 transition", showDraft && "rotate-180")} />
        </button>
        {showDraft && (
          <textarea
            value={state.draft}
            onChange={(e) => patch({ draft: e.target.value })}
            rows={6}
            placeholder="Paste a rough script, an outline or a few lines. The AI keeps your ideas and best lines, then completes and polishes it."
            className="mt-2 w-full resize-y border border-line bg-panel-sunken p-3 text-sm leading-6 outline-none focus:border-foreground"
          />
        )}

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Length</p>
            <div className="flex flex-wrap gap-1.5">
              {VIDEO_LENGTHS.map((l) => (
                <button key={l.id} onClick={() => patch({ length: l.id, angles: null })} className={cn("border px-2.5 py-1 text-xs", state.length === l.id ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground")}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
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
          {state.niche && !ready && <span className="mr-auto text-sm text-muted-foreground">Describe the idea or add your notes.</span>}
          <Button variant="outline" className="gap-2 rounded-none" disabled={!ready || !!busy} onClick={writeNow}>
            {busy === "script" ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />} Write the script now
          </Button>
          <Button className="gap-2 rounded-none" disabled={!ready || !!busy} onClick={findAngles}>
            {busy === "angles" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Find fresh angles
          </Button>
        </div>
        {busy === "script" && <p className="mt-2 text-right text-xs text-muted-foreground">Writing a full script takes up to a minute.</p>}
      </section>
    </div>
  );
}
