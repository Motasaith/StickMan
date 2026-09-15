import type { AudioObj, BubbleObj, CaptionObj, ChartObj, DrawingObj, FontName, ImageObj, LightObj, Link, Part, RegionObj, Scene, SceneObj, Slide, SoundObj, StickmanObj, SvgObj, TextObj, VideoObj } from "./scene";
import { EXPRESSIONS, findObj } from "./scene";
import { HEIGHT, jointsAt, solveRig, type Pt, type RigPoints } from "./rig";
import { cameraAt, valueAt } from "./tracks";
import { drawLook, drawFaceFeatures } from "./looks";
import { apply, creatureLocalBounds, drawCreature, solveCreature } from "./creatures";
import { drawEffect } from "./effects";
import { FONT_LIST, fontStack } from "./fonts";
import { counterText, drawChart } from "./chart";
import {
  adjustFilter,
  applyLoop,
  captionBox,
  captionLineAt,
  composeTransition,
  drawBackground,
  drawCaption,
  drawMedia,
  drawRegion,
  drawSvgObj,
  drawTextObj,
  layoutText,
  slidesAt,
  tintWarmth,
  videoSourceTime,
  type CanvasFactory,
} from "./media";

export type Ctx = CanvasRenderingContext2D;
export type ImageLookup = (assetId: string) => CanvasImageSource | undefined;

export const FONT_STACKS = Object.fromEntries(FONT_LIST.map((f) => [f.id, fontStack(f.id)])) as Record<FontName, string>;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderOptions {
  images?: ImageLookup;
  /** Skip the camera (used by tools that need scene coordinates). */
  noCamera?: boolean;
  /** Draws a 3D-mode scene (browser only). Returns false when 3D isn't available. */
  threeD?: (ctx: Ctx, scene: Scene, t: number, opts: RenderOptions) => boolean;
  /** SVG markup for "emoji:", "lib:" and "asset:" sources. */
  svgs?: (src: string) => string | undefined;
  /** A video object's frame at a second of its source. */
  videoFrame?: (obj: VideoObj, sourceTime: number) => CanvasImageSource | undefined;
  /** Scratch canvases (slide transitions, green screen, blur regions, grading). */
  makeCanvas?: CanvasFactory;
}

export function renderScene(ctx: Ctx, scene: Scene, t: number, opts: RenderOptions = {}): void {
  if (scene.mode === "3d" && opts.threeD && opts.threeD(ctx, scene, t, opts)) {
    drawScreenLayer(ctx, scene, t, opts, null);
    return;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = scene.background || "#ffffff";
  ctx.fillRect(0, 0, scene.width, scene.height);
  drawBackground(ctx, scene.backgroundFill, scene.width, scene.height, opts.images);
  frameBubbles = arrangeBubbles(ctx, scene, t, () => undefined);

  const slides = slidesAt(scene, t);
  if (!slides) {
    applyCamera(ctx, scene, t, opts.noCamera);
    if (scene.backgroundImage) {
      const img = opts.images?.(scene.backgroundImage);
      if (img) drawCover(ctx, img, scene.width, scene.height);
    }
    for (const obj of scene.objects) drawObject(ctx, scene, obj, t, opts);
  } else {
    const A = slides.prev && opts.makeCanvas ? opts.makeCanvas(scene.width, scene.height) : null;
    const B = A && opts.makeCanvas ? opts.makeCanvas(scene.width, scene.height) : null;
    if (slides.prev && A && B) {
      drawSlideLayer(A.ctx, scene, slides.prev, t, opts);
      drawSlideLayer(B.ctx, scene, slides.cur, t, opts);
      composeTransition(ctx, slides.cur.transition.kind, slides.p, A.canvas, B.canvas, scene.width, scene.height);
    } else drawSlideLayer(ctx, scene, slides.cur, t, opts);
    // Objects that belong to no slide sit on top of all of them.
    ctx.save();
    applyCamera(ctx, scene, t, opts.noCamera);
    for (const obj of scene.objects) if (!obj.slide) drawObject(ctx, scene, obj, t, opts);
    ctx.restore();
  }
  frameBubbles = null;
  ctx.restore();
  drawScreenLayer(ctx, scene, t, opts, slides);
}

/** Object types the 3D view doesn't model: they are drawn flat over its picture. */
export const FLAT_TYPES = new Set(["svg", "video", "region", "audio", "caption"]);

/** Draw only the flat editor objects (stickers, video, regions) with the scene camera. */
export function drawFlatObjects(ctx: Ctx, scene: Scene, t: number, opts: RenderOptions) {
  ctx.save();
  applyCamera(ctx, scene, t, opts.noCamera);
  for (const obj of scene.objects) if (FLAT_TYPES.has(obj.type)) drawObject(ctx, scene, obj, t, opts);
  ctx.restore();
}

function drawSlideLayer(c: Ctx, scene: Scene, slide: Slide, t: number, opts: RenderOptions) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.fillStyle = scene.background || "#ffffff";
  c.fillRect(0, 0, scene.width, scene.height);
  drawBackground(c, slide.background, scene.width, scene.height, opts.images);
  applyCamera(c, scene, t, opts.noCamera);
  for (const obj of scene.objects) if (obj.slide === slide.id) drawObject(c, scene, obj, t, opts);
  c.restore();
}

/** Captions and the color grade: in screen space, over everything. */
function drawScreenLayer(ctx: Ctx, scene: Scene, t: number, opts: RenderOptions, slides: ReturnType<typeof slidesAt>) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const obj of scene.objects) {
    if (obj.type !== "caption" || obj.hidden) continue;
    if (obj.slide && slides && obj.slide !== slides.cur.id && obj.slide !== slides.prev?.id) continue;
    const st = objState(obj, t);
    if (st.opacity <= 0.001) continue;
    ctx.globalAlpha = st.opacity;
    drawCaption(ctx, scene, obj, t, st.scale, st.x, st.y);
  }
  ctx.restore();
  const canvas = (ctx as Ctx & { canvas?: CanvasImageSource & { width: number; height: number } }).canvas;
  if (scene.grade && opts.makeCanvas && canvas) {
    const filter = adjustFilter(scene.grade);
    const copy = filter !== "none" ? opts.makeCanvas(canvas.width, canvas.height) : null;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (copy) {
      copy.ctx.drawImage(canvas, 0, 0);
      ctx.filter = filter;
      ctx.drawImage(copy.canvas, 0, 0);
      ctx.filter = "none";
    }
    tintWarmth(ctx, scene.grade.warmth, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

export function applyCamera(ctx: Ctx, scene: Scene, t: number, skip?: boolean) {
  if (skip) return;
  const cam = cameraAt(scene, t);
  ctx.translate(scene.width / 2, scene.height / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
}

/** Scene point -> canvas pixel, and back. */
export function cameraMatrix(scene: Scene, t: number) {
  const cam = cameraAt(scene, t);
  return {
    toCanvas: (p: Pt): Pt => ({ x: (p.x - cam.x) * cam.zoom + scene.width / 2, y: (p.y - cam.y) * cam.zoom + scene.height / 2 }),
    toScene: (p: Pt): Pt => ({ x: (p.x - scene.width / 2) / cam.zoom + cam.x, y: (p.y - scene.height / 2) / cam.zoom + cam.y }),
    zoom: cam.zoom,
  };
}

function drawCover(ctx: Ctx, img: CanvasImageSource, w: number, h: number) {
  const iw = (img as HTMLImageElement).width || w;
  const ih = (img as HTMLImageElement).height || h;
  const s = Math.max(w / iw, h / ih);
  ctx.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
}

export interface ObjState {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
  reveal: number;
}

export function objState(obj: SceneObj, t: number): ObjState {
  return {
    x: valueAt(obj, "x", t),
    y: valueAt(obj, "y", t),
    rotation: valueAt(obj, "rotation", t),
    scale: valueAt(obj, "scale", t),
    opacity: Math.max(0, Math.min(1, valueAt(obj, "opacity", t))),
    reveal: Math.max(0, Math.min(1, valueAt(obj, "reveal", t))),
  };
}

// ── Attachments ──────────────────────────────────────────────────────

/** The attachment in effect at time t, if the object is attached to something then. */
export function activeLink(obj: SceneObj, t: number): Link | null {
  const links = obj.links;
  if (!links?.length) return null;
  let cur: Link | null = null;
  for (const l of links) {
    if (l.t <= t + 1e-6) cur = l;
    else break;
  }
  return cur && cur.parent ? cur : null;
}

export interface Anchor {
  x: number;
  y: number;
  rotation: number;
}

export const STICKMAN_ANCHORS = ["rHand", "lHand", "head", "hip", "back", "lFoot", "rFoot"] as const;

/** World position and rotation of a named point on an object ("rHand", a bone name, "origin"…). */
export function anchorAt(scene: Scene, obj: SceneObj, anchor: string, t: number, depth = 0): Anchor {
  if (obj.type === "stickman") {
    const tf = stickmanTransform(obj, t, scene, depth);
    const p = stickmanPoints(obj, t);
    const seg: Record<string, [Pt, Pt]> = {
      rHand: [p.rElbow, p.rHand],
      lHand: [p.lElbow, p.lHand],
      head: [p.neck, p.head],
      hip: [p.neck, p.hip],
      back: [p.hip, p.neck],
      lFoot: [p.lKnee, p.lFoot],
      rFoot: [p.rKnee, p.rFoot],
    };
    const [a, b] = seg[anchor] ?? seg.rHand;
    const wa = tf.toWorld(a);
    const wb = tf.toWorld(b);
    const angle = (Math.atan2(wb.y - wa.y, wb.x - wa.x) * 180) / Math.PI - 90;
    if (anchor === "back") {
      const mid = tf.toWorld({ x: (a.x + b.x) / 2 - 14, y: (a.y + b.y) / 2 });
      return { x: mid.x, y: mid.y, rotation: angle + 180 };
    }
    return { x: wb.x, y: wb.y, rotation: angle };
  }
  const w = worldState(scene, obj, t, depth);
  if (obj.type === "creature") {
    const facing = valueAt(obj, "facing", t) < 0 ? -1 : 1;
    const solved = solveCreature(obj, t);
    const name = anchor === "mouth" ? "jaw" : anchor === "back" ? "body" : anchor;
    const sb = solved.get(name) ?? solved.get("body") ?? [...solved.values()][0];
    if (!sb) return { x: w.x, y: w.y, rotation: w.rotation };
    const local = anchor === "back" ? apply(sb.m, sb.def.length / 2, -22) : apply(sb.m, sb.def.length, 0);
    const r = (w.rotation * Math.PI) / 180;
    const lx = local.x * w.scale * facing;
    const ly = local.y * w.scale;
    return { x: w.x + lx * Math.cos(r) - ly * Math.sin(r), y: w.y + lx * Math.sin(r) + ly * Math.cos(r), rotation: w.rotation + sb.angle * facing };
  }
  return { x: w.x, y: w.y, rotation: w.rotation };
}

/** Where an object really is at time t, including what it is attached to. */
export function worldState(scene: Scene | undefined, obj: SceneObj, t: number, depth = 0): ObjState {
  const st = objState(obj, t);
  if (!scene || depth > 4) return st;
  const link = activeLink(obj, t);
  if (!link) return st;
  const parent = findObj(scene, link.parent!);
  if (!parent || parent.id === obj.id) return st;
  const a = anchorAt(scene, parent, link.anchor, t, depth + 1);
  if (link.follow === "full") {
    const r = (a.rotation * Math.PI) / 180;
    return { ...st, x: a.x + st.x * Math.cos(r) - st.y * Math.sin(r), y: a.y + st.x * Math.sin(r) + st.y * Math.cos(r), rotation: st.rotation + a.rotation };
  }
  return { ...st, x: a.x + st.x, y: a.y + st.y };
}

/** How open a speaker's mouth is (0..1) from the loudness of its voiced lines. */
export function mouthAt(scene: Scene, speakerId: string, t: number): number {
  for (const o of scene.objects) {
    if (o.type === "audio" && o.speaker === speakerId && o.envelope?.length && o.rate) {
      if (t < o.start || t > o.start + o.duration) continue;
      const i = (t - o.start) * o.speed * o.rate;
      const i0 = Math.min(o.envelope.length - 1, Math.floor(i));
      const i1 = Math.min(o.envelope.length - 1, i0 + 1);
      const v = o.envelope[i0] + (o.envelope[i1] - o.envelope[i0]) * (i - i0);
      return Math.max(0, Math.min(1, v * 1.3));
    }
    if (o.type !== "bubble" || o.target !== speakerId || !o.audio) continue;
    const a = o.audio;
    if (t < a.at || t > a.at + a.duration || !a.envelope.length) continue;
    const i = (t - a.at) * a.rate;
    const i0 = Math.min(a.envelope.length - 1, Math.floor(i));
    const i1 = Math.min(a.envelope.length - 1, i0 + 1);
    const v = a.envelope[i0] + (a.envelope[i1] - a.envelope[i0]) * (i - i0);
    return Math.max(0, Math.min(1, v * 1.3));
  }
  return 0;
}

/** Whether an object draws anything at time t (not counting opacity). */
export function onScreen(obj: SceneObj, t: number): boolean {
  if (obj.hidden) return false;
  switch (obj.type) {
    case "sound":
    case "light":
    case "audio":
      return false;
    case "video":
      return videoSourceTime(obj, t) !== null;
    case "caption":
      return captionLineAt(obj, t) !== null;
  }
  return true;
}

function drawObject(ctx: Ctx, scene: Scene, obj: SceneObj, t: number, opts: RenderOptions) {
  if (obj.type === "caption" || !onScreen(obj, t)) return;
  const st = worldState(scene, obj, t);
  if (st.opacity <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= st.opacity;
  if (obj.type === "bubble") {
    drawBubble(ctx, scene, obj, t, st);
    ctx.restore();
    return;
  }
  ctx.translate(st.x, st.y);
  if (obj.pivot === "center" && obj.type !== "stickman" && obj.type !== "creature") {
    const d = pivotShift(ctx, obj as BoxObj, st);
    ctx.translate(d.x, d.y);
  }
  if (st.rotation) ctx.rotate((st.rotation * Math.PI) / 180);
  applySquash(ctx, obj, t, st.scale);
  if (obj.loop && obj.loop !== "none" && obj.type !== "stickman" && obj.type !== "creature" && obj.type !== "effect") {
    const b = localBounds(ctx, obj as BoxObj);
    ctx.globalAlpha *= applyLoop(ctx, obj.loop, obj.loopAmount, t, { x: b.x * st.scale, y: b.y * st.scale, w: b.w * st.scale, h: b.h * st.scale });
  }
  switch (obj.type) {
    case "stickman":
      drawStickman(ctx, scene, obj, t, st, opts);
      break;
    case "creature": {
      const facing = valueAt(obj, "facing", t) < 0 ? -1 : 1;
      ctx.scale(st.scale * facing, st.scale);
      drawCreature(ctx, obj, t, mouthAt(scene, obj.id, t));
      break;
    }
    case "effect":
      ctx.scale(st.scale, st.scale);
      drawEffect(ctx, obj, t);
      break;
    case "drawing":
      ctx.scale(st.scale, st.scale);
      drawParts(ctx, obj.parts, st.reveal);
      break;
    case "text":
      ctx.scale(st.scale, st.scale);
      drawTextObj(ctx, obj.counter ? { ...obj, text: counterText(obj.counter, t) } : obj, st.reveal);
      break;
    case "chart":
      ctx.scale(st.scale, st.scale);
      drawChart(ctx, obj, t);
      break;
    case "image":
      ctx.scale(st.scale, st.scale);
      drawMedia(ctx, opts.images?.(obj.asset), obj, opts.makeCanvas, obj.asset);
      break;
    case "svg":
      ctx.scale(st.scale, st.scale);
      drawSvgObj(ctx, obj, t, opts.svgs);
      break;
    case "video": {
      ctx.scale(st.scale, st.scale);
      const at = videoSourceTime(obj, t);
      drawMedia(ctx, at === null ? undefined : opts.videoFrame?.(obj, at), obj, opts.makeCanvas, null);
      break;
    }
    case "region":
      ctx.scale(st.scale, st.scale);
      drawRegion(ctx, obj, opts.makeCanvas);
      break;
  }
  ctx.restore();
}

/** Squash and stretch around the object's base (feet, or the bottom of its shape). */
function applySquash(ctx: Ctx, obj: SceneObj, t: number, scale: number) {
  const sq = valueAt(obj, "squash", t);
  if (Math.abs(sq - 1) < 0.001 || sq <= 0) return;
  let px = 0;
  let py = 0;
  if (obj.type === "drawing" || obj.type === "text" || obj.type === "image" || obj.type === "svg" || obj.type === "video" || obj.type === "chart") {
    const b = localBounds(ctx, obj);
    px = (b.x + b.w / 2) * scale;
    py = (b.y + b.h) * scale;
  }
  ctx.translate(px, py);
  ctx.scale(1 / Math.sqrt(sq), sq);
  ctx.translate(-px, -py);
}

// ── Stick man ────────────────────────────────────────────────────────

export function stickmanTransform(obj: StickmanObj, t: number, scene?: Scene, depth = 0) {
  const st = worldState(scene, obj, t, depth);
  const facing = valueAt(obj, "facing", t) < 0 ? -1 : 1;
  const rad = (st.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = st.scale * facing;
  const sy = st.scale;
  return {
    st,
    facing,
    toWorld: (p: Pt): Pt => {
      const lx = p.x * sx;
      const ly = p.y * sy;
      return { x: st.x + lx * cos - ly * sin, y: st.y + lx * sin + ly * cos };
    },
    toLocal: (p: Pt): Pt => {
      const dx = p.x - st.x;
      const dy = p.y - st.y;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      return { x: lx / sx, y: ly / sy };
    },
  };
}

export function stickmanPoints(obj: StickmanObj, t: number): RigPoints {
  return solveRig(jointsAt(obj, t));
}

function drawStickman(ctx: Ctx, scene: Scene, obj: StickmanObj, t: number, st: ObjState, opts: RenderOptions) {
  const facing = valueAt(obj, "facing", t) < 0 ? -1 : 1;
  ctx.scale(st.scale * facing, st.scale);
  const j = jointsAt(obj, t);
  const p = solveRig(j);
  const exprIndex = Math.round(valueAt(obj, "expr", t));
  const expr = EXPRESSIONS[exprIndex] ?? "none";
  const mouth = mouthAt(scene, obj.id, t);
  ctx.setLineDash([]);

  if (obj.look && obj.look.style !== "stick") {
    drawLook({ ctx, p, j, look: obj.look, expression: expr, mouth, images: opts.images });
    return;
  }

  ctx.strokeStyle = obj.color;
  ctx.fillStyle = obj.color;
  ctx.lineWidth = obj.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const chain = (...pts: Pt[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
    ctx.stroke();
  };
  chain(p.hip, p.lKnee, p.lFoot);
  chain(p.hip, p.rKnee, p.rFoot);
  chain(p.hip, p.neck);
  chain(p.neck, p.lElbow, p.lHand);
  chain(p.neck, p.rElbow, p.rHand);

  ctx.beginPath();
  ctx.arc(p.head.x, p.head.y, p.headR, 0, Math.PI * 2);
  ctx.stroke();

  if (expr !== "none" || mouth > 0.06) drawFaceFeatures(ctx, p.head, p.headR, expr === "none" ? "neutral" : expr, obj.lineWidth, mouth, obj.color);
}

// ── Drawings ─────────────────────────────────────────────────────────

function hasPath2D(): boolean {
  return typeof (globalThis as { Path2D?: unknown }).Path2D === "function";
}

export function drawParts(ctx: Ctx, parts: Part[], reveal = 1) {
  const n = parts.length;
  const shown = reveal * n;
  for (let i = 0; i < n; i++) {
    if (i >= shown) break;
    const frac = Math.min(1, shown - i);
    drawPart(ctx, parts[i], frac);
  }
}

function drawPart(ctx: Ctx, part: Part, frac: number) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const alpha = part.opacity ?? 1;
  const hasFill = !!part.fill && part.fill !== "none";
  const hasStroke = (!!part.stroke && part.stroke !== "none") || (!hasFill && part.kind !== "text");
  ctx.lineWidth = part.width ?? 3;
  ctx.strokeStyle = part.stroke && part.stroke !== "none" ? part.stroke : "#1a1a1a";
  ctx.fillStyle = hasFill ? part.fill! : "#1a1a1a";
  ctx.setLineDash(part.dash ?? []);
  ctx.globalAlpha *= alpha * (part.kind === "line" ? 1 : frac);

  const paint = () => {
    if (hasFill) ctx.fill();
    if (hasStroke) ctx.stroke();
  };

  switch (part.kind) {
    case "rect": {
      ctx.beginPath();
      const r = Math.max(0, Math.min(part.r ?? 0, Math.abs(part.w) / 2, Math.abs(part.h) / 2));
      roundRect(ctx, part.x, part.y, part.w, part.h, r);
      paint();
      break;
    }
    case "circle":
      ctx.beginPath();
      ctx.arc(part.cx, part.cy, Math.abs(part.r), 0, Math.PI * 2);
      paint();
      break;
    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(part.cx, part.cy, Math.abs(part.rx), Math.abs(part.ry), 0, 0, Math.PI * 2);
      paint();
      break;
    case "line": {
      ctx.beginPath();
      ctx.moveTo(part.x1, part.y1);
      ctx.lineTo(part.x1 + (part.x2 - part.x1) * frac, part.y1 + (part.y2 - part.y1) * frac);
      ctx.strokeStyle = part.stroke && part.stroke !== "none" ? part.stroke : part.fill && part.fill !== "none" ? part.fill : "#1a1a1a";
      ctx.stroke();
      break;
    }
    case "poly": {
      const pts = part.points;
      if (pts.length < 4) break;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      if (part.closed) ctx.closePath();
      if (hasFill && part.closed !== false) ctx.fill();
      if (hasStroke) ctx.stroke();
      break;
    }
    case "path": {
      if (!hasPath2D()) break;
      try {
        const path = new Path2D(part.d);
        if (hasFill) ctx.fill(path);
        if (hasStroke) ctx.stroke(path);
      } catch {
        /* malformed path data draws nothing */
      }
      break;
    }
    case "box3":
    case "prism3":
    case "sphere3":
    case "cylinder3":
    case "cone3": {
      ctx.fillStyle = hasFill ? part.fill! : "#b8c0cc";
      ctx.strokeStyle = part.stroke && part.stroke !== "none" ? part.stroke : "#1a1a1a";
      ctx.lineWidth = part.width ?? 2;
      ctx.beginPath();
      if (part.kind === "box3") ctx.rect(part.x, part.y, part.w, part.h);
      else if (part.kind === "prism3") {
        ctx.moveTo(part.x, part.y + part.h);
        ctx.lineTo(part.x + part.w / 2, part.y);
        ctx.lineTo(part.x + part.w, part.y + part.h);
        ctx.closePath();
      } else if (part.kind === "cylinder3" && Math.abs(Math.abs(part.rotX ?? 0) - 90) < 1) {
        // A wheel seen from the side.
        ctx.arc(part.cx, part.y + part.h / 2, part.r, 0, Math.PI * 2);
      }
      else if (part.kind === "sphere3") ctx.arc(part.cx, part.cy, Math.abs(part.r), 0, Math.PI * 2);
      else if (part.kind === "cylinder3" && Math.abs(Math.abs(part.rotX ?? 0) - 90) >= 1) {
        ctx.rect(part.cx - part.r, part.y, part.r * 2, part.h);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(part.cx, part.y, part.r, part.r * 0.25, 0, 0, Math.PI * 2);
      } else {
        ctx.moveTo(part.cx - part.r, part.y + part.h);
        ctx.lineTo(part.cx, part.y);
        ctx.lineTo(part.cx + part.r, part.y + part.h);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "text": {
      const size = part.size ?? 32;
      ctx.font = `${part.bold ? "bold " : ""}${size}px ${FONT_STACKS[part.font ?? "sans"]}`;
      ctx.textAlign = part.align ?? "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = hasFill ? part.fill! : "#1a1a1a";
      const lines = part.text.split("\n");
      lines.forEach((line, i) => {
        if (part.stroke && part.stroke !== "none") ctx.strokeText(line, part.x, part.y + i * size * 1.25);
        ctx.fillText(line, part.x, part.y + i * size * 1.25);
      });
      break;
    }
  }
  ctx.restore();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  if (w < 0) {
    x += w;
    w = -w;
  }
  if (h < 0) {
    y += h;
    h = -h;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Text and bubbles ─────────────────────────────────────────────────

function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

export interface BubbleLayout {
  box: Rect;
  tail: Pt | null;
  lines: string[];
  lineHeight: number;
}

export function bubbleLayout(ctx: Ctx, scene: Scene, obj: BubbleObj, t: number, anchor?: Pt | null): BubbleLayout {
  const st = objState(obj, t);
  const size = obj.size * st.scale;
  ctx.save();
  ctx.font = `${size}px ${FONT_STACKS.hand}`;
  const lines = wrapText(ctx, obj.text, size * 13);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), size * 2);
  ctx.restore();
  const pad = size * 0.6;
  const lineHeight = size * 1.25;
  const w = textW + pad * 2 + size * 0.4;
  const h = lines.length * lineHeight + pad * 2;

  const target = obj.target ? findObj(scene, obj.target) : undefined;
  let tail: Pt | null = null;
  let cx: number;
  let bottom: number;
  if (anchor) {
    // A point given by the caller (the 3D view projects the speaker's head).
    tail = { x: anchor.x, y: anchor.y - 8 };
    cx = anchor.x + 50 + st.x;
    bottom = anchor.y - 34 + st.y;
  } else if (target && target.type === "stickman") {
    const tf = stickmanTransform(target, t, scene);
    const pts = stickmanPoints(target, t);
    const top = tf.toWorld({ x: pts.head.x, y: pts.head.y - pts.headR });
    tail = { x: top.x, y: top.y - 8 };
    cx = top.x + 50 * tf.facing * Math.abs(target.scale) + st.x;
    bottom = top.y - 34 + st.y;
  } else if (target) {
    const b = objectBounds(ctx, scene, target, t);
    tail = { x: b.x + b.w / 2, y: b.y - 6 };
    cx = tail.x + st.x;
    bottom = b.y - 30 + st.y;
  } else {
    cx = st.x;
    bottom = st.y + h;
  }
  let x = cx - w / 2;
  let y = bottom - h;
  x = Math.max(8, Math.min(scene.width - w - 8, x));
  y = Math.max(8, Math.min(scene.height - h - 8, y));
  return { box: { x, y, w, h }, tail, lines, lineHeight };
}

/** Draw a bubble with its tail at a given screen point (used over the 3D view). */
export function drawBubbleAt(ctx: Ctx, scene: Scene, obj: BubbleObj, t: number, anchor: Pt | null, layout?: BubbleLayout) {
  const st = objState(obj, t);
  if (st.opacity <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= st.opacity;
  drawBubble(ctx, scene, obj, t, st, anchor, layout);
  ctx.restore();
}

let frameBubbles: Map<string, BubbleLayout> | null = null;

function bubbleShowing(obj: BubbleObj, t: number): boolean {
  const st = objState(obj, t);
  return st.opacity > 0.001 && (st.reveal >= 1 || Math.floor(obj.text.length * st.reveal) >= 1);
}

/**
 * Lay out every bubble on screen at time t, then move bubbles that would cover an
 * earlier one up (or down, near the top edge) so all of them stay readable.
 */
export function arrangeBubbles(ctx: Ctx, scene: Scene, t: number, anchorOf: (b: BubbleObj) => Pt | null | undefined): Map<string, BubbleLayout> {
  const placed: BubbleLayout[] = [];
  const out = new Map<string, BubbleLayout>();
  for (const obj of scene.objects) {
    if (obj.type !== "bubble" || !bubbleShowing(obj, t)) continue;
    const L = bubbleLayout(ctx, scene, obj, t, anchorOf(obj));
    const hits = (b: Rect) => placed.find((p) => b.x < p.box.x + p.box.w + 6 && b.x + b.w + 6 > p.box.x && b.y < p.box.y + p.box.h + 6 && b.y + b.h + 6 > p.box.y);
    for (let guard = 0; guard < 8; guard++) {
      const other = hits(L.box);
      if (!other) break;
      const up = other.box.y - L.box.h - 10;
      if (up >= 8) L.box.y = up;
      else {
        L.box.y = other.box.y + other.box.h + 10;
        if (L.box.y + L.box.h > scene.height - 8) L.box.x = Math.min(scene.width - L.box.w - 8, other.box.x + other.box.w + 12);
      }
    }
    placed.push(L);
    out.set(obj.id, L);
  }
  return out;
}

function drawBubble(ctx: Ctx, scene: Scene, obj: BubbleObj, t: number, st: ObjState, anchor?: Pt | null, layout?: BubbleLayout) {
  if (!bubbleShowing(obj, t)) return;
  const L = layout ?? frameBubbles?.get(obj.id) ?? bubbleLayout(ctx, scene, obj, t, anchor);
  const { x, y, w, h } = L.box;
  const size = obj.size * st.scale;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#1a1a1a";
  ctx.fillStyle = "#ffffff";
  ctx.setLineDash([]);
  ctx.lineJoin = "round";

  if (obj.thought) {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 10, h / 2 + 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (L.tail) {
      const dots = [0.35, 0.65, 0.88];
      dots.forEach((f, i) => {
        const px = x + w / 2 + (L.tail!.x - (x + w / 2)) * f;
        const py = y + h + 4 + (L.tail!.y - (y + h + 4)) * f;
        ctx.beginPath();
        ctx.arc(px, py, 7 - i * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
  } else {
    ctx.beginPath();
    const r = Math.min(18, h / 2);
    const tail = L.tail;
    if (tail) {
      const baseX = Math.max(x + r + 12, Math.min(x + w - r - 12, tail.x));
      // Outline with the tail cut into the bottom edge.
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(baseX + 10, y + h);
      ctx.lineTo(tail.x, tail.y);
      ctx.lineTo(baseX - 10, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    } else roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
  }

  const total = obj.text.length;
  let remaining = st.reveal >= 1 ? Infinity : Math.floor(total * st.reveal);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${size}px ${FONT_STACKS.hand}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const pad = size * 0.6;
  L.lines.forEach((line, i) => {
    if (remaining <= 0) return;
    const part = line.slice(0, remaining);
    remaining -= line.length + 1;
    ctx.fillText(part, x + pad, y + pad + i * L.lineHeight);
  });
}

// ── Bounds (selection and hit testing) ──────────────────────────────

export function partBounds(part: Part, ctx?: Ctx): Rect {
  const pad = (part.width ?? 3) / 2;
  switch (part.kind) {
    case "rect":
      return grow({ x: Math.min(part.x, part.x + part.w), y: Math.min(part.y, part.y + part.h), w: Math.abs(part.w), h: Math.abs(part.h) }, pad);
    case "circle":
      return grow({ x: part.cx - part.r, y: part.cy - part.r, w: part.r * 2, h: part.r * 2 }, pad);
    case "ellipse":
      return grow({ x: part.cx - part.rx, y: part.cy - part.ry, w: part.rx * 2, h: part.ry * 2 }, pad);
    case "line":
      return grow(fromPoints([part.x1, part.y1, part.x2, part.y2]), pad);
    case "poly":
      return grow(fromPoints(part.points), pad);
    case "path": {
      const nums = (part.d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
      return nums.length >= 2 ? grow(fromPoints(nums), pad) : { x: 0, y: 0, w: 0, h: 0 };
    }
    case "text": {
      const size = part.size ?? 32;
      const lines = part.text.split("\n");
      let w = Math.max(...lines.map((l) => l.length)) * size * 0.55;
      if (ctx) {
        ctx.save();
        ctx.font = `${part.bold ? "bold " : ""}${size}px ${FONT_STACKS[part.font ?? "sans"]}`;
        w = Math.max(...lines.map((l) => ctx.measureText(l).width));
        ctx.restore();
      }
      const x = part.align === "center" ? part.x - w / 2 : part.align === "right" ? part.x - w : part.x;
      return { x, y: part.y, w, h: lines.length * size * 1.25 };
    }
    case "box3":
    case "prism3":
      return grow({ x: part.x, y: part.y, w: part.w, h: part.h }, pad);
    case "sphere3":
      return grow({ x: part.cx - part.r, y: part.cy - part.r, w: part.r * 2, h: part.r * 2 }, pad);
    case "cylinder3":
      if (Math.abs(Math.abs(part.rotX ?? 0) - 90) < 1) return grow({ x: part.cx - part.r, y: part.y + part.h / 2 - part.r, w: part.r * 2, h: part.r * 2 }, pad);
      return grow({ x: part.cx - part.r, y: part.y, w: part.r * 2, h: part.h }, pad);
    case "cone3":
      return grow({ x: part.cx - part.r, y: part.y, w: part.r * 2, h: part.h }, pad);
  }
}

function fromPoints(nums: number[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function grow(r: Rect, d: number): Rect {
  return { x: r.x - d, y: r.y - d, w: r.w + d * 2, h: r.h + d * 2 };
}

export function unionRects(rects: Rect[]): Rect {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

export type BoxObj = DrawingObj | TextObj | ImageObj | SoundObj | LightObj | SvgObj | VideoObj | AudioObj | CaptionObj | RegionObj | ChartObj;

/**
 * For center-pivot objects: the shift that makes rotation and scale happen around the middle
 * of the content. With c the local center, rotation R and scale s: c - R(s * c).
 */
function pivotShift(ctx: Ctx | undefined, obj: BoxObj, st: { rotation: number; scale: number }): Pt {
  const b = localBounds(ctx, obj.type === "text" && obj.counter ? { ...obj, text: `${obj.counter.prefix}${obj.counter.to}${obj.counter.suffix}` } : obj);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const r = (st.rotation * Math.PI) / 180;
  const sx = cx * st.scale;
  const sy = cy * st.scale;
  return { x: cx - (sx * Math.cos(r) - sy * Math.sin(r)), y: cy - (sx * Math.sin(r) + sy * Math.cos(r)) };
}

/** Local (unrotated, unscaled) bounds of an object's content. */
export function localBounds(ctx: Ctx | undefined, obj: BoxObj): Rect {
  switch (obj.type) {
    case "drawing":
      return unionRects(obj.parts.map((p) => partBounds(p, ctx)));
    case "text":
      return layoutText(ctx, obj).box;
    case "image":
    case "svg":
    case "video":
    case "region":
    case "chart":
      return { x: 0, y: 0, w: obj.w, h: obj.h };
    case "sound":
    case "light":
    case "audio":
    case "caption":
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

/** Axis-aligned bounds in scene coordinates at time t. */
export function objectBounds(ctx: Ctx | undefined, scene: Scene, obj: SceneObj, t: number): Rect {
  if (obj.type === "bubble") {
    if (!ctx) return { x: 0, y: 0, w: 0, h: 0 };
    return bubbleLayout(ctx, scene, obj, t).box;
  }
  if (obj.type === "caption") {
    if (!ctx) return { x: 0, y: 0, w: 0, h: 0 };
    const st = objState(obj, t);
    return captionBox(ctx, scene, obj, t, st.scale, st.x, st.y) ?? { x: 0, y: 0, w: 0, h: 0 };
  }
  if (obj.type === "stickman") {
    const tf = stickmanTransform(obj, t, scene);
    const p = stickmanPoints(obj, t);
    const local: Pt[] = [p.hip, p.neck, p.lElbow, p.lHand, p.rElbow, p.rHand, p.lKnee, p.lFoot, p.rKnee, p.rFoot];
    const r = p.headR + obj.lineWidth;
    local.push({ x: p.head.x - r, y: p.head.y - r }, { x: p.head.x + r, y: p.head.y + r });
    const world = local.map(tf.toWorld);
    return grow(fromPoints(world.flatMap((q) => [q.x, q.y])), obj.lineWidth);
  }
  const st = worldState(scene, obj, t);
  const flip = obj.type === "creature" && valueAt(obj, "facing", t) < 0 ? -1 : 1;
  let b: Rect;
  if (obj.type === "creature") {
    const lb = creatureLocalBounds(obj, t);
    b = flip < 0 ? { x: -(lb.x + lb.w), y: lb.y, w: lb.w, h: lb.h } : lb;
  } else if (obj.type === "effect") b = { x: 0, y: 0, w: obj.w, h: obj.h };
  else b = localBounds(ctx, obj);
  if (obj.pivot === "center" && obj.type !== "creature" && obj.type !== "effect") {
    const d = pivotShift(ctx, obj, st);
    st.x += d.x;
    st.y += d.y;
  }
  const rad = (st.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x, b.y + b.h],
    [b.x + b.w, b.y + b.h],
  ].flatMap(([lx, ly]) => {
    const sx = lx * st.scale;
    const sy = ly * st.scale;
    return [st.x + sx * cos - sy * sin, st.y + sx * sin + sy * cos];
  });
  return fromPoints(corners);
}

export function hitTest(ctx: Ctx, scene: Scene, p: Pt, t: number): SceneObj | undefined {
  // Effects usually cover large areas, so anything else under the pointer wins.
  for (const effects of [false, true]) {
    for (let i = scene.objects.length - 1; i >= 0; i--) {
      const obj = scene.objects[i];
      if ((obj.type === "effect") !== effects || !onScreen(obj, t)) continue;
      if (objState(obj, t).opacity < 0.05) continue;
      if (obj.slide && scene.slides?.length && slidesAt(scene, t)?.cur.id !== obj.slide) continue;
      const b = grow(objectBounds(ctx, scene, obj, t), 6);
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return obj;
    }
  }
  return undefined;
}

export { HEIGHT as STICKMAN_HEIGHT };
