// The AI video maker: pick a kind of video, find a fresh angle, shape the script, choose a
// voice, and the video is built (narration, stock footage, cuts, captions) into the editor.

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Check, Mic2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/editor/Logo";
import { cn } from "@/lib/utils";
import { api, type VideoAngle } from "@/lib/api";
import { VIDEO_LENGTHS, nicheById } from "@/engine/niches";
import type { VideoScript } from "@/engine/footage";
import { NicheStep } from "@/create/NicheStep";
import { AngleStep } from "@/create/AngleStep";
import { ScriptStep } from "@/create/ScriptStep";
import { VoiceStep } from "@/create/VoiceStep";
import { BuildStep } from "@/create/BuildStep";

export interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  niche: string | null;
  idea: string;
  draft: string;
  length: string;
  tone: string;
  language: string;
  angles: { saturated: string[]; angles: VideoAngle[]; youtube: boolean } | null;
  angle: { title: string; hook?: string } | null;
  script: VideoScript | null;
  voice: string | null;
  captions: boolean;
  job: string | null;
}

const KEY = "stickman-create";

const fresh = (): WizardState => ({
  step: 1,
  niche: null,
  idea: "",
  draft: "",
  length: "5",
  tone: "",
  language: "English",
  angles: null,
  angle: null,
  script: null,
  voice: null,
  captions: true,
  job: null,
});

function load(): WizardState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...(JSON.parse(raw) as Partial<WizardState>) };
  } catch {
    // A private window may block storage; start fresh.
  }
  return fresh();
}

const STEPS = ["Idea", "Angle", "Script", "Voice", "Build"] as const;

export type Patch = (p: Partial<WizardState>) => void;

export function briefOf(s: WizardState) {
  const len = VIDEO_LENGTHS.find((l) => l.id === s.length) ?? VIDEO_LENGTHS[2];
  return {
    niche: s.niche ?? "custom",
    idea: s.idea.trim(),
    draft: s.draft.trim() || undefined,
    tone: s.tone || undefined,
    minutes: len.minutes,
    format: len.format,
    language: s.language,
  };
}

export default function Create() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<WizardState>(load);
  const [status, setStatus] = useState<{ ai: boolean; stock: boolean; youtube: boolean } | null>(null);

  const patch: Patch = (p) => setState((s) => ({ ...s, ...p }));

  // A prompt from the home page starts a new video.
  useEffect(() => {
    const prompt = params.get("prompt");
    if (prompt !== null) {
      const next = fresh();
      next.idea = prompt;
      if (params.get("format") === "9:16") next.length = "short";
      setState(next);
      setParams({}, { replace: true });
    }
    document.documentElement.classList.remove("theme-editor");
    api.autovideoStatus().then(setStatus).catch(() => setStatus({ ai: false, stock: false, youtube: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Not saved; the wizard still works.
    }
  }, [state]);

  const reachable = (i: number) => {
    if (state.job) return i === 5;
    if (i === 1) return true;
    if (i === 2) return !!state.angles;
    if (i === 3) return !!state.script;
    if (i === 4) return !!state.script;
    return false;
  };

  const startOver = () => {
    setState(fresh());
    toast.message("Started a new video");
  };

  const niche = state.niche ? nicheById(state.niche) : null;

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-6 pb-24">
        <header className="flex h-[88px] items-center justify-between border-b border-line">
          <div className="flex items-center gap-5">
            <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Projects
            </Link>
            <Logo className="h-7" />
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link to="/voices" className="flex items-center gap-1.5 hover:text-primary">
              <Mic2 className="size-4" /> Voice studio
            </Link>
            {state.step > 1 && !state.job && (
              <button onClick={startOver} className="text-muted-foreground hover:text-foreground">
                Start over
              </button>
            )}
          </nav>
        </header>

        <section className="pb-8 pt-10">
          <p className="eyebrow mb-4">
            <span className="eyebrow-dot" /> AI video maker
          </p>
          <h1 className="font-display text-[44px] font-bold leading-[1] sm:text-[56px]">
            From an idea to a <span className="serif-accent text-primary">finished video.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            Pick what kind of channel you run, and the AI finds a fresh angle, writes the script, records the voice, pulls matching footage from Pexels and edits it all together. You get a real timeline to change by hand or with the AI, then export.
          </p>
          {niche && state.step > 1 && <p className="mt-3 text-sm text-muted-foreground">Making: <span className="font-medium text-foreground">{niche.label}</span></p>}
        </section>

        {status && (!status.ai || !status.stock) && (
          <div className="mb-6 border border-warn/50 bg-warn/10 p-4 text-sm">
            {!status.ai && <p>The AI isn't set up: add LLM_BASE_URL and LLM_API_KEY to .env, then restart.</p>}
            {!status.stock && <p>Stock footage isn't set up: add PEXELS_API_KEY to .env (free at pexels.com/api). Videos will use colored backgrounds until then.</p>}
          </div>
        )}

        <ol className="mb-8 flex flex-wrap gap-2">
          {STEPS.map((label, k) => {
            const i = (k + 1) as WizardState["step"];
            const current = state.step === i;
            const done = state.step > i;
            return (
              <li key={label}>
                <button
                  disabled={!reachable(i) || current}
                  onClick={() => patch({ step: i })}
                  className={cn(
                    "flex items-center gap-2 border px-3 py-1.5 text-sm transition disabled:cursor-default",
                    current ? "border-foreground bg-foreground text-background" : done ? "border-line bg-panel hover:border-foreground" : "border-line text-muted-foreground"
                  )}
                >
                  <span className={cn("flex size-5 items-center justify-center rounded-full font-mono text-[11px]", current ? "bg-background text-foreground" : "bg-panel-raised")}>
                    {done ? <Check className="size-3" /> : i}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>

        {state.step === 1 && <NicheStep state={state} patch={patch} />}
        {state.step === 2 && <AngleStep state={state} patch={patch} youtube={!!status?.youtube} />}
        {state.step === 3 && <ScriptStep state={state} patch={patch} />}
        {state.step === 4 && <VoiceStep state={state} patch={patch} />}
        {state.step === 5 && (
          <BuildStep
            state={state}
            patch={patch}
            onOpen={(projectId) => {
              setState(fresh());
              navigate(`/editor/${projectId}`);
            }}
          />
        )}
      </div>
    </div>
  );
}
