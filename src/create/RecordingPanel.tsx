// The creator narrates the video: record in the browser (with the script as a teleprompter)
// or upload a recording. It is transcribed so each scene can be cut to where it is said.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Mic, RotateCcw, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, type MediaUpload } from "@/lib/api";
import { alignScenes } from "@/engine/align";
import type { Word } from "@/engine/scene";

export interface Recording {
  media: MediaUpload;
  words: Word[];
  text: string;
}

export function RecordingPanel({
  language,
  scenes,
  value,
  onChange,
}: {
  language: string;
  /** Scene texts to read (a teleprompter); none when the recording will become the script. */
  scenes: string[];
  value: Recording | null;
  onChange: (r: Recording | null) => void;
}) {
  const [rec, setRec] = useState<{ recorder: MediaRecorder; started: number; stream: MediaStream } | null>(null);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [, tick] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rec) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(rec.stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
      setLevel(peak);
      tick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [rec]);

  const send = async (blob: Blob, name: string) => {
    setBusy("Uploading…");
    try {
      const out = await api.uploadRecording(blob, name, language, (f) => setBusy(f < 1 ? `Uploading ${Math.round(f * 100)}%` : "Transcribing your voice… (the first time downloads the speech model)"));
      onChange(out);
      toast.success("Got it", { description: `${out.words.length} words heard.` });
    } catch (err) {
      toast.error("Couldn't use that recording", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        void send(new Blob(chunks, { type: recorder.mimeType }), "narration.webm");
      };
      recorder.start(1000);
      setRec({ recorder, started: Date.now(), stream });
    } catch (err) {
      toast.error("Couldn't use the microphone", { description: (err as Error).message });
    }
  };

  const match = useMemo(() => {
    if (!value || !scenes.length) return null;
    const spans = alignScenes(scenes, value.words);
    return { found: spans.filter((s) => s.end - s.start > 0.2).length, total: scenes.length };
  }, [value, scenes]);

  const seconds = rec ? Math.floor((Date.now() - rec.started) / 1000) : 0;

  return (
    <div className="border border-line bg-panel p-4">
      {scenes.length > 0 && !value && (
        <div className="mb-4 max-h-72 overflow-y-auto border border-line bg-panel-sunken p-4">
          <p className="eyebrow mb-2">Read this aloud</p>
          {scenes.map((s, i) => (
            <p key={i} className="mb-3 text-lg leading-8">
              {s}
            </p>
          ))}
        </div>
      )}

      {value ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Check className="size-4 text-good" /> Your recording ({Math.round(value.media.duration ?? 0)}s, {value.words.length} words)
          </p>
          <audio src={value.media.src} controls className="w-full" />
          {match && (
            <p className={match.found < match.total ? "text-xs text-warn" : "text-xs text-muted-foreground"}>
              {match.found} of {match.total} scenes found in the recording.{match.found < match.total ? " Scenes you didn't read are left out." : ""}
            </p>
          )}
          {!scenes.length && <p className="line-clamp-3 text-xs text-muted-foreground">Heard: {value.text}</p>}
          <Button variant="outline" size="sm" className="gap-1.5 rounded-none" onClick={() => onChange(null)}>
            <RotateCcw className="size-3.5" /> Record again
          </Button>
        </div>
      ) : busy ? (
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> {busy}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {rec ? (
            <>
              <Button className="gap-1.5 rounded-none" onClick={() => rec.recorder.stop()}>
                <Square className="size-4" /> Stop ({Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")})
              </Button>
              <div className="h-2 w-40 overflow-hidden bg-line">
                <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.min(100, level * 180)}%` }} />
              </div>
            </>
          ) : (
            <Button className="gap-1.5 rounded-none" onClick={start}>
              <Mic className="size-4" /> Record
            </Button>
          )}
          <input ref={input} type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && void send(e.target.files[0], e.target.files[0].name)} />
          <Button variant="outline" className="gap-1.5 rounded-none" disabled={!!rec} onClick={() => input.current?.click()}>
            <Upload className="size-4" /> Upload audio or video
          </Button>
          <p className="w-full text-xs text-muted-foreground">Speak in {language}. A quiet room and a steady distance from the mic give the cleanest result.</p>
        </div>
      )}
    </div>
  );
}
