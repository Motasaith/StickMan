// The timeline: a track per object with clip bars you can move and trim, keyframes you can
// drag, a slide strip for presentations, markers, snapping and zoom.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Box,
  Captions,
  ChartColumn,
  Copy,
  Eye,
  EyeOff,
  Film,
  Flag,
  Image as ImageIcon,
  Lightbulb,
  Lock,
  Magnet,
  Minus,
  Music,
  PawPrint,
  PersonStanding,
  Plus,
  Scissors,
  ScanLine,
  Shapes,
  Smile,
  Sparkles,
  MessageCircle,
  Trash2,
  Type,
  Unlock,
  Video,
} from "lucide-react";
import { useStore } from "@/store";
import { cloneScene, findObj, type Asset, type Scene, type SceneObj } from "@/engine/scene";
import { keyTimes, moveKeysAt } from "@/engine/tracks";
import { setSlideDuration } from "@/engine/slides";
import { cn } from "@/lib/utils";
import { duplicateObject, objectSpan, shiftObject, splitAtPlayhead } from "./actions";

const HEADER_W = 188;
const ROW_H = 32;
const MEDIA_ROW_H = 44;

const TYPE_STYLE: Record<string, { icon: typeof Film; bar: string }> = {
  stickman: { icon: PersonStanding, bar: "bg-clip-character/25 border-clip-character/70" },
  creature: { icon: PawPrint, bar: "bg-clip-character/25 border-clip-character/70" },
  drawing: { icon: Shapes, bar: "bg-clip-shape/25 border-clip-shape/70" },
  text: { icon: Type, bar: "bg-clip-title/25 border-clip-title/70" },
  bubble: { icon: MessageCircle, bar: "bg-clip-title/20 border-clip-title/60" },
  image: { icon: ImageIcon, bar: "bg-clip-image/25 border-clip-image/70" },
  svg: { icon: Smile, bar: "bg-clip-sticker/25 border-clip-sticker/70" },
  video: { icon: Video, bar: "bg-clip-video/30 border-clip-video/80" },
  audio: { icon: AudioLines, bar: "bg-clip-voice/25 border-clip-voice/80" },
  sound: { icon: Music, bar: "bg-clip-music/25 border-clip-music/70" },
  effect: { icon: Sparkles, bar: "bg-clip-effect/25 border-clip-effect/70" },
  caption: { icon: Captions, bar: "bg-clip-title/20 border-clip-title/60" },
  region: { icon: ScanLine, bar: "bg-clip-shape/20 border-clip-shape/60" },
  chart: { icon: ChartColumn, bar: "bg-clip-image/20 border-clip-image/60" },
  light: { icon: Lightbulb, bar: "bg-clip-sticker/20 border-clip-sticker/60" },
};

export function Timeline() {
  const scene = useStore((s) => s.scene);
  const assets = useStore((s) => s.assets);
  const selectedId = useStore((s) => s.selectedId);
  const selectedKey = useStore((s) => s.selectedKey);
  const zoom = useStore((s) => s.timelineZoom);
  const snapping = useStore((s) => s.snapping);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(800);

  useEffect(() => {
    const el = scrollRef.current!;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth - HEADER_W - 16));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const duration = Math.max(1, scene.duration);
  const pps = (Math.max(200, viewW) / duration) * zoom;
  const contentW = Math.max(viewW, duration * pps + 40);

  // Keep the playhead in view while playing.
  useEffect(() => {
    return useStore.subscribe((s, prev) => {
      if (!s.playing || s.time === prev.time) return;
      const el = scrollRef.current;
      if (!el) return;
      const x = s.time * pps;
      if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - HEADER_W - 40) el.scrollLeft = Math.max(0, x - 80);
    });
  }, [pps]);

  const timeAt = (clientX: number) => {
    const el = scrollRef.current!;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(duration, (clientX - rect.left - HEADER_W + el.scrollLeft) / pps));
  };

  /** Snap a time to the playhead, markers, slide edges and other clips' edges. */
  const snapPoints = useMemo(() => {
    const pts: number[] = [0, scene.duration];
    for (const m of scene.markers ?? []) pts.push(m.t);
    for (const sl of scene.slides ?? []) pts.push(sl.start, sl.start + sl.duration);
    for (const o of scene.objects) {
      const [a, b] = objectSpan(o, scene.duration);
      pts.push(a, b);
    }
    return pts;
  }, [scene]);
  const snap = (t: number, exclude: number[] = []) => {
    if (!snapping) return Math.round(t * scene.fps) / scene.fps;
    const tol = 7 / pps;
    let best = t;
    let bestD = tol;
    for (const p of [...snapPoints, useStore.getState().time]) {
      if (exclude.some((e) => Math.abs(e - p) < 1e-6)) continue;
      const d = Math.abs(p - t);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best === t ? Math.round(t * scene.fps) / scene.fps : best;
  };

  const scrub = (e: React.PointerEvent) => {
    const s = useStore.getState();
    s.setPlaying(false);
    s.setTime(timeAt(e.clientX));
    const move = (ev: PointerEvent) => useStore.getState().setTime(timeAt(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** Drag something horizontally; `apply` builds the preview scene for a time delta. */
  const dragTime = (e: React.PointerEvent, apply: (next: Scene, dt: number) => void, onClick?: () => void) => {
    e.stopPropagation();
    const s = useStore.getState();
    s.setPlaying(false);
    const base = s.scene;
    const startX = e.clientX;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 3) return;
      moved = true;
      const next = cloneScene(base);
      apply(next, dx / pps);
      useStore.getState().preview(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (moved) useStore.getState().commit(useStore.getState().scene, base);
      else onClick?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const visual = [...scene.objects].reverse().filter((o) => o.type !== "audio" && o.type !== "sound" && o.type !== "caption");
  const sound = scene.objects.filter((o) => o.type === "audio" || o.type === "sound" || o.type === "caption");
  const rows = [...visual, ...sound];
  const step = pickStep(pps);
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step);

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: HEADER_W + contentW }}>
          {/* Ruler */}
          <div className="sticky top-0 z-20 flex h-7 border-b border-line bg-panel">
            <div className="sticky left-0 z-10 flex shrink-0 items-center border-r border-line bg-panel px-3" style={{ width: HEADER_W }}>
              <span className="eyebrow">{rows.length} tracks</span>
            </div>
            <div className="relative flex-1 cursor-pointer" onPointerDown={scrub}>
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full border-l border-line/70" style={{ left: t * pps }}>
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">{fmtTick(t)}</span>
                </div>
              ))}
              {(scene.markers ?? []).map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 z-10 -translate-x-1/2 cursor-ew-resize"
                  style={{ left: m.t * pps }}
                  title={`${m.label} (${m.t.toFixed(2)}s): drag to move, double-click to remove`}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const next = cloneScene(useStore.getState().scene);
                    next.markers = (next.markers ?? []).filter((_, j) => j !== i);
                    useStore.getState().commit(next);
                  }}
                  onPointerDown={(e) =>
                    dragTime(e, (next, dt) => {
                      const mk = next.markers![i];
                      mk.t = Math.max(0, Math.min(next.duration, snap(m.t + dt, [m.t])));
                    }, () => useStore.getState().setTime(m.t))
                  }
                >
                  <Flag className="size-3.5 fill-warn text-warn" />
                </div>
              ))}
            </div>
          </div>

          {/* Slides */}
          {scene.slides?.length ? (
            <div className="flex border-b border-line" style={{ height: 36 }}>
              <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-line bg-panel px-3 text-xs" style={{ width: HEADER_W }}>
                <Film className="size-3.5 text-clip-slide" /> Slides
              </div>
              <div className="relative flex-1" onPointerDown={scrub}>
                {scene.slides.map((sl, i) => {
                  const sel = selectedId === `slide:${sl.id}`;
                  return (
                    <div
                      key={sl.id}
                      className={cn("absolute top-1 bottom-1 overflow-hidden rounded-md border bg-clip-slide/25 px-2 text-[11px] leading-[26px]", sel ? "border-primary ring-1 ring-primary" : "border-clip-slide/70")}
                      style={{ left: sl.start * pps + 1, width: Math.max(8, sl.duration * pps - 2) }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const s = useStore.getState();
                        s.select(`slide:${sl.id}`);
                        s.setMode("edit");
                        s.setPlaying(false);
                        s.setTime(Math.max(sl.start, Math.min(sl.start + sl.duration - 0.01, timeAt(e.clientX))));
                      }}
                      title={`${sl.title}: ${sl.duration.toFixed(1)}s`}
                    >
                      <span className="mr-1 font-mono text-muted-foreground">{i + 1}</span>
                      {sl.title}
                      <div
                        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-primary/40"
                        onPointerDown={(e) =>
                          dragTime(e, (next, dt) => {
                            setSlideDuration(next, sl.id, Math.max(1, snap(sl.start + sl.duration + dt, [sl.start + sl.duration]) - sl.start));
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Tracks */}
          {rows.map((o) => (
            <TrackRow
              key={o.id}
              obj={o}
              asset={"asset" in o && typeof o.asset === "string" ? assets.find((a) => a.id === o.asset) : undefined}
              duration={scene.duration}
              pps={pps}
              selected={selectedId === o.id}
              selectedKey={selectedKey?.id === o.id ? selectedKey.t : null}
              onScrub={scrub}
              onDrag={dragTime}
              snap={snap}
            />
          ))}
          {rows.length === 0 && <div className="px-4 py-6 text-sm text-muted-foreground">Things you add show up here as tracks you can move, trim and animate.</div>}

          <Playhead pps={pps} />
        </div>
      </div>
    </div>
  );
}

function Toolbar() {
  const zoom = useStore((s) => s.timelineZoom);
  const snapping = useStore((s) => s.snapping);
  const selectedId = useStore((s) => s.selectedId);
  const hasSel = !!selectedId && !selectedId.startsWith("slide:");
  const btn = "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40";
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-2">
      <button className={btn} title="Split the clip at the playhead (S)" onClick={splitAtPlayhead}>
        <Scissors className="size-3.5" /> Split
      </button>
      <button className={btn} disabled={!hasSel} title="Duplicate (Ctrl+D)" onClick={() => selectedId && duplicateObject(selectedId)}>
        <Copy className="size-3.5" /> Duplicate
      </button>
      <button
        className={btn}
        disabled={!selectedId}
        title="Delete (Del)"
        onClick={() => {
          const s = useStore.getState();
          if (!s.selectedId) return;
          if (s.selectedId.startsWith("slide:")) s.run([{ op: "removeSlide", id: s.selectedId.slice(6) }]);
          else s.run([{ op: "remove", id: s.selectedId }]);
        }}
      >
        <Trash2 className="size-3.5" /> Delete
      </button>
      <div className="mx-1 h-4 w-px bg-line" />
      <button
        className={btn}
        title="Add a marker at the playhead (M)"
        onClick={() => {
          const s = useStore.getState();
          s.run([{ op: "marker", at: Math.round(s.time * 100) / 100, label: `Marker ${(s.scene.markers?.length ?? 0) + 1}` }]);
        }}
      >
        <Flag className="size-3.5" /> Marker
      </button>
      <button className={cn(btn, snapping && "text-primary")} title="Snap to playhead, markers and clip edges" onClick={() => useStore.getState().setSnapping(!snapping)}>
        <Magnet className="size-3.5" /> Snap
      </button>
      <div className="ml-auto flex items-center gap-1">
        <button className={btn} title="Zoom out" onClick={() => useStore.getState().setTimelineZoom(zoom / 1.5)}>
          <Minus className="size-3.5" />
        </button>
        <input type="range" min={-2} max={3.5} step={0.05} value={Math.log2(zoom)} onChange={(e) => useStore.getState().setTimelineZoom(2 ** Number(e.target.value))} className="w-28 accent-[hsl(var(--primary))]" title="Timeline zoom" />
        <button className={btn} title="Zoom in" onClick={() => useStore.getState().setTimelineZoom(zoom * 1.5)}>
          <Plus className="size-3.5" />
        </button>
        <button className={btn} title="Fit the whole video" onClick={() => useStore.getState().setTimelineZoom(1)}>
          Fit
        </button>
      </div>
    </div>
  );
}

const TrackRow = memo(function TrackRow(props: {
  obj: SceneObj;
  asset: Asset | undefined;
  duration: number;
  pps: number;
  selected: boolean;
  selectedKey: number | null;
  onScrub: (e: React.PointerEvent) => void;
  onDrag: (e: React.PointerEvent, apply: (next: Scene, dt: number) => void, onClick?: () => void) => void;
  snap: (t: number, exclude?: number[]) => number;
}) {
  const { obj: o, pps, asset } = props;
  const style = TYPE_STYLE[o.type] ?? { icon: Box, bar: "bg-muted border-line" };
  const Icon = style.icon;
  const media = o.type === "video" || o.type === "audio";
  const h = media ? MEDIA_ROW_H : ROW_H;
  const [a, b] = objectSpan(o, props.duration);
  const times = o.type === "video" || o.type === "audio" || o.type === "sound" ? [] : keyTimes(o.tracks);

  const select = () => {
    const s = useStore.getState();
    s.select(o.id);
    s.setMode("edit");
  };

  const toggle = (field: "hidden" | "locked") => {
    const s = useStore.getState();
    const next = cloneScene(s.scene);
    const t = findObj(next, o.id);
    if (!t) return;
    if (t[field]) delete t[field];
    else t[field] = true;
    s.commit(next);
  };

  const moveBar = (e: React.PointerEvent) =>
    props.onDrag(
      e,
      (next, dt) => {
        const t = findObj(next, o.id);
        if (!t) return;
        const snapped = props.snap(a + dt, [a, b]) - a;
        const snappedEnd = props.snap(b + dt, [a, b]) - b;
        shiftObject(t, Math.abs(snapped - dt) <= Math.abs(snappedEnd - dt) ? snapped : snappedEnd);
      },
      select
    );

  const trimLeft = (e: React.PointerEvent) =>
    props.onDrag(e, (next, dt) => {
      const t = findObj(next, o.id);
      if (!t || (t.type !== "video" && t.type !== "audio")) return;
      const s0 = (o as { start: number }).start;
      const newStart = Math.max(0, props.snap(s0 + dt, [s0]));
      let d = newStart - (o as { start: number }).start;
      const src = t.type === "video" && t.reverse ? 0 : d * t.speed;
      if (t.in + src < 0) d = -t.in / t.speed;
      if (t.duration - d < 0.1) d = t.duration - 0.1;
      t.start = (o as { start: number }).start + d;
      t.in = Math.max(0, (o as { in: number }).in + (t.type === "video" && t.reverse ? 0 : d * t.speed));
      t.duration = (o as { duration: number }).duration - d;
    });

  const trimRight = (e: React.PointerEvent) =>
    props.onDrag(e, (next, dt) => {
      const t = findObj(next, o.id);
      if (!t) return;
      if (t.type === "video" || t.type === "audio") {
        const end = props.snap(t.start + (o as { duration: number }).duration + dt, [b]);
        const maxDur = asset?.duration ? (asset.duration - t.in) / t.speed : Infinity;
        t.duration = Math.max(0.1, Math.min(maxDur, end - t.start));
      } else if (t.type === "sound") {
        t.duration = Math.max(0.2, (o as { duration: number }).duration + dt);
      }
    });

  const dragKey = (e: React.PointerEvent, kt: number) =>
    props.onDrag(
      e,
      (next, dt) => {
        const t = findObj(next, o.id);
        if (!t) return;
        const nt = Math.max(0, props.snap(kt + dt, [kt]));
        moveKeysAt(t.tracks, kt, nt);
        useStore.getState().selectKey({ id: o.id, t: nt });
        useStore.getState().setTime(nt);
      },
      () => {
        const s = useStore.getState();
        s.selectKey({ id: o.id, t: kt });
        s.setTime(kt);
      }
    );

  return (
    <div className={cn("group flex border-b border-line/60", props.selected && "bg-accent/40")} style={{ height: h }}>
      <div
        className={cn("sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-line bg-panel px-2 text-xs", props.selected && "bg-panel-raised")}
        style={{ width: HEADER_W }}
        onClick={select}
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className={cn("min-w-0 flex-1 truncate", o.hidden && "text-muted-foreground line-through")} title={`${o.name} (${o.id})`}>
          {o.name}
        </span>
        <button className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100" title={o.hidden ? "Show" : "Hide"} onClick={(e) => (e.stopPropagation(), toggle("hidden"))} style={o.hidden ? { opacity: 1 } : undefined}>
          {o.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <button className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100" title={o.locked ? "Unlock" : "Lock"} onClick={(e) => (e.stopPropagation(), toggle("locked"))} style={o.locked ? { opacity: 1 } : undefined}>
          {o.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
        </button>
      </div>
      <div
        className="relative flex-1"
        onPointerDown={(e) => {
          select();
          props.onScrub(e);
        }}
      >
        {b > a && (
          <div
            className={cn("absolute top-1 bottom-1 cursor-grab overflow-hidden rounded-md border active:cursor-grabbing", style.bar, props.selected && "ring-1 ring-primary", o.hidden && "opacity-40")}
            style={{ left: a * pps, width: Math.max(4, (b - a) * pps) }}
            onPointerDown={moveBar}
          >
            {o.type === "video" && asset?.filmstrip && <Filmstrip asset={asset} obj={o} pps={pps} />}
            {(o.type === "audio" || (o.type === "video" && o.volume > 0)) && asset?.waveform && <Waveform peaks={asset.waveform} assetDuration={asset.duration ?? o.duration} inSec={o.in} span={o.duration * o.speed} />}
            {o.type === "caption" && <CaptionWords obj={o} pps={pps} start={a} />}
            <span className="pointer-events-none relative z-[1] ml-1.5 block whitespace-nowrap text-[10px] font-medium leading-[15px] text-foreground drop-shadow">
              {o.type === "audio" && o.role === "narration" && !o.asset ? `${o.name} (not voiced yet)` : o.name}
            </span>
            {(media || o.type === "sound") && (
              <>
                {media && <div className="absolute left-0 top-0 z-[2] h-full w-2 cursor-ew-resize hover:bg-primary/50" onPointerDown={trimLeft} title="Drag to trim the start" />}
                <div className="absolute right-0 top-0 z-[2] h-full w-2 cursor-ew-resize hover:bg-primary/50" onPointerDown={trimRight} title="Drag to trim the end" />
              </>
            )}
          </div>
        )}
        {times.map((t) => (
          <div
            key={t}
            className={cn(
              "absolute top-[23px] z-[3] size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize border border-background",
              props.selectedKey !== null && Math.abs(props.selectedKey - t) < 0.002 ? "bg-primary" : "bg-foreground/80 hover:bg-primary"
            )}
            style={{ left: t * pps }}
            title={`${t.toFixed(2)}s: drag to retime, Delete to remove`}
            onPointerDown={(e) => dragKey(e, t)}
          />
        ))}
      </div>
    </div>
  );
});

function Filmstrip({ asset, obj, pps }: { asset: Asset; obj: Extract<SceneObj, { type: "video" }>; pps: number }) {
  const total = ((asset.duration ?? obj.duration) / obj.speed) * pps;
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-70"
      style={{
        backgroundImage: `url(${asset.filmstrip})`,
        backgroundSize: `${total}px 100%`,
        backgroundPosition: `${-(obj.in / obj.speed) * pps}px 0`,
        backgroundRepeat: "no-repeat",
        transform: obj.reverse ? "scaleX(-1)" : undefined,
      }}
    />
  );
}

function Waveform({ peaks, assetDuration, inSec, span }: { peaks: number[]; assetDuration: number; inSec: number; span: number }) {
  const from = Math.floor((inSec / Math.max(0.01, assetDuration)) * peaks.length);
  const to = Math.min(peaks.length, Math.ceil(((inSec + span) / Math.max(0.01, assetDuration)) * peaks.length));
  const slice = peaks.slice(from, Math.max(from + 1, to));
  const pts = slice.map((p, i) => `${(i / Math.max(1, slice.length - 1)) * 100},${50 - p * 45}`).join(" ");
  const bottom = slice.map((p, i) => `${(i / Math.max(1, slice.length - 1)) * 100},${50 + p * 45}`).reverse().join(" ");
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon points={`${pts} ${bottom}`} className="fill-clip-voice/60" />
    </svg>
  );
}

function CaptionWords({ obj, pps, start }: { obj: Extract<SceneObj, { type: "caption" }>; pps: number; start: number }) {
  if (pps < 40) return null;
  return (
    <>
      {obj.words.slice(0, 400).map((w, i) => (
        <span key={i} className="pointer-events-none absolute top-0 whitespace-nowrap text-[9px] leading-[28px] text-muted-foreground" style={{ left: (w.start - start) * pps }}>
          {w.text}
        </span>
      ))}
    </>
  );
}

function Playhead({ pps }: { pps: number }) {
  const time = useStore((s) => s.time);
  return (
    <div className="pointer-events-none absolute bottom-0 top-0 z-30" style={{ left: HEADER_W + time * pps }}>
      <div className="absolute -left-[5px] top-0 h-3 w-[11px] rounded-b-sm bg-primary" />
      <div className="absolute left-0 top-0 h-full w-px bg-primary" />
    </div>
  );
}

function pickStep(pps: number): number {
  for (const s of [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120]) if (s * pps >= 64) return s;
  return 300;
}

function fmtTick(t: number): string {
  if (t < 60) return `${Math.round(t * 100) / 100}s`;
  return `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;
}
