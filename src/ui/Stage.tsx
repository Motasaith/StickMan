import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { cameraMatrix, hitTest, objectBounds, renderScene, stickmanPoints, stickmanTransform, worldState } from "../engine/render";
import { cloneScene, findObj, type Scene, type StickmanObj } from "../engine/scene";
import { dragHandle, jointsAt, type Handle, type Pt } from "../engine/rig";
import { setAt, valueAt } from "../engine/tracks";
import { imageLookup } from "../images";
import { syncAudio } from "../audio";
import { render3D, stage3D } from "../render3d";
import { camera3dAt } from "../engine/tracks";
import { apply, solveCreature } from "../engine/creatures";
import type { CreatureObj } from "../engine/scene";

const HANDLES: Handle[] = ["head", "lElbow", "rElbow", "lHand", "rHand", "lKnee", "rKnee", "lFoot", "rFoot"];

type Drag =
  | { kind: "move"; base: Scene; id: string; start: Pt; x0: number; y0: number; moved: boolean }
  | { kind: "handle"; base: Scene; id: string; handle: Handle; moved: boolean }
  | { kind: "bone"; base: Scene; id: string; bone: string; moved: boolean }
  | { kind: "move3d"; base: Scene; id: string; height: number; start: { x: number; z: number }; x0: number; z0: number; moved: boolean }
  | { kind: "orbit"; base: Scene; px: number; py: number; yaw0: number; pitch0: number; moved: boolean };

/** Set a 3D camera value: a key at the playhead if it's animated, otherwise its resting value. */
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

/** Creature-space <-> world conversion at time t. */
function creatureFrame(scene: Scene, obj: CreatureObj, t: number) {
  const w = worldState(scene, obj, t);
  const facing = valueAt(obj, "facing", t) < 0 ? -1 : 1;
  const r = (w.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    toWorld: (p: Pt): Pt => {
      const lx = p.x * w.scale * facing;
      const ly = p.y * w.scale;
      return { x: w.x + lx * cos - ly * sin, y: w.y + lx * sin + ly * cos };
    },
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

export function Stage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [fit, setFit] = useState({ w: 640, h: 360 });
  const width = useStore((s) => s.scene.width);
  const height = useStore((s) => s.scene.height);
  const aiBusy = useStore((s) => s.aiBusy);
  const hasObjects = useStore((s) => s.scene.objects.length > 0);
  const selectedType = useStore((s) => (s.selectedId ? findObj(s.scene, s.selectedId)?.type : undefined));
  const mode3d = useStore((s) => s.scene.mode === "3d");

  // Fit the canvas into the available space.
  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const pad = 24;
      const aw = el.clientWidth - pad * 2;
      const ah = el.clientHeight - pad * 2;
      const s = Math.min(aw / width, ah / height);
      setFit({ w: Math.max(50, Math.floor(width * s)), h: Math.max(50, Math.floor(height * s)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  // Render loop: advances playback and redraws when anything changed.
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
      const sig = [st.scene, st.time, st.selectedId, st.assets, st.imagesVersion, st.playing];
      if (sig.some((v, i) => v !== drawn[i])) {
        drawn = sig;
        draw(canvasRef.current!, st);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toScene = (e: React.PointerEvent): Pt => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
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
      const height = Math.max(0, s.scene.ground - valueAt(hit, "y", s.time));
      const gp = st3.groundPoint(s.scene, px, py, height);
      if (gp) dragRef.current = { kind: "move3d", base: s.scene, id: hit.id, height, start: gp, x0: valueAt(hit, "x", s.time), z0: valueAt(hit, "z", s.time), moved: false };
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
    const canvasToScene = s.scene.width / canvasRef.current!.getBoundingClientRect().width / cameraMatrix(s.scene, s.time).zoom;
    const sel = s.selectedId ? findObj(s.scene, s.selectedId) : undefined;
    if (sel?.type === "creature" && !s.playing) {
      const bone = boneAt(s.scene, sel, s.time, p, 9 * canvasToScene);
      if (bone) {
        dragRef.current = { kind: "bone", base: s.scene, id: sel.id, bone, moved: false };
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
    }
    if (sel?.type === "stickman" && !s.playing) {
      const handle = handleAt(sel, s.time, p, 9 * canvasToScene, s.scene);
      if (handle) {
        dragRef.current = { kind: "handle", base: s.scene, id: sel.id, handle, moved: false };
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
    }
    const ctx = canvasRef.current!.getContext("2d")!;
    const hit = hitTest(ctx, s.scene, p, s.time);
    if (!hit) {
      s.select(null);
      return;
    }
    if (s.playing) s.setPlaying(false);
    s.select(hit.id);
    if (hit.type === "bubble") return;
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
      setAt(obj, "x", s.time, Math.round(drag.x0 + p.x - drag.start.x));
      setAt(obj, "y", s.time, Math.round(drag.y0 + p.y - drag.start.y));
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
    const tol = (9 * s.scene.width) / canvas.getBoundingClientRect().width / cameraMatrix(s.scene, s.time).zoom;
    if ((sel?.type === "stickman" && !s.playing && handleAt(sel, s.time, p, tol, s.scene)) || (sel?.type === "creature" && !s.playing && boneAt(s.scene, sel, s.time, p, tol))) canvas.style.cursor = "crosshair";
    else canvas.style.cursor = hitTest(canvas.getContext("2d")!, s.scene, p, s.time) ? "move" : "default";
  };

  return (
    <div className="stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: fit.w, height: fit.h }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
      {aiBusy && <div className="building">AI is animating…</div>}
      {!hasObjects && !aiBusy && <div className="stage-hint">Empty canvas: describe a scene to the AI on the left, or add things from the top bar.</div>}
      {mode3d && <div className="stage-hint">3D: drag things to move them on the floor, drag empty space to turn the camera, scroll to zoom. Switch to 2D to pose joints.</div>}
      {!mode3d && selectedType === "stickman" && <div className="stage-hint">Drag the dots to pose (hands and feet bend the elbows and knees). Drag the body to move.</div>}
      {!mode3d && selectedType === "creature" && <div className="stage-hint">Drag the dots at the ends of bones to bend them. Drag the body to move.</div>}
    </div>
  );
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

function draw(canvas: HTMLCanvasElement, s: ReturnType<typeof useStore.getState>) {
  const ctx = canvas.getContext("2d")!;
  const { scene, time } = s;
  renderScene(ctx, scene, time, { images: imageLookup(s.assets), threeD: render3D });
  const sel = s.selectedId ? findObj(scene, s.selectedId) : undefined;
  if (!sel || s.playing) return;

  if (scene.mode === "3d") {
    const b = stage3D()?.screenBounds(scene, sel.id);
    if (!b) return;
    const px3 = scene.width / canvas.getBoundingClientRect().width || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = "#5b7cf0";
    ctx.lineWidth = 1.5 * px3;
    ctx.setLineDash([6 * px3, 4 * px3]);
    ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.restore();
    return;
  }

  const cam = cameraMatrix(scene, time);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const b = objectBounds(ctx, scene, sel, time);
  const tl = cam.toCanvas({ x: b.x, y: b.y });
  const br = cam.toCanvas({ x: b.x + b.w, y: b.y + b.h });
  const px = scene.width / canvas.getBoundingClientRect().width || 1;
  ctx.strokeStyle = "#5b7cf0";
  ctx.lineWidth = 1.5 * px;
  ctx.setLineDash([6 * px, 4 * px]);
  ctx.strokeRect(tl.x - 4, tl.y - 4, br.x - tl.x + 8, br.y - tl.y + 8);
  ctx.setLineDash([]);

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
      ctx.lineWidth = 1.5 * px;
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
