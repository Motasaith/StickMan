// The canvas: plays the scene, and lets you select, move, resize, pose and orbit.

import { useEffect, useRef, useState } from "react";
import { Maximize2, Pause, Play, Repeat, SkipBack, SkipForward, Sparkles, Upload } from "lucide-react";
import { useStore } from "@/store";
import { cameraMatrix, hitTest, objectBounds, renderScene, stickmanPoints, stickmanTransform, worldState, type BoxObj } from "@/engine/render";
import { cloneScene, findObj, type CreatureObj, type Scene, type StickmanObj } from "@/engine/scene";
import { dragHandle, jointsAt, type Handle, type Pt } from "@/engine/rig";
import { camera3dAt, setAt, valueAt } from "@/engine/tracks";
import { syncAudio } from "@/audio";
import { render3D, stage3D } from "@/render3d";
import { apply, solveCreature } from "@/engine/creatures";
import { canvasPool, imageLookup, svgLookup, syncVideoSound, videoLookup } from "@/runtime/media";
import { cn } from "@/lib/utils";
import { importFiles, ACCEPTED_FILES } from "./importFiles";

const HANDLES: Handle[] = ["head", "lElbow", "rElbow", "lHand", "rHand", "lKnee", "rKnee", "lFoot", "rFoot"];
const SIZED = new Set(["image", "svg", "video", "region", "chart", "effect"]);

type Drag =
  | { kind: "move"; base: Scene; id: string; start: Pt; x0: number; y0: number; moved: boolean }
  | { kind: "resize"; base: Scene; id: string; start: Pt; w0: number; h0: number; s0: number; moved: boolean }
  | { kind: "handle"; base: Scene; id: string; handle: Handle; moved: boolean }
  | { kind: "bone"; base: Scene; id: string; bone: string; moved: boolean }
  | { kind: "move3d"; base: Scene; id: string; height: number; start: { x: number; z: number }; x0: number; z0: number; moved: boolean }
  | { kind: "orbit"; base: Scene; px: number; py: number; yaw0: number; pitch0: number; moved: boolean };

function setCamera3d(scene: Scene, prop: string, t: number, v: number) {
  const tracks = (scene.camera3d ??= { tracks: {} }).tracks;
  const keys = tracks[prop];
  if (keys && keys.length > 1) {
    const i = keys.findIndex((k) => Math.abs(k.t - t) < 1e-3);
    if (i >= 0) keys[i] = { ...keys[i], v };
    else {
      keys.push({ t, v });
      keys.sort((a, b) => a.t - b.t);
    }
  } else tracks[prop] = [{ t: 0, v }];
}

function creatureFrame(scene: Scene, obj: CreatureObj, t: number) {
  const w = worldState(scene, obj, t);
  const facing = valueAt(obj, "facing", t) < 0 ? -1 : 1;
  const r = (w.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    toWorld: (p: Pt): Pt => ({ x: w.x + p.x * w.scale * facing * cos - p.y * w.scale * sin, y: w.y + p.x * w.scale * facing * sin + p.y * w.scale * cos }),
    toLocal: (p: Pt): Pt => {
      const dx = p.x - w.x;
      const dy = p.y - w.y;
      return { x: (dx * cos + dy * sin) / (w.scale * facing), y: (-dx * sin + dy * cos) / w.scale };
    },
  };
}

function boneAt(scene: Scene, obj: CreatureObj, t: number, p: Pt, tol: number): string | null {
  const frame = creatureFrame(scene, obj, t);
  let best: string | null = null;
  let bestD = tol;
  for (const sb of solveCreature(obj, t).values()) {
    if (!sb.def.parent || sb.def.length < 4) continue;
    const end = frame.toWorld(apply(sb.m, sb.def.length, 0));
    const d = Math.hypot(end.x - p.x, end.y - p.y);
    if (d < bestD) {
      best = sb.def.name;
      bestD = d;
    }
  }
  return best;
}

function handleAt(obj: StickmanObj, t: number, p: Pt, tol: number, scene: Scene): Handle | null {
  const tf = stickmanTransform(obj, t, scene);
  const pts = stickmanPoints(obj, t);
  let best: Handle | null = null;
  let bestD = tol;
  for (const h of HANDLES) {
    const w = tf.toWorld(h === "head" ? pts.head : pts[h]);
    const d = Math.hypot(w.x - p.x, w.y - p.y);
    if (d < bestD) {
      best = h;
      bestD = d;
    }
  }
  return best;
}

const pool = canvasPool();

export function Stage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fit, setFit] = useState({ w: 640, h: 360 });
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const width = useStore((s) => s.scene.width);
  const height = useStore((s) => s.scene.height);
  const aiBusy = useStore((s) => s.aiBusy);
  const empty = useStore((s) => s.scene.objects.length === 0 && !s.scene.slides?.length);
  const selectedType = useStore((s) => (s.selectedId ? findObj(s.scene, s.selectedId)?.type : undefined));
  const mode3d = useStore((s) => s.scene.mode === "3d");

  useEffect(() => {
    const el = wrapRef.current!;
    const measure = () => {
      const pad = 28;
      const aw = el.clientWidth - pad * 2;
      const ah = el.clientHeight - pad * 2;
      const s = zoom === "fit" ? Math.min(aw / width, ah / height) : zoom;
      setFit({ w: Math.max(50, Math.floor(width * s)), h: Math.max(50, Math.floor(height * s)) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [width, height, zoom]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let drawn: unknown[] = [];
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = useStore.getState();
      if (s.playing) {
        let t = s.time + dt;
        if (t >= s.scene.duration) {
          if (s.loop) t = 0;
          else {
            t = s.scene.duration;
            useStore.setState({ playing: false });
          }
        }
        useStore.setState({ time: t });
      }
      const st = useStore.getState();
      syncAudio(st.playing, st.time, st.scene, st.assets);
      syncVideoSound(st.scene, st.playing, st.time, st.assets);
      const hasVideo = st.scene.objects.some((o) => o.type === "video");
      const hasAnimatedSvg = st.scene.objects.some((o) => o.type === "svg");
      const sig = [st.scene, st.time, st.selectedId, st.assets, st.imagesVersion, st.playing];
      // Videos and SVG animations keep moving on their own clock while paused frames settle.
      if (sig.some((v, i) => v !== drawn[i]) || (st.playing && (hasVideo || hasAnimatedSvg))) {
        drawn = sig;
        if (canvasRef.current) draw(canvasRef.current, st);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toScene = (e: { clientX: number; clientY: number }): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const s = useStore.getState();
    const px = ((e.clientX - rect.left) / rect.width) * s.scene.width;
    const py = ((e.clientY - rect.top) / rect.height) * s.scene.height;
    return cameraMatrix(s.scene, s.time).toScene({ x: px, y: py });
  };
  const canvasPixel = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const s = useStore.getState();
    return { px: ((e.clientX - rect.left) / rect.width) * s.scene.width, py: ((e.clientY - rect.top) / rect.height) * s.scene.height };
  };
  const pxPerScene = () => {
    const s = useStore.getState();
    return s.scene.width / canvasRef.current!.getBoundingClientRect().width / cameraMatrix(s.scene, s.time).zoom;
  };

  /** The resize corner of the selected object, in scene coordinates. */
  const resizeCorner = (): Pt | null => {
    const s = useStore.getState();
    const sel = s.selectedId ? findObj(s.scene, s.selectedId) : undefined;
    if (!sel || s.playing || s.scene.mode === "3d" || sel.type === "stickman" || sel.type === "creature" || sel.type === "bubble" || sel.type === "caption" || sel.locked) return null;
    const b = objectBounds(canvasRef.current!.getContext("2d")!, s.scene, sel, s.time);
    return { x: b.x + b.w, y: b.y + b.h };
  };

  const onPointerDown3d = (e: React.PointerEvent) => {
    const s = useStore.getState();
    const st3 = stage3D();
    if (!st3) return;
    const { px, py } = canvasPixel(e);
    const id = st3.pick(s.scene, px, py);
    const hit = id ? findObj(s.scene, id) : undefined;
    (e.target as Element).setPointerCapture(e.pointerId);
    if (hit) {
      if (s.playing) s.setPlaying(false);
      s.select(hit.id);
      const h = Math.max(0, s.scene.ground - valueAt(hit, "y", s.time));
      const gp = st3.groundPoint(s.scene, px, py, h);
      if (gp) dragRef.current = { kind: "move3d", base: s.scene, id: hit.id, height: h, start: gp, x0: valueAt(hit, "x", s.time), z0: valueAt(hit, "z", s.time), moved: false };
      return;
    }
    s.select(null);
    const cam = camera3dAt(s.scene, s.time);
    dragRef.current = { kind: "orbit", base: s.scene, px: e.clientX, py: e.clientY, yaw0: cam.yaw, pitch0: cam.pitch, moved: false };
  };

  const onWheel = (e: React.WheelEvent) => {
    const s = useStore.getState();
    if (s.scene.mode !== "3d") return;
    const next = cloneScene(s.scene);
    const dist = camera3dAt(next, s.time).dist * (e.deltaY > 0 ? 1.1 : 1 / 1.1);
    setCamera3d(next, "dist", s.time, Math.round(Math.max(150, Math.min(20000, dist))));
    s.commit(next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const s = useStore.getState();
    if (s.scene.mode === "3d") return onPointerDown3d(e);
    const p = toScene(e);
    const tol = 9 * pxPerScene();
    const sel = s.selectedId ? findObj(s.scene, s.selectedId) : undefined;
    const corner = resizeCorner();
    if (sel && corner && Math.hypot(corner.x - p.x, corner.y - p.y) < tol * 1.4) {
      const box = sel as BoxObj & { w?: number; h?: number };
      dragRef.current = { kind: "resize", base: s.scene, id: sel.id, start: p, w0: box.w ?? 0, h0: box.h ?? 0, s0: valueAt(sel, "scale", s.time), moved: false };
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (sel?.type === "creature" && !s.playing) {
      const bone = boneAt(s.scene, sel, s.time, p, tol);
      if (bone) {
        dragRef.current = { kind: "bone", base: s.scene, id: sel.id, bone, moved: false };
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
    }
    if (sel?.type === "stickman" && !s.playing) {
      const handle = handleAt(sel, s.time, p, tol, s.scene);
      if (handle) {
        dragRef.current = { kind: "handle", base: s.scene, id: sel.id, handle, moved: false };
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
    }
    const hit = hitTest(canvasRef.current!.getContext("2d")!, s.scene, p, s.time);
    if (!hit) {
      s.select(null);
      return;
    }
    if (s.playing) s.setPlaying(false);
    s.select(hit.id);
    s.setMode("edit");
    if (hit.type === "bubble" || hit.type === "caption" || hit.locked) return;
    dragRef.current = { kind: "move", base: s.scene, id: hit.id, start: p, x0: valueAt(hit, "x", s.time), y0: valueAt(hit, "y", s.time), moved: false };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) {
      updateCursor(e);
      return;
    }
    const s = useStore.getState();
    const p = toScene(e);
    const next = cloneScene(drag.base);
    if (drag.kind === "orbit") {
      setCamera3d(next, "yaw", s.time, Math.round((drag.yaw0 - (e.clientX - drag.px) * 0.35) * 10) / 10);
      setCamera3d(next, "pitch", s.time, Math.round(Math.max(-5, Math.min(80, drag.pitch0 + (e.clientY - drag.py) * 0.25)) * 10) / 10);
      drag.moved = true;
      s.preview(next);
      return;
    }
    const obj = findObj(next, drag.id);
    if (!obj) return;
    if (drag.kind === "move3d") {
      const { px, py } = canvasPixel(e);
      const gp = stage3D()?.groundPoint(next, px, py, drag.height);
      if (!gp) return;
      setAt(obj, "x", s.time, Math.round(drag.x0 + gp.x - drag.start.x));
      setAt(obj, "z", s.time, Math.round(drag.z0 + gp.z - drag.start.z));
    } else if (drag.kind === "move") {
      let nx = Math.round(drag.x0 + p.x - drag.start.x);
      let ny = Math.round(drag.y0 + p.y - drag.start.y);
      // Snap the middle of boxes to the middle of the frame.
      if (s.snapping && SIZED.has(obj.type) && "w" in obj) {
        const o = obj as { w: number; h: number };
        const cx = nx + o.w / 2;
        const cy = ny + o.h / 2;
        if (Math.abs(cx - next.width / 2) < 8 * pxPerScene()) nx = Math.round(next.width / 2 - o.w / 2);
        if (Math.abs(cy - next.height / 2) < 8 * pxPerScene()) ny = Math.round(next.height / 2 - o.h / 2);
      }
      setAt(obj, "x", s.time, nx);
      setAt(obj, "y", s.time, ny);
    } else if (drag.kind === "resize") {
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      if ("w" in obj && typeof (obj as { w?: number }).w === "number" && SIZED.has(obj.type)) {
        const o = obj as { w: number; h: number };
        const keep = !e.shiftKey && obj.type !== "region" && obj.type !== "effect";
        const k = keep ? Math.max(0.05, Math.max((drag.w0 + dx) / drag.w0, (drag.h0 + dy) / drag.h0)) : 1;
        o.w = Math.max(10, Math.round(keep ? drag.w0 * k : drag.w0 + dx));
        o.h = Math.max(10, Math.round(keep ? drag.h0 * k : drag.h0 + dy));
      } else {
        const b = objectBounds(undefined, drag.base, findObj(drag.base, drag.id)!, s.time);
        const k = Math.max(0.05, (b.w + dx) / Math.max(1, b.w));
        setAt(obj, "scale", s.time, Math.round(drag.s0 * k * 100) / 100);
      }
    } else if (drag.kind === "bone" && obj.type === "creature") {
      const sb = solveCreature(obj, s.time).get(drag.bone);
      if (sb) {
        const local = creatureFrame(next, obj, s.time).toLocal(p);
        const joint = apply(sb.m, 0, 0);
        const want = (Math.atan2(local.y - joint.y, local.x - joint.x) * 180) / Math.PI;
        let delta = want - sb.angle;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        setAt(obj, "b." + drag.bone, s.time, Math.round(valueAt(obj, "b." + drag.bone, s.time) + delta));
      }
    } else if (drag.kind === "handle" && obj.type === "stickman") {
      const local = stickmanTransform(obj, s.time, next).toLocal(p);
      const changes = dragHandle(jointsAt(obj, s.time), drag.handle, local);
      for (const [joint, v] of Object.entries(changes)) setAt(obj, joint, s.time, Math.round(v as number));
    }
    drag.moved = true;
    s.preview(next);
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) {
      const s = useStore.getState();
      s.commit(s.scene, drag.base);
    }
  };

  const updateCursor = (e: React.PointerEvent) => {
    const s = useStore.getState();
    const canvas = canvasRef.current!;
    if (s.scene.mode === "3d") {
      const { px, py } = canvasPixel(e);
      canvas.style.cursor = stage3D()?.pick(s.scene, px, py) ? "move" : "grab";
      return;
    }
    const sel = s.selectedId ? findObj(s.scene, s.selectedId) : undefined;
    const p = toScene(e);
    const tol = 9 * pxPerScene();
    const corner = resizeCorner();
    if (corner && Math.hypot(corner.x - p.x, corner.y - p.y) < tol * 1.4) canvas.style.cursor = "nwse-resize";
    else if ((sel?.type === "stickman" && !s.playing && handleAt(sel, s.time, p, tol, s.scene)) || (sel?.type === "creature" && !s.playing && boneAt(s.scene, sel, s.time, p, tol))) canvas.style.cursor = "crosshair";
    else canvas.style.cursor = hitTest(canvas.getContext("2d")!, s.scene, p, s.time) ? "move" : "default";
  };

  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
      <div ref={wrapRef} className="grid-bg relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-panel-sunken">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: fit.w, height: fit.h }}
          className={cn("shrink-0 rounded-sm shadow-[0_18px_60px_-12px_rgba(0,0,0,0.6)]", aiBusy && "ai-glow")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />
        {aiBusy && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-primary/40 bg-panel/90 px-4 py-1.5 text-xs">
            <span className="shimmer-text font-medium">The AI is working on your video…</span>
          </div>
        )}
        {empty && !aiBusy && (
          <div className="pointer-events-auto absolute flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-panel/85 px-8 py-6 text-center backdrop-blur">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="size-5" />
            </div>
            <p className="font-display text-lg font-semibold">An empty canvas</p>
            <p className="max-w-xs text-sm text-muted-foreground">Tell the AI Director what to make, add things from the library, or drop your own videos and pictures.</p>
            <button className="chip" onClick={() => fileRef.current?.click()}>
              <Upload className="size-3.5" /> Add media
            </button>
            <input ref={fileRef} type="file" hidden multiple accept={ACCEPTED_FILES} onChange={(e) => e.target.files && void importFiles(e.target.files, { place: true }).finally(() => (e.target.value = ""))} />
          </div>
        )}
        {!empty && (
          <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted-foreground">
            {mode3d
              ? "3D: drag things along the floor, drag empty space to turn the camera, scroll to zoom"
              : selectedType === "stickman"
                ? "Drag the dots to pose; drag the body to move"
                : selectedType === "creature"
                  ? "Drag the dots at the ends of bones to bend them"
                  : selectedType
                    ? "Drag to move, drag the corner to resize (Shift: free)"
                    : ""}
          </div>
        )}
      </div>
      <Transport zoom={zoom} setZoom={setZoom} />
    </section>
  );
}

function Transport({ zoom, setZoom }: { zoom: "fit" | number; setZoom: (z: "fit" | number) => void }) {
  const playing = useStore((s) => s.playing);
  const loop = useStore((s) => s.loop);
  const time = useStore((s) => s.time);
  const duration = useStore((s) => s.scene.duration);
  const fps = useStore((s) => s.scene.fps);
  const slides = useStore((s) => s.scene.slides);
  const tc = (t: number) => {
    const m = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    const f = Math.floor((t % 1) * fps);
    return `${m}:${String(sec).padStart(2, "0")}.${String(f).padStart(2, "0")}`;
  };
  const jumpSlide = (dir: 1 | -1) => {
    if (!slides?.length) return;
    const s = useStore.getState();
    const i = slides.findIndex((x) => time >= x.start && time < x.start + x.duration);
    const target = slides[Math.max(0, Math.min(slides.length - 1, (i < 0 ? 0 : i) + dir))];
    s.setPlaying(false);
    s.setTime(target.start + Math.min(target.duration * 0.6, 2.5));
  };
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-t border-line bg-panel px-3">
      <button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Back to start (Home)" onClick={() => useStore.getState().setTime(0)}>
        <SkipBack className="size-4" />
      </button>
      <button
        className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:scale-105"
        title="Play / pause (Space)"
        onClick={() => useStore.getState().setPlaying(!playing)}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>
      <button className={cn("rounded-md p-1.5 hover:bg-accent", loop ? "text-primary" : "text-muted-foreground")} title="Loop" onClick={() => useStore.getState().setLoop(!loop)}>
        <Repeat className="size-4" />
      </button>
      {slides?.length ? (
        <>
          <button className="chip" onClick={() => jumpSlide(-1)} title="Previous slide">
            Prev slide
          </button>
          <button className="chip" onClick={() => jumpSlide(1)} title="Next slide">
            Next <SkipForward className="size-3" />
          </button>
        </>
      ) : null}
      <span className="ml-1 font-mono text-xs tabular-nums">
        {tc(time)} <span className="text-muted-foreground">/ {tc(duration)}</span>
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <select className="select-native h-7 text-xs" value={String(zoom)} onChange={(e) => setZoom(e.target.value === "fit" ? "fit" : Number(e.target.value))} title="Canvas zoom">
          <option value="fit">Fit</option>
          <option value="0.25">25%</option>
          <option value="0.5">50%</option>
          <option value="0.75">75%</option>
          <option value="1">100%</option>
        </select>
        <button
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Full screen preview"
          onClick={() => document.querySelector<HTMLCanvasElement>("canvas")?.requestFullscreen?.()}
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

function draw(canvas: HTMLCanvasElement, s: ReturnType<typeof useStore.getState>) {
  const ctx = canvas.getContext("2d")!;
  const { scene, time } = s;
  pool.reset();
  renderScene(ctx, scene, time, { images: imageLookup(s.assets), svgs: svgLookup(s.assets), videoFrame: videoLookup(s.assets, s.playing), makeCanvas: pool, threeD: render3D });
  const sel = s.selectedId ? findObj(scene, s.selectedId) : undefined;
  if (!sel || s.playing || sel.hidden) return;
  const px = scene.width / (canvas.getBoundingClientRect().width || scene.width);
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  const color = accent ? `hsl(${accent})` : "#e1e5cb";

  if (scene.mode === "3d") {
    const b = stage3D()?.screenBounds(scene, sel.id);
    if (!b) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([6 * px, 4 * px]);
    ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.restore();
    return;
  }

  const cam = cameraMatrix(scene, time);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const b = objectBounds(ctx, scene, sel, time);
  const captionLike = sel.type === "caption";
  const tl = captionLike ? { x: b.x, y: b.y } : cam.toCanvas({ x: b.x, y: b.y });
  const br = captionLike ? { x: b.x + b.w, y: b.y + b.h } : cam.toCanvas({ x: b.x + b.w, y: b.y + b.h });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * px;
  ctx.setLineDash([6 * px, 4 * px]);
  ctx.strokeRect(tl.x - 3, tl.y - 3, br.x - tl.x + 6, br.y - tl.y + 6);
  ctx.setLineDash([]);
  if (sel.type !== "stickman" && sel.type !== "creature" && sel.type !== "bubble" && !captionLike && !sel.locked) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#191c18";
    ctx.lineWidth = 1.5 * px;
    ctx.beginPath();
    ctx.rect(br.x - 5 * px, br.y - 5 * px, 10 * px, 10 * px);
    ctx.fill();
    ctx.stroke();
  }

  if (sel.type === "creature") {
    const frame = creatureFrame(scene, sel, time);
    for (const sb of solveCreature(sel, time).values()) {
      if (!sb.def.parent || sb.def.length < 4) continue;
      const w = cam.toCanvas(frame.toWorld(apply(sb.m, sb.def.length, 0)));
      ctx.beginPath();
      ctx.arc(w.x, w.y, 5 * px, 0, Math.PI * 2);
      ctx.fillStyle = "#2ec4b6";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
  }
  if (sel.type === "stickman") {
    const tf = stickmanTransform(sel, time, scene);
    const pts = stickmanPoints(sel, time);
    for (const h of HANDLES) {
      const w = cam.toCanvas(tf.toWorld(h === "head" ? pts.head : pts[h]));
      ctx.beginPath();
      ctx.arc(w.x, w.y, (h.endsWith("Hand") || h.endsWith("Foot") ? 6 : 4.5) * px, 0, Math.PI * 2);
      ctx.fillStyle = h === "head" ? "#ff8a3d" : h.endsWith("Hand") || h.endsWith("Foot") ? "#5b7cf0" : "#9fb4ff";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5 * px;
      ctx.stroke();
    }
  }
  ctx.restore();
}
