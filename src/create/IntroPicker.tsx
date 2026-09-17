// Intro and outro templates with live previews: each card plays its animation while hovered.

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { emptyScene, type Scene } from "@/engine/scene";
import { addIntro, addOutro, INTROS, OUTROS } from "@/engine/intros";
import { renderScene } from "@/engine/render";
import { canvasPool, svgLookup } from "@/runtime/media";

function previewScene(kind: "intro" | "outro", id: string, title: string, channel: string, accent: string, vertical: boolean): { scene: Scene; from: number; to: number } {
  const [W, H] = vertical ? [720, 1280] : [1280, 720];
  const base = emptyScene(W, H);
  base.duration = 0.5;
  base.slides = [{ id: "main", title: "Main", start: 0, duration: 0.5, background: { kind: "color", color: "#27272a" }, transition: { kind: "cut", duration: 0 } }];
  const card = { title, subtitle: "A video you won't forget", channel: channel || "Your Channel", accent, accent2: "#4c1d95" };
  const scene = kind === "intro" ? addIntro(base, id, card).scene : addOutro(base, id, card).scene;
  const section = scene.slides!.find((s) => s.id === kind)!;
  return { scene, from: section.start, to: section.start + section.duration };
}

let shared: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
function sharedCanvas(w: number, h: number) {
  if (!shared) {
    const canvas = document.createElement("canvas");
    shared = { canvas, ctx: canvas.getContext("2d")! };
  }
  if (shared.canvas.width !== w || shared.canvas.height !== h) {
    shared.canvas.width = w;
    shared.canvas.height = h;
  }
  return shared;
}

function Preview({ kind, id, title, channel, accent, vertical, active }: { kind: "intro" | "outro"; id: string; title: string; channel: string; accent: string; vertical: boolean; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { scene, from, to } = useMemo(() => previewScene(kind, id, title, channel, accent, vertical), [kind, id, title, channel, accent, vertical]);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const svgs = svgLookup([]);
    const pool = canvasPool();
    // Scenes render at full size (sections reset the transform), then shrink into the card.
    const draw = (t: number) => {
      const full = sharedCanvas(scene.width, scene.height);
      pool.reset();
      renderScene(full.ctx, scene, t, { svgs, makeCanvas: pool });
      ctx.drawImage(full.canvas, 0, 0, canvas.width, canvas.height);
    };
    if (!active) {
      draw(from + (to - from) * 0.65);
      // Stickers load in the background; draw again once they are in.
      const t = setTimeout(() => draw(from + (to - from) * 0.65), 600);
      return () => clearTimeout(t);
    }
    let raf = 0;
    const started = performance.now();
    const loop = () => {
      draw(from + (((performance.now() - started) / 1000) % (to - from)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scene, from, to, active]);
  return <canvas ref={ref} width={vertical ? 108 : 256} height={vertical ? 192 : 144} className="block w-full bg-black" />;
}

export function IntroPicker({
  kind,
  value,
  onChange,
  title,
  channel,
  accent,
  vertical,
}: {
  kind: "intro" | "outro";
  value: string | null;
  onChange: (id: string | null) => void;
  title: string;
  channel: string;
  accent: string;
  vertical: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const list = kind === "intro" ? INTROS : OUTROS;
  return (
    <div className={cn("grid gap-2", vertical ? "grid-cols-4" : "grid-cols-2")}>
      <button
        onClick={() => onChange(null)}
        className={cn("flex flex-col items-center justify-center gap-1 border p-2 text-xs", value === null ? "border-foreground bg-panel-raised" : "border-line hover:border-foreground")}
      >
        <Ban className="size-4 text-muted-foreground" />
        No {kind}
      </button>
      {list.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          onMouseEnter={() => setHover(t.id)}
          onMouseLeave={() => setHover(null)}
          title={t.blurb}
          className={cn("overflow-hidden border text-left", value === t.id ? "border-foreground shadow-[3px_3px_0_0_hsl(var(--foreground))]" : "border-line hover:border-foreground")}
        >
          <Preview kind={kind} id={t.id} title={title} channel={channel} accent={accent} vertical={vertical} active={hover === t.id} />
          <p className="px-2 py-1 text-[11px] font-medium">
            {t.label} <span className="font-normal text-muted-foreground">{t.duration}s</span>
          </p>
        </button>
      ))}
    </div>
  );
}
