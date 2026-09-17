import { useEffect, useState } from "react";
import { Check, Download, FileAudio, Film, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { demoAllows, flushSave, useStore } from "@/store";
import { downloadBlob, exportVideo, finalizeForPlayers } from "@/export";
import { generateVoices, pendingVoices } from "@/voice";
import { api } from "@/lib/api";
import { captureThumbnail } from "./thumbnail";

type Format = "mp4" | "gif" | "mp3" | "cover";

const FORMATS: { id: Format; label: string; blurb: string; icon: typeof Film }[] = [
  { id: "mp4", label: "Video", blurb: "MP4 that plays everywhere", icon: Film },
  { id: "gif", label: "GIF", blurb: "A short looping clip, up to 20s", icon: Sparkles },
  { id: "mp3", label: "Sound only", blurb: "MP3 of the soundtrack", icon: FileAudio },
  { id: "cover", label: "Cover picture", blurb: "A JPG frame (at the playhead)", icon: ImageIcon },
];

function safeName(title: string) {
  return title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "video";
}

export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const duration = useStore((s) => s.scene.duration);
  const title = useStore((s) => s.title);
  const [format, setFormat] = useState<Format>("mp4");
  const [size, setSize] = useState<"full" | "small">("full");
  const [fps, setFps] = useState<string>("");
  const [part, setPart] = useState(false);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(duration);
  const [job, setJob] = useState<{ phase: string; progress: number; controller: AbortController } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDone(null);
      setTo(useStore.getState().scene.duration);
      setFrom(0);
    }
  }, [open]);

  const run = async () => {
    if (!demoAllows("export")) return;
    const controller = new AbortController();
    const set = (phase: string, progress: number) => setJob({ phase, progress, controller });
    setDone(null);
    useStore.getState().setPlaying(false);
    try {
      // Lines and narration that aren't voiced yet get their voices first.
      const pre = useStore.getState();
      const pending = pendingVoices(pre.scene);
      const notes: string[] = [];
      if (pre.voices && pending) {
        set(`Recording ${pending} voice${pending > 1 ? "s" : ""}…`, 0);
        const r = await generateVoices(undefined, (d, t) => set(`Recording voices ${d}/${t}…`, d / t));
        if (r.failed.length) notes.push(`${r.failed.length} voice(s) failed: ${r.failed[0]}`);
      }
      await flushSave();
      const { scene, assets } = useStore.getState();
      set("Rendering the video…", 0);
      let out = await exportVideo(scene, assets, (p) => set("Rendering the video…", p), controller.signal);
      if (out.ext === "webm" || out.audio === "opus") {
        set("Finishing so the sound plays in every player…", 1);
        out = await finalizeForPlayers(out);
      }
      const base = safeName(title);
      const range = part ? { start: Math.max(0, from), end: Math.min(scene.duration, to) } : {};
      if (format === "mp4" && !part && size === "full" && !fps) {
        downloadBlob(out.blob, `${base}.${out.ext}`);
        setDone(`${base}.${out.ext} · ${(out.blob.size / 1e6).toFixed(1)} MB · ${scene.duration.toFixed(1)}s${out.audio ? " · with sound" : " · silent"}`);
      } else {
        set(format === "gif" ? "Making the GIF…" : format === "mp3" ? "Taking out the sound…" : format === "cover" ? "Taking the picture…" : "Making your version…", 1);
        const converted = await api.convert(out.blob, { format, size, fps: fps || undefined, at: format === "cover" ? useStore.getState().time : undefined, ...range });
        downloadBlob(converted.blob, `${base}.${converted.ext}`);
        setDone(`${base}.${converted.ext} · ${(converted.blob.size / 1e6).toFixed(1)} MB`);
      }
      if (out.note) notes.push(out.note);
      if (notes.length) toast.message("Heads up", { description: notes.join(" ") });
      void captureThumbnail();
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error("Export failed", { description: (err as Error).message });
    } finally {
      setJob(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !job && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Export</DialogTitle>
          <DialogDescription>Rendered on this computer, frame by frame, with every voice and sound.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              disabled={!!job}
              className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition", format === f.id ? "border-primary bg-primary/10" : "border-line hover:border-primary/50")}
            >
              <f.icon className={cn("mt-0.5 size-5", format === f.id ? "text-primary" : "text-muted-foreground")} />
              <span>
                <span className="block text-sm font-medium">{f.label}</span>
                <span className="block text-xs text-muted-foreground">{f.blurb}</span>
              </span>
            </button>
          ))}
        </div>

        {format !== "cover" && (
          <div className="space-y-3 rounded-xl border border-line p-3 text-sm">
            {(format === "mp4" || format === "gif") && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Size</span>
                <div className="flex gap-1">
                  {(["full", "small"] as const).map((s) => (
                    <button key={s} className={cn("chip", size === s && "border-primary text-primary")} onClick={() => setSize(s)}>
                      {s === "full" ? "Full quality" : format === "gif" ? "Small (320px)" : "Smaller file (720p)"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {format === "mp4" && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Frame rate</span>
                <select className="select-native" value={fps} onChange={(e) => setFps(e.target.value)}>
                  <option value="">As the project ({useStore.getState().scene.fps} fps)</option>
                  <option value="24">24 fps (film)</option>
                  <option value="25">25 fps</option>
                  <option value="30">30 fps</option>
                  <option value="60">60 fps</option>
                </select>
              </div>
            )}
            <label className="flex items-center justify-between">
              <span className="text-muted-foreground">Only part of it</span>
              <input type="checkbox" checked={part || format === "gif"} disabled={format === "gif"} onChange={(e) => setPart(e.target.checked)} />
            </label>
            {(part || format === "gif") && (
              <div className="flex items-center gap-2">
                <input type="number" className="num-input w-20" step={0.1} min={0} value={from} onChange={(e) => setFrom(Number(e.target.value))} />
                <span className="text-muted-foreground">to</span>
                <input type="number" className="num-input w-20" step={0.1} min={0} value={format === "gif" ? Math.min(to, from + 20) : to} onChange={(e) => setTo(Number(e.target.value))} />
                <span className="text-xs text-muted-foreground">seconds of {duration.toFixed(1)}</span>
              </div>
            )}
          </div>
        )}

        {job ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> {job.phase}
              </span>
              <span className="font-mono text-xs">{Math.round(job.progress * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-line">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(job.progress * 100)}%` }} />
            </div>
            <Button variant="outline" size="sm" onClick={() => job.controller.abort()}>
              Cancel
            </Button>
          </div>
        ) : done ? (
          <div className="flex items-center gap-2 rounded-xl border border-good/40 bg-good/10 p-3 text-sm">
            <Check className="size-4 text-good" /> Saved {done}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!job}>
            Close
          </Button>
          <Button className="gap-2" onClick={run} disabled={!!job}>
            <Download className="size-4" /> {done ? "Export again" : "Export"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
