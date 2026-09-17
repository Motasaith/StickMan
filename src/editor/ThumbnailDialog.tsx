// YouTube thumbnails: a frame of the video (or an AI picture) with big, readable text, in a few
// layouts side by side. Each downloads as a 1280x720 JPG.

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { downloadBlob, renderStill } from "@/export";
import { fontCss } from "@/engine/fonts";
import { wrap } from "@/engine/media";
import type { FontName } from "@/engine/scene";

const W = 1280;
const H = 720;

type Layout = "left" | "center" | "bar" | "panel";
const LAYOUTS: { id: Layout; label: string }[] = [
  { id: "left", label: "Bold left" },
  { id: "center", label: "Center punch" },
  { id: "bar", label: "Bottom bar" },
  { id: "panel", label: "Side panel" },
];
const ACCENTS = ["#F5B400", "#FF3B30", "#22C55E", "#38BDF8", "#FFFFFF", "#E879F9"];
const FONTS: { id: FontName; label: string }[] = [
  { id: "anton", label: "Anton" },
  { id: "bebas", label: "Bebas" },
  { id: "poppins", label: "Poppins" },
  { id: "archivo", label: "Archivo" },
];

/** Cover-fit a picture into the thumbnail. */
function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource & { width: number; height: number }) {
  const s = Math.max(W / src.width, H / src.height);
  const w = src.width * s;
  const h = src.height * s;
  ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
}

function drawThumb(ctx: CanvasRenderingContext2D, bg: (CanvasImageSource & { width: number; height: number }) | null, layout: Layout, text: string, sub: string, accent: string, font: FontName) {
  ctx.save();
  ctx.fillStyle = "#0B0B12";
  ctx.fillRect(0, 0, W, H);
  if (bg) drawCover(ctx, bg);
  // Punchier picture: a little more contrast and saturation.
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";

  const words = text.toUpperCase().trim() || "YOUR TITLE";
  const box = layout === "panel" ? W * 0.42 : layout === "left" ? W * 0.56 : W * 0.86;
  let size = layout === "bar" ? 120 : 170;
  let lines = wrap(ctx, words, fontCss(font, size, true, false, words), size, box, 0);
  while ((lines.length * size * 1.02 > H * (layout === "bar" ? 0.3 : 0.62) || lines.length > 4) && size > 48) {
    size -= 6;
    lines = wrap(ctx, words, fontCss(font, size, true, false, words), size, box, 0);
  }
  const lineH = size * 1.02;
  const blockH = lines.length * lineH;

  let x = 60;
  let y = (H - blockH) / 2;
  ctx.textAlign = "left";
  if (layout === "left") {
    const g = ctx.createLinearGradient(0, 0, W * 0.7, 0);
    g.addColorStop(0, "rgba(0,0,0,0.85)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (layout === "center") {
    const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, "rgba(0,0,0,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    x = W / 2;
  } else if (layout === "bar") {
    const barH = blockH + 70;
    ctx.fillStyle = accent;
    ctx.fillRect(0, H - barH, W, barH);
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(0, H - barH - 10, W, 10);
    y = H - barH + 35;
  } else {
    ctx.fillStyle = "rgba(10,10,18,0.9)";
    ctx.fillRect(W - box - 110, 0, box + 110, H);
    ctx.fillStyle = accent;
    ctx.fillRect(W - box - 110, 0, 14, H);
    x = W - box - 50;
  }

  ctx.font = fontCss(font, size, true, false, words);
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  lines.forEach((line, i) => {
    const ly = y + i * lineH;
    const onBar = layout === "bar";
    // Alternate the accent on the last line so the key words pop.
    const fill = onBar ? "#0B0B12" : i === lines.length - 1 && lines.length > 1 ? accent : "#FFFFFF";
    if (!onBar) {
      ctx.lineWidth = size * 0.14;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(line, x, ly);
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 6;
    }
    ctx.fillStyle = fill;
    ctx.fillText(line, x, ly);
    ctx.shadowColor = "transparent";
  });

  if (sub.trim()) {
    const s = 38;
    ctx.font = fontCss("poppins", s, true, false, sub);
    const tw = Math.min(ctx.measureText(sub).width, W - 120);
    const sx = layout === "center" ? W / 2 - tw / 2 - 18 : x - 18;
    const sy = layout === "bar" ? H - blockH - 70 - 10 - s - 40 : Math.min(H - s - 40, y + blockH + 18);
    ctx.fillStyle = layout === "bar" ? "#0B0B12" : accent;
    ctx.fillRect(sx, sy, tw + 36, s + 22);
    ctx.fillStyle = layout === "bar" ? "#FFFFFF" : "#0B0B12";
    ctx.textAlign = "left";
    ctx.fillText(sub, sx + 18, sy + 10, W - 120);
  }
  ctx.restore();
}

interface Background {
  id: string;
  label: string;
  src: HTMLCanvasElement | HTMLImageElement;
}

export function ThumbnailDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const scene = useStore((s) => s.scene);
  const title = useStore((s) => s.title);
  const [text, setText] = useState(scene.publish?.thumbnailText || scene.title || title);
  const [sub, setSub] = useState("");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [font, setFont] = useState<FontName>("anton");
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [bg, setBg] = useState(0);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [drawing, setDrawing] = useState(false);

  // Candidate frames spread over the video, skipping the intro and outro.
  const times = useMemo(() => {
    const body = (scene.slides ?? []).filter((s) => s.id !== "intro" && s.id !== "outro");
    if (body.length) {
      const pick = [0, Math.floor(body.length / 3), Math.floor((body.length * 2) / 3), body.length - 1];
      return [...new Set(pick)].map((i) => body[i].start + body[i].duration * 0.5);
    }
    return [0.2, 0.4, 0.6, 0.8].map((f) => scene.duration * f);
  }, [scene]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const out: Background[] = [];
      const { assets } = useStore.getState();
      // Backgrounds without captions or on-screen text; the thumbnail adds its own.
      const clean = { ...scene, objects: scene.objects.filter((o) => o.type !== "caption" && o.type !== "text") };
      for (const [i, t] of times.entries()) {
        try {
          const c = await renderStill(clean, assets, t);
          if (cancelled) return;
          out.push({ id: `frame${i}`, label: `Frame at ${Math.round(t)}s`, src: c });
          setBackgrounds([...out]);
        } catch {
          /* skip a frame that won't draw */
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Frames are taken once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const drawAi = async () => {
    if (!prompt.trim()) return;
    setDrawing(true);
    try {
      const up = await api.aiImage(`${prompt.trim()}, dramatic YouTube thumbnail background, high contrast, no text`, W, H);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((ok, fail) => {
        img.onload = ok;
        img.onerror = fail;
        img.src = up.src;
      });
      setBackgrounds((b) => {
        setBg(b.length);
        return [...b, { id: up.id, label: "AI picture", src: img }];
      });
    } catch (err) {
      toast.error("Couldn't draw a background", { description: (err as Error).message });
    } finally {
      setDrawing(false);
    }
  };

  const current = backgrounds[bg]?.src ?? null;

  const download = (layout: Layout) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    drawThumb(c.getContext("2d")!, current, layout, text, sub, accent, font);
    c.toBlob((b) => b && downloadBlob(b, `thumbnail-${layout}.jpg`), "image/jpeg", 0.9);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Thumbnail maker</DialogTitle>
          <DialogDescription>Pick a background and a layout, then download a 1280x720 JPG for YouTube.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Big text (3 to 5 words work best)</span>
              <input value={text} onChange={(e) => setText(e.target.value)} className="field-text" maxLength={60} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Small tag (optional)</span>
              <input value={sub} onChange={(e) => setSub(e.target.value)} className="field-text" maxLength={40} placeholder="EXPLAINED" />
            </label>
            <div>
              <span className="text-xs text-muted-foreground">Accent</span>
              <div className="mt-1 flex gap-1.5">
                {ACCENTS.map((c) => (
                  <button key={c} aria-label={c} onClick={() => setAccent(c)} className={cn("size-6 rounded-full border border-line", accent === c && "ring-2 ring-primary ring-offset-1 ring-offset-background")} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {FONTS.map((f) => (
                <button key={f.id} className={cn("chip", font === f.id && "border-primary text-primary")} onClick={() => setFont(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Background</span>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {backgrounds.map((b, i) => (
                  <BgChoice key={b.id} bg={b} active={i === bg} onClick={() => setBg(i)} />
                ))}
                {loading && (
                  <div className="flex aspect-video items-center justify-center rounded border border-line">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="field-text h-auto resize-none py-1.5" placeholder="Or an AI background: a shocked man staring at a falling stock chart" />
              <button className="chip justify-center" disabled={drawing || !prompt.trim()} onClick={drawAi}>
                {drawing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Draw background
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {LAYOUTS.map((l) => (
              <div key={l.id} className="flex flex-col gap-1.5">
                <ThumbPreview draw={(ctx) => drawThumb(ctx, current, l.id, text, sub, accent, font)} deps={[current, text, sub, accent, font, l.id]} />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{l.label}</span>
                  <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => download(l.id)}>
                    <Download className="size-3.5" /> JPG
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BgChoice({ bg, active, onClick }: { bg: Background; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={bg.label} className={cn("overflow-hidden rounded border", active ? "border-primary ring-1 ring-primary" : "border-line")}>
      <ThumbPreview draw={(ctx) => drawCover(ctx, bg.src)} deps={[bg.src]} small />
    </button>
  );
}

function ThumbPreview({ draw, deps, small }: { draw: (ctx: CanvasRenderingContext2D) => void; deps: unknown[]; small?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.scale(c.width / W, c.height / H);
    draw(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <canvas ref={ref} width={small ? 256 : 640} height={small ? 144 : 360} className="aspect-video w-full rounded border border-line bg-black" />;
}
