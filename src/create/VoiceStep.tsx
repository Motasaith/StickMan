import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Clock, Hammer, Loader2, Mic2, Pause, Play, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, type VoiceList } from "@/lib/api";
import { playPreview, refreshVoices, usePreviewState, useVoices, voiceOptions, voiceTime } from "@/lib/voices";
import { nicheById } from "@/engine/niches";
import { scriptSeconds } from "@/engine/footage";
import type { Patch, WizardState } from "@/pages/Create";

type Tab = "recommended" | "online" | "studio" | "blends" | "yours";

/** Voices that can speak the chosen language. */
function fitsLanguage(v: VoiceList, id: string, language: string): boolean {
  const lang = language.toLowerCase();
  if (!id.includes(":")) return lang === "urdu" ? id.startsWith("urdu") : lang === "english" && !id.startsWith("urdu");
  const studio = v.studio.find((s) => s.id === id);
  if (studio) {
    if (lang === "urdu") return studio.language === "Hindi";
    return studio.language.toLowerCase().startsWith(lang === "portuguese" ? "portuguese" : lang);
  }
  // Blends and clones follow English voices (clones speak the language of their training).
  return lang === "english";
}

export function VoiceStep({ state, patch }: { state: WizardState; patch: Patch }) {
  const voices = useVoices();
  const niche = nicheById(state.niche ?? undefined);
  const [tab, setTab] = useState<Tab>("recommended");
  const [building, setBuilding] = useState(false);
  const seconds = scriptSeconds(state.script!);
  // A short line from the script: studio voices take a few seconds per sentence to render.
  const sample = (state.script!.scenes[0]?.narration.match(/^.{20,140}?[.!?](\s|$)/)?.[0] ?? state.script!.scenes[0]?.narration.slice(0, 120))?.trim();

  useEffect(() => {
    void refreshVoices();
  }, []);

  const options = useMemo(() => voiceOptions(voices).filter((o) => voices && fitsLanguage(voices, o.id, state.language)), [voices, state.language]);
  const recommended = useMemo(() => {
    const ids = [niche.voices.studio, niche.voices.edge, ...(state.language === "Urdu" ? ["urduMan", "urduWoman", "kokoro:hm_omega"] : [])];
    return options.filter((o) => ids.includes(o.id));
  }, [options, niche, state.language]);

  // Default: the niche's online voice (fast), so a video can be built right away.
  useEffect(() => {
    if (!state.voice && options.length) patch({ voice: (recommended.find((o) => o.engine === "edge") ?? options[0]).id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  const list =
    tab === "recommended"
      ? recommended
      : tab === "online"
        ? options.filter((o) => o.group === "Online (fast)")
        : tab === "studio"
          ? options.filter((o) => o.group === "Studio (on this computer)")
          : tab === "blends"
            ? options.filter((o) => o.group === "Blends")
            : options.filter((o) => o.group === "Your voices");

  const time = state.voice ? voiceTime(voices, state.voice, seconds) : null;

  const build = async () => {
    if (!state.voice || !state.script) return;
    setBuilding(true);
    try {
      const { job } = await api.buildVideo(state.script, state.voice, state.captions);
      patch({ job, step: 5 });
    } catch (err) {
      toast.error("Couldn't start building", { description: (err as Error).message });
    } finally {
      setBuilding(false);
    }
  };

  const studioMissing = voices && !voices.installed.studio && (tab === "studio" || tab === "blends");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="eyebrow mb-2">The narrator</p>
        <h2 className="font-display text-2xl font-semibold">Choose a voice</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Online voices are fast. Studio voices, blends and clones run on this computer, so your channel doesn't sound like everyone else's.
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {(
            [
              ["recommended", "Recommended"],
              ["online", "Online"],
              ["studio", "Studio"],
              ["blends", "Blends"],
              ["yours", "Your voices"],
            ] as Array<[Tab, string]>
          ).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={cn("border px-3 py-1.5 text-sm", tab === id ? "border-foreground bg-foreground text-background" : "border-line hover:border-foreground")}>
              {label}
            </button>
          ))}
        </div>

        {studioMissing && <InstallStudio />}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {!voices && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          {voices && list.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {tab === "yours" ? "No saved voices yet. Make a blend or clone a voice in the Voice studio." : `No ${tab} voices for ${state.language}.`}
            </p>
          )}
          {list.map((o) => (
            <VoiceRow key={o.id} id={o.id} label={o.label} note={o.note} engine={o.engine} selected={state.voice === o.id} star={recommended.some((r) => r.id === o.id)} sample={sample} onSelect={() => patch({ voice: o.id })} />
          ))}
        </div>

        <div className="mt-5 flex items-start gap-3 border border-line bg-panel-raised p-4 text-sm">
          <Mic2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Want a voice nobody else on YouTube uses? Mix two to four studio voices into a new blend, or clone your own voice from a short recording, in the{" "}
            <Link to="/voices" className="font-medium underline underline-offset-2">
              Voice studio
            </Link>
            . Your script is kept while you're there.
          </p>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="border border-line bg-panel p-4">
          <p className="text-sm font-semibold">Ready to build</p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li>{state.script!.scenes.length} scenes, about {Math.round(seconds / 6) / 10} minutes</li>
            <li>Stock footage from Pexels, cut every {niche.style.shotSeconds}s</li>
            <li>
              {niche.style.look === "natural" ? "Natural color" : `${niche.style.look[0].toUpperCase()}${niche.style.look.slice(1)} grade`}, {niche.style.chapterTransition} between chapters
            </li>
          </ul>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.captions} onChange={(e) => patch({ captions: e.target.checked })} /> Captions ({niche.style.caption} style)
          </label>
          {time && (
            <p className={cn("mt-3 flex items-center gap-1.5 text-xs", time.slow ? "text-warn" : "text-muted-foreground")}>
              <Clock className="size-3.5" /> Voice recording: {time.text}
              {time.slow ? ". Clones are slow on this computer; use one for short videos, or a blend." : ""}
            </p>
          )}
          <Button className="mt-4 w-full gap-2 rounded-none" disabled={!state.voice || building} onClick={build}>
            {building ? <Loader2 className="size-4 animate-spin" /> : <Hammer className="size-4" />} Build the video
          </Button>
        </div>
        <Button variant="ghost" className="w-full rounded-none" onClick={() => patch({ step: 3 })}>
          Back to the script <ArrowRight className="size-4 rotate-180" />
        </Button>
      </aside>
    </div>
  );
}

export function VoiceRow({
  id,
  label,
  note,
  engine,
  selected,
  star,
  sample,
  onSelect,
}: {
  id: string;
  label: string;
  note?: string;
  engine: string;
  selected: boolean;
  star?: boolean;
  sample?: string;
  onSelect: () => void;
}) {
  const opts = sample ? { text: sample } : {};
  const preview = usePreviewState(id, opts);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn("flex cursor-pointer items-center gap-3 border bg-panel p-3 text-left transition", selected ? "border-foreground shadow-[3px_3px_0_0_hsl(var(--foreground))]" : "border-line hover:border-foreground")}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          playPreview(id, opts).catch((err) => toast.error("Couldn't play the sample", { description: (err as Error).message }));
        }}
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line hover:bg-accent"
        title="Hear it"
      >
        {preview === "loading" ? <Loader2 className="size-4 animate-spin" /> : preview === "playing" ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {label} {star && <Star className="size-3 fill-primary text-primary" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">{note ?? (engine === "edge" ? "Microsoft neural voice, online" : engine === "clone" ? "Cloned voice, on this computer" : "Studio voice, on this computer")}</p>
      </div>
    </div>
  );
}

function InstallStudio() {
  const [job, setJob] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  useEffect(() => {
    if (!job) return;
    const t = setInterval(async () => {
      const j = await api.job(job).catch(() => null);
      if (!j) return;
      const s = j.steps[0];
      setProgress(`${s.detail ?? ""} ${s.total ? `${s.done}%` : ""}`);
      if (j.status !== "running") {
        clearInterval(t);
        setJob(null);
        if (j.status === "done") void refreshVoices();
        else toast.error("Install failed", { description: j.error });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [job]);
  return (
    <div className="mt-4 flex items-center gap-3 border border-warn/50 bg-warn/10 p-3 text-sm">
      <p className="flex-1">Studio voices aren't installed yet (about 90 MB, once).</p>
      {job ? (
        <span className="flex items-center gap-2 text-xs">
          <Loader2 className="size-3.5 animate-spin" /> {progress}
        </span>
      ) : (
        <Button size="sm" className="rounded-none" onClick={() => api.installVoices("studio").then((r) => setJob(r.job))}>
          Install
        </Button>
      )}
    </div>
  );
}
