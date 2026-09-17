// Voice studio: studio voices on this computer, new voices blended from them, and voices
// cloned from a recording (with the speaker's permission). Merged from VoiceGen Studio.

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Blend, Check, Download, Loader2, Mic, Pause, Play, Plus, Square, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/editor/Logo";
import { cn } from "@/lib/utils";
import { api, type BlendPart, type CloneReport } from "@/lib/api";
import { playPreview, refreshVoices, usePreviewState, useVoices } from "@/lib/voices";
import { SiteFooter } from "@/components/SiteFooter";

function PreviewButton({ voice, blend, text, disabled }: { voice: string; blend?: BlendPart[]; text?: string; disabled?: boolean }) {
  const opts = { ...(blend ? { blend } : {}), ...(text ? { text } : {}) };
  const state = usePreviewState(voice, opts);
  return (
    <button
      disabled={disabled}
      onClick={() => playPreview(voice, opts).catch((err) => toast.error("Couldn't play the sample", { description: (err as Error).message }))}
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line hover:bg-accent disabled:opacity-40"
      title="Hear it"
    >
      {state === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : state === "playing" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
    </button>
  );
}

function useJob(onDone: () => void) {
  const [job, setJob] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  useEffect(() => {
    if (!job) return;
    const t = setInterval(async () => {
      const j = await api.job(job).catch(() => null);
      if (!j) return;
      const s = j.steps[0];
      setDetail(`${s.detail ?? "Working"}${s.total ? ` · ${s.done}%` : ""}`);
      if (j.status !== "running") {
        clearInterval(t);
        setJob(null);
        if (j.status === "done") onDone();
        else toast.error("Install failed", { description: j.error });
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);
  return { job, detail, setJob };
}

export default function Voices() {
  const voices = useVoices();
  const navigate = useNavigate();
  useEffect(() => {
    document.documentElement.classList.remove("theme-editor");
    void refreshVoices();
  }, []);

  const studio = useJob(() => void refreshVoices());
  const cloning = useJob(() => void refreshVoices());

  const languages = voices ? [...new Set(voices.studio.map((s) => s.language))] : [];
  const cameFromWizard = (() => {
    try {
      return !!sessionStorage.getItem("stickman-create");
    } catch {
      return false;
    }
  })();

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
          {cameFromWizard && (
            <Button className="rounded-none" onClick={() => navigate("/create")}>
              Back to your video
            </Button>
          )}
        </header>

        <section className="pb-8 pt-10">
          <p className="eyebrow mb-4">
            <span className="eyebrow-dot" /> Voice studio
          </p>
          <h1 className="font-display text-[44px] font-bold leading-[1] sm:text-[56px]">
            A voice that's <span className="serif-accent text-primary">yours alone.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            Thousands of channels use the same few online voices. Blend studio voices into a new speaker, or clone a voice from a short recording. Everything runs on this computer.
          </p>
        </section>

        {voices && (
          <div className="mb-8 grid gap-3 md:grid-cols-2">
            <ModelCard
              title="Studio voices"
              blurb="Kokoro, 40 voices in 7 languages. About 3 seconds of computer time per second of speech here."
              installed={voices.installed.studio}
              size="about 90 MB"
              busy={studio.job ? studio.detail : null}
              onInstall={() => api.installVoices("studio").then((r) => studio.setJob(r.job))}
            />
            <ModelCard
              title="Voice cloning"
              blurb="Chatterbox. Learns a voice from 10 to 30 seconds of speech. Slow on this computer (about an hour per minute of speech), so best for short videos."
              installed={voices.installed.clone}
              size="about 1.1 GB"
              busy={cloning.job ? cloning.detail : null}
              onInstall={() => api.installVoices("clone").then((r) => cloning.setJob(r.job))}
            />
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <BlendMaker disabled={!voices?.installed.studio} />
          <CloneMaker disabled={!voices?.installed.clone} />
        </div>

        <section className="mt-12">
          <p className="eyebrow mb-2">Yours</p>
          <h2 className="mb-4 font-display text-2xl font-semibold">Your voices</h2>
          {!voices ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : voices.saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet. Blends and clones you make appear here and in every voice picker.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {voices.saved.map((v) => (
                <div key={v.id} className="flex items-center gap-3 border border-line bg-panel p-3">
                  <PreviewButton voice={v.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{v.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.kind === "clone" ? `Clone${v.quality ? `, reference quality ${v.quality}/100` : ""}` : `Blend of ${(v.blend ?? []).map((b) => b.voice.split("_")[1]).join(" + ")}`}
                      {v.source === "voicegen" ? " · from VoiceGen" : ""}
                    </p>
                  </div>
                  {v.source === "stickman" && (
                    <button
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                      title="Delete"
                      onClick={async () => {
                        if (!confirm(`Delete the voice "${v.name}"?`)) return;
                        await api.deleteVoice(v.rawId).catch((err) => toast.error((err as Error).message));
                        void refreshVoices();
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <p className="eyebrow mb-2">Catalog</p>
          <h2 className="mb-4 font-display text-2xl font-semibold">Studio voices</h2>
          {voices && (
            <div className="space-y-6">
              {voices.presets.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Ready-made blends</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {voices.presets.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 border border-line bg-panel p-3">
                        <PreviewButton voice={p.id} disabled={!voices.installed.studio} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {languages.map((lang) => (
                <div key={lang}>
                  <p className="mb-2 text-sm font-medium">{lang}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {voices.studio
                      .filter((s) => s.language === lang)
                      .map((s) => (
                        <div key={s.id} className="flex items-center gap-3 border border-line bg-panel p-3">
                          <PreviewButton voice={s.id} disabled={!voices.installed.studio} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {s.name} <span className="text-xs font-normal text-muted-foreground">{s.gender}</span>
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{s.note}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <SiteFooter />
    </div>
  );
}

function ModelCard({ title, blurb, installed, size, busy, onInstall }: { title: string; blurb: string; installed: boolean; size: string; busy: string | null; onInstall: () => void }) {
  return (
    <div className="flex items-start gap-4 border border-line bg-panel p-4">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          {title}
          {installed && (
            <span className="flex items-center gap-1 text-xs text-good">
              <Check className="size-3.5" /> installed
            </span>
          )}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{blurb}</p>
        {busy && <p className="mt-2 flex items-center gap-2 text-xs"><Loader2 className="size-3.5 animate-spin" /> {busy}</p>}
      </div>
      {!installed && !busy && (
        <Button size="sm" variant="outline" className="shrink-0 gap-1.5 rounded-none" onClick={onInstall}>
          <Download className="size-3.5" /> Install ({size})
        </Button>
      )}
    </div>
  );
}

function BlendMaker({ disabled }: { disabled: boolean }) {
  const voices = useVoices();
  const english = voices?.studio ?? [];
  const [parts, setParts] = useState<BlendPart[]>([
    { voice: "am_michael", weight: 0.6 },
    { voice: "bm_george", weight: 0.4 },
  ]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (i: number, p: Partial<BlendPart>) => setParts(parts.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const valid = parts.filter((p) => p.weight > 0).length >= 2;

  return (
    <section className={cn("border border-line bg-panel p-5 shadow-[6px_6px_0_0_hsl(var(--line))]", disabled && "opacity-60")}>
      <p className="eyebrow mb-2">
        <Blend className="mr-1 inline size-3" /> Blend
      </p>
      <h2 className="font-display text-xl font-semibold">Mix a brand-new voice</h2>
      <p className="mt-1 text-sm text-muted-foreground">Two to four studio voices, mixed by weight, make a speaker no one else has. Fast enough for long videos.</p>
      <div className="mt-4 space-y-2">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={p.voice} onChange={(e) => set(i, { voice: e.target.value })} className="h-9 min-w-0 flex-1 border border-line bg-panel-sunken px-2 text-sm outline-none" disabled={disabled}>
              {english.map((s) => (
                <option key={s.id} value={s.id.slice(7)}>
                  {s.name} ({s.language}, {s.gender})
                </option>
              ))}
            </select>
            <input type="range" min={0} max={100} value={Math.round(p.weight * 100)} onChange={(e) => set(i, { weight: Number(e.target.value) / 100 })} className="w-28" disabled={disabled} />
            <span className="w-9 text-right font-mono text-xs">{Math.round(p.weight * 100)}</span>
            {parts.length > 2 && (
              <button className="p-1 text-muted-foreground hover:text-foreground" onClick={() => setParts(parts.filter((_, k) => k !== i))}>
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {parts.length < 4 && (
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" disabled={disabled} onClick={() => setParts([...parts, { voice: "af_heart", weight: 0.3 }])}>
            <Plus className="size-3.5" /> Add a voice
          </button>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <PreviewButton voice="blend" blend={parts.filter((p) => p.weight > 0)} disabled={disabled || !valid} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name it (e.g. My narrator)" className="h-9 min-w-0 flex-1 border border-line bg-panel-sunken px-2 text-sm outline-none focus:border-foreground" disabled={disabled} />
        <Button
          className="rounded-none"
          disabled={disabled || !valid || !name.trim() || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await api.saveBlend(name.trim(), parts.filter((p) => p.weight > 0));
              toast.success(`Saved "${name.trim()}"`);
              setName("");
              void refreshVoices();
            } catch (err) {
              toast.error("Couldn't save the blend", { description: (err as Error).message });
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </section>
  );
}

function CloneMaker({ disabled }: { disabled: boolean }) {
  const [file, setFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<CloneReport | null>(null);
  const [recording, setRecording] = useState<{ rec: MediaRecorder; started: number } | null>(null);
  const [, tick] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [recording]);

  const record = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setFile({ blob: new Blob(chunks, { type: rec.mimeType }), name: "recording.webm" });
        setRecording(null);
      };
      rec.start();
      setRecording({ rec, started: Date.now() });
      setReport(null);
    } catch (err) {
      toast.error("Couldn't use the microphone", { description: (err as Error).message });
    }
  };

  const seconds = recording ? Math.floor((Date.now() - recording.started) / 1000) : 0;

  const clone = async () => {
    if (!file) return;
    setBusy(true);
    setReport(null);
    try {
      const res = await api.cloneVoice(file.blob, file.name, name.trim(), consent);
      setReport(res.report);
      toast.success(`"${res.name}" is ready`, { description: "It's in every voice picker now." });
      setFile(null);
      setName("");
      void refreshVoices();
    } catch (err) {
      const e = err as Error & { report?: CloneReport };
      if (e.report) setReport(e.report);
      toast.error("Couldn't clone the voice", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn("border border-line bg-panel p-5 shadow-[6px_6px_0_0_hsl(var(--line))]", disabled && "opacity-60")}>
      <p className="eyebrow mb-2">
        <Mic className="mr-1 inline size-3" /> Clone
      </p>
      <h2 className="font-display text-xl font-semibold">Clone a voice</h2>
      <p className="mt-1 text-sm text-muted-foreground">10 to 30 seconds of clear speech in a quiet room. Your own voice, or someone who has agreed to it.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && setFile({ blob: e.target.files[0], name: e.target.files[0].name })} />
        <Button variant="outline" size="sm" className="gap-1.5 rounded-none" disabled={disabled || !!recording || busy} onClick={() => input.current?.click()}>
          <Upload className="size-3.5" /> Upload a clip
        </Button>
        {recording ? (
          <Button size="sm" className="gap-1.5 rounded-none" onClick={() => recording.rec.stop()}>
            <Square className="size-3.5" /> Stop ({seconds}s)
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 rounded-none" disabled={disabled || busy} onClick={record}>
            <Mic className="size-3.5" /> Record
          </Button>
        )}
        {file && <span className="truncate text-xs text-muted-foreground">{file.name}</span>}
      </div>
      {recording && <p className="mt-2 text-xs text-muted-foreground">Read anything naturally, like you're telling a friend a story. Stop after 15 to 25 seconds.</p>}

      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Voice name" className="mt-3 h-9 w-full border border-line bg-panel-sunken px-2 text-sm outline-none focus:border-foreground" disabled={disabled} />
      <label className="mt-3 flex items-start gap-2 text-xs leading-5">
        <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={disabled} />
        This is my voice, or I have the speaker's permission to clone it. I won't use it to impersonate anyone.
      </label>

      <Button className="mt-4 w-full gap-2 rounded-none" disabled={disabled || !file || !name.trim() || !consent || busy} onClick={clone}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />} {busy ? "Learning the voice (about a minute)…" : "Clone it"}
      </Button>

      {report && (
        <div className={cn("mt-4 border p-3 text-xs", report.ok ? "border-good/50 bg-good/10" : "border-warn/50 bg-warn/10")}>
          <p className="font-medium">
            Recording quality {report.score}/100 · {report.duration}s
          </p>
          {report.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {report.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          {report.tips.length > 0 && <p className="mt-1 text-muted-foreground">{report.tips.join(" ")}</p>}
        </div>
      )}
    </section>
  );
}
