import { useEffect, useRef, useState } from "react";
import { Circle, Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, assetFromUpload } from "@/lib/api";
import { useStore } from "@/store";
import { placeAsset } from "../importFiles";
import { PanelHeader } from "./common";

function recordingType(): string | undefined {
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return undefined;
}

export function RecordTab() {
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const recRef = useRef<{ rec: MediaRecorder; stream: MediaStream; chunks: Blob[]; raf: number; started: number } | null>(null);

  useEffect(() => () => stop(true), []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = recordingType();
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const ac = new AudioContext();
      const analyser = ac.createAnalyser();
      ac.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const started = performance.now();
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevel(peak);
        setSeconds((performance.now() - started) / 1000);
        if (recRef.current) recRef.current.raf = requestAnimationFrame(tick);
      };
      recRef.current = { rec, stream, chunks, raf: requestAnimationFrame(tick), started };
      // Start recording at the playhead, so it lines up with what's on screen.
      useStore.getState().setPlaying(false);
      rec.start(250);
      setState("recording");
    } catch (err) {
      toast.error("Couldn't use the microphone", { description: (err as Error).message });
    }
  };

  const stop = (discard = false) => {
    const r = recRef.current;
    if (!r) return;
    recRef.current = null;
    cancelAnimationFrame(r.raf);
    const at = useStore.getState().time;
    r.rec.onstop = async () => {
      r.stream.getTracks().forEach((t) => t.stop());
      if (discard) return;
      setState("saving");
      try {
        const type = r.rec.mimeType || "audio/webm";
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(r.chunks, { type });
        const up = await api.upload(blob, `recording.${ext}`, "recording");
        const asset = assetFromUpload(up, `Recording ${new Date().toLocaleTimeString()}`);
        useStore.getState().addAsset(asset);
        useStore.getState().setTime(at);
        placeAsset(asset);
        toast.success("Recording added", { description: "Ask the AI Director for captions from what you said." });
      } catch (err) {
        toast.error("Couldn't save the recording", { description: (err as Error).message });
      } finally {
        setState("idle");
        setSeconds(0);
        setLevel(0);
      }
    };
    r.rec.stop();
  };

  return (
    <>
      <PanelHeader title="Record your voice" subtitle="Record a voiceover. It lands on the timeline at the playhead." />
      <div className="flex flex-1 flex-col items-center gap-5 p-6 text-center">
        <div className="relative flex size-32 items-center justify-center rounded-full border border-line bg-panel-sunken">
          <div className="absolute inset-0 rounded-full bg-destructive/20 transition-transform" style={{ transform: `scale(${state === "recording" ? 0.6 + level * 1.2 : 0})` }} />
          <Mic className="relative size-10 text-foreground" />
        </div>
        <p className="font-mono text-2xl tabular-nums">{Math.floor(seconds / 60)}:{String(Math.floor(seconds % 60)).padStart(2, "0")}</p>
        {state === "idle" && (
          <Button size="lg" className="gap-2" onClick={start}>
            <Circle className="size-3.5 fill-current text-destructive" /> Start recording
          </Button>
        )}
        {state === "recording" && (
          <Button size="lg" variant="destructive" className="gap-2" onClick={() => stop()}>
            <Square className="size-3.5 fill-current" /> Stop
          </Button>
        )}
        {state === "saving" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Saving…
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">Tip: for a narrated presentation you don't have to record. The AI can write the script and speak it in a natural voice, with captions timed to every word.</p>
      </div>
    </>
  );
}
