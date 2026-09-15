// The 3D view: the same scene drawn as a lit, cel-shaded world with three.js.
// Characters and animals use the same skeletons as 2D, so every motion carries over.
// World units are scene pixels: X = x, Y = ground - y (height), Z = depth (+ toward the camera).

import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { BubbleObj, CreatureObj, DrawingObj, EffectObj, ImageObj, LightObj, LightingPreset, Look, Part, Scene, SceneObj, StickmanObj, TextObj } from "./engine/scene";
import { DEFAULT_LOOK, EXPRESSIONS } from "./engine/scene";
import { jointsAt, solveRig, type Pt, type RigPoints } from "./engine/rig";
import { EYES, rigOf, solveCreature } from "./engine/creatures";
import { camera3dAt, cameraAt, valueAt } from "./engine/tracks";
import { FLAT_TYPES, FONT_STACKS, arrangeBubbles, drawBubbleAt, drawFlatObjects, localBounds, mouthAt, objState, worldState, type Ctx, type RenderOptions } from "./engine/render";
import { drawEffect } from "./engine/effects";
import { drawLook } from "./engine/looks";

const DEG = Math.PI / 180;
const OUTLINE = "#1a1a1a";

// ── Materials ────────────────────────────────────────────────────────

let gradient: THREE.DataTexture | null = null;
function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

/** The surface look used while building meshes for the current scene. */
let LOOK: "soft" | "toon" = "soft";

const materials = new Map<string, THREE.Material>();
function toon(color: string, outline = OUTLINE, thickness = 0.0035, glow = false): THREE.MeshStandardMaterial {
  const key = `${LOOK}|${color}|${outline}|${thickness}|${glow}`;
  let m = materials.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    const c = new THREE.Color(safeColor(color));
    if (LOOK === "toon") {
      m = new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient(), emissive: glow ? c : new THREE.Color(0), emissiveIntensity: glow ? 0.9 : 0 }) as unknown as THREE.MeshStandardMaterial;
    } else {
      m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, metalness: 0.03, emissive: glow ? c : new THREE.Color(0), emissiveIntensity: glow ? 1.6 : 0 });
    }
    const oc = new THREE.Color(safeColor(outline));
    m.userData.outlineParameters = { thickness, color: [oc.r, oc.g, oc.b], alpha: 1, visible: thickness > 0 && LOOK === "toon" };
    materials.set(key, m);
  }
  return m;
}

function safeColor(c: string | undefined): string {
  if (!c || c === "none") return "#999999";
  try {
    new THREE.Color(c);
    return c;
  } catch {
    return "#999999";
  }
}

const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 14);
const unitSphere = new THREE.SphereGeometry(1, 20, 14);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCone = new THREE.ConeGeometry(1, 1, 28);
const unitPrism = (() => {
  // A roof shape: triangle front (base at the bottom, point at the top), 1 wide, 1 tall, 1 deep.
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.5);
  shape.lineTo(0.5, -0.5);
  shape.lineTo(0, 0.5);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
})();
const UP = new THREE.Vector3(0, 1, 0);

/** Put a unit cylinder (or box) between two points. */
function placeSegment(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.001, dir.length());
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
  mesh.scale.set(radius, len, radius);
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, id: string): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.id = id;
  return m;
}

// ── 2D shapes as 3D solids ───────────────────────────────────────────

function textTexture(text: string, size: number, color: string, font: string, bold: boolean): { tex: THREE.CanvasTexture; w: number; h: number } {
  const lines = text.split("\n");
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const px = 2;
  g.font = `${bold ? "bold " : ""}${size * px}px ${font}`;
  const w = Math.max(4, ...lines.map((l) => g.measureText(l).width)) + 8 * px;
  const h = lines.length * size * 1.25 * px + 4 * px;
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  g.font = `${bold ? "bold " : ""}${size * px}px ${font}`;
  g.fillStyle = color;
  g.textBaseline = "top";
  lines.forEach((l, i) => g.fillText(l, 4 * px, i * size * 1.25 * px + 2 * px));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, w: w / px, h: h / px };
}

const svgLoader = new SVGLoader();

/** A 2D part as a 3D object in its owner's space (2D y down becomes 3D y up). */
function partToObject(part: Part, depth: number, id: string): THREE.Object3D | null {
  const fill = part.fill && part.fill !== "none" ? part.fill : null;
  const stroke = part.stroke && part.stroke !== "none" ? part.stroke : OUTLINE;
  const glow = !!part.glow;
  const mat = toon(fill ?? stroke, stroke, fill ? 0.0035 : 0, glow);
  const d = Math.max(1, depth);
  const turn = (m: THREE.Object3D) => {
    m.rotation.set((part.rotX ?? 0) * DEG, (part.rotY ?? 0) * DEG, -(part.rotZ ?? 0) * DEG);
    return m;
  };
  switch (part.kind) {
    case "circle": {
      const m = mesh(unitSphere, mat, id);
      m.position.set(part.cx, -part.cy, 0);
      m.scale.setScalar(Math.abs(part.r));
      return m;
    }
    case "ellipse": {
      const m = mesh(unitSphere, mat, id);
      m.position.set(part.cx, -part.cy, 0);
      m.scale.set(Math.abs(part.rx), Math.abs(part.ry), Math.min(Math.abs(part.rx), Math.abs(part.ry), d));
      return m;
    }
    case "rect": {
      const w = Math.abs(part.w);
      const h = Math.abs(part.h);
      const cx = Math.min(part.x, part.x + part.w) + w / 2;
      const cy = Math.min(part.y, part.y + part.h) + h / 2;
      const r = part.r ?? 0;
      if (r >= Math.min(w, h) * 0.35 && Math.min(w, h) > 0) {
        const rad = Math.min(w, h) / 2;
        const geo = new THREE.CapsuleGeometry(rad, Math.max(0.01, Math.max(w, h) - rad * 2), 6, 14);
        const m = mesh(geo, mat, id);
        m.position.set(cx, -cy, 0);
        if (w > h) m.rotation.z = Math.PI / 2;
        return m;
      }
      const m = mesh(unitBox, mat, id);
      m.position.set(cx, -cy, 0);
      m.scale.set(Math.max(0.5, w), Math.max(0.5, h), d);
      return m;
    }
    case "line": {
      // A thick line with round ends, so chained lines (tails, legs) join without gaps.
      const lineMat = toon(stroke === OUTLINE && fill ? fill : stroke, OUTLINE, 0);
      const r = Math.max(0.8, (part.width ?? 3) / 2);
      const g = new THREE.Group();
      const m = mesh(unitCylinder, lineMat, id);
      placeSegment(m, new THREE.Vector3(part.x1, -part.y1, 0), new THREE.Vector3(part.x2, -part.y2, 0), r);
      g.add(m);
      for (const [x, y] of [[part.x1, part.y1], [part.x2, part.y2]]) {
        const cap = mesh(unitSphere, lineMat, id);
        cap.position.set(x, -y, 0);
        cap.scale.setScalar(r);
        g.add(cap);
      }
      return g;
    }
    case "poly": {
      const pts = part.points;
      if (pts.length < 6 || part.closed === false || !fill) {
        const g = new THREE.Group();
        for (let i = 0; i + 3 < pts.length; i += 2) {
          const m = mesh(unitCylinder, toon(stroke, OUTLINE, 0), id);
          placeSegment(m, new THREE.Vector3(pts[i], -pts[i + 1], 0), new THREE.Vector3(pts[i + 2], -pts[i + 3], 0), Math.max(0.8, (part.width ?? 3) / 2));
          g.add(m);
        }
        return g;
      }
      const shape = new THREE.Shape();
      shape.moveTo(pts[0], -pts[1]);
      for (let i = 2; i + 1 < pts.length; i += 2) shape.lineTo(pts[i], -pts[i + 1]);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
      geo.translate(0, 0, -d / 2);
      return mesh(geo, mat, id);
    }
    case "path": {
      try {
        const data = svgLoader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${part.d.replace(/"/g, "")}"/></svg>`);
        const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
        if (!shapes.length) return null;
        const geo = new THREE.ExtrudeGeometry(shapes, { depth: d, bevelEnabled: false });
        geo.translate(0, 0, -d / 2);
        const m = mesh(geo, mat, id);
        m.scale.y = -1;
        (m.material as THREE.Material).side = THREE.DoubleSide;
        return m;
      } catch {
        return null;
      }
    }
    case "text": {
      const size = part.size ?? 32;
      const { tex, w, h } = textTexture(part.text, size, fill ?? OUTLINE, FONT_STACKS[part.font ?? "sans"], !!part.bold);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      const left = part.align === "center" ? part.x - w / 2 : part.align === "right" ? part.x - w : part.x;
      // Props place their labels on a solid's front face with an explicit z.
      const pz = (part as { z?: number }).z;
      plane.position.set(left + w / 2, -(part.y + h / 2), pz ?? d / 2 + 1.5);
      plane.userData.id = id;
      return plane;
    }
    case "box3": {
      const m = mesh(unitBox, toon(fill ?? "#b8c0cc", stroke, 0.0035, glow), id);
      m.position.set(part.x + part.w / 2, -(part.y + part.h / 2), part.z ?? 0);
      m.scale.set(Math.max(0.5, part.w), Math.max(0.5, part.h), Math.max(0.5, part.d));
      return turn(m);
    }
    case "prism3": {
      const m = mesh(unitPrism, toon(fill ?? "#b8c0cc", stroke, 0.0035, glow), id);
      m.position.set(part.x + part.w / 2, -(part.y + part.h / 2), part.z ?? 0);
      m.scale.set(Math.max(0.5, part.w), Math.max(0.5, part.h), Math.max(0.5, part.d));
      return turn(m);
    }
    case "sphere3": {
      const m = mesh(unitSphere, toon(fill ?? "#b8c0cc", stroke, 0.0035, glow), id);
      m.position.set(part.cx, -part.cy, part.cz ?? 0);
      m.scale.setScalar(Math.max(0.5, part.r));
      return turn(m);
    }
    case "cylinder3":
    case "cone3": {
      const geo = part.kind === "cone3" ? unitCone : unitCylinder;
      const m = mesh(geo, toon(fill ?? "#b8c0cc", stroke, 0.0035, glow), id);
      m.position.set(part.cx, -(part.y + part.h / 2), part.z ?? 0);
      m.scale.set(Math.max(0.5, part.r), Math.max(0.5, part.h), Math.max(0.5, part.r));
      turn(m);
      return m;
    }
  }
}

// ── Entries: one per scene object ────────────────────────────────────

interface Entry {
  root: THREE.Group;
  sig: string;
  update: (scene: Scene, t: number, obj: SceneObj) => void;
  /** Screen anchor for speech bubbles (head top), world space. */
  headTop?: () => THREE.Vector3 | null;
  dispose: () => void;
}

function disposeTree(o: THREE.Object3D) {
  const cached = new Set<THREE.Material>(materials.values());
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry && ![unitCylinder, unitSphere, unitBox, unitCone, unitPrism].includes(m.geometry as never)) m.geometry.dispose();
    const mat = m.material as THREE.MeshBasicMaterial | undefined;
    if (mat && !cached.has(mat)) {
      mat.map?.dispose();
      mat.dispose?.();
    }
  });
}

function placeRoot(root: THREE.Group, inner: THREE.Group, scene: Scene, obj: SceneObj, t: number, heading: number) {
  const st = worldState(scene, obj, t);
  root.position.set(st.x, scene.ground - st.y, valueAt(obj, "z", t));
  root.rotation.set(0, -heading * DEG, 0);
  inner.rotation.set(0, 0, -st.rotation * DEG);
  const sq = valueAt(obj, "squash", t);
  const k = sq > 0 ? sq : 1;
  inner.scale.set(st.scale / Math.sqrt(k), st.scale * k, st.scale / Math.sqrt(k));
  root.visible = st.opacity > 0.02;
}

function headingOf(obj: SceneObj, t: number) {
  return valueAt(obj, "yaw", t) + (valueAt(obj, "facing", t) < 0 ? 180 : 0);
}

// Humans

interface Look3D {
  arm: [number, number];
  leg: [number, number];
  torso: number;
  neck: number;
  head: number;
  colors: { upper: string; fore: string; thigh: string; shin: string; torso: string; head: string; hand: string | null; shoe: string | null };
  box: boolean;
}

function lookParams(obj: StickmanObj): Look3D {
  const look: Look = obj.look ?? DEFAULT_LOOK;
  const lw = obj.lineWidth;
  if (look.style === "cartoon")
    return {
      arm: [6, 4.5],
      leg: [6.5, 6],
      torso: 14,
      neck: 4,
      head: 18,
      colors: { upper: look.shirt, fore: look.skin, thigh: look.pants, shin: look.pants, torso: look.shirt, head: look.skin, hand: look.skin, shoe: look.shoes },
      box: false,
    };
  if (look.style === "robot")
    return {
      arm: [5.5, 5],
      leg: [6, 5.5],
      torso: 16,
      neck: 3,
      head: 17,
      colors: { upper: "#a7b1bc", fore: "#a7b1bc", thigh: "#a7b1bc", shin: "#a7b1bc", torso: look.shirt, head: "#cfd6dd", hand: "#5d6b78", shoe: "#5d6b78" },
      box: true,
    };
  return {
    arm: [lw / 2, lw / 2],
    leg: [lw / 2, lw / 2],
    torso: lw / 2,
    neck: lw / 2,
    head: 16,
    colors: { upper: obj.color, fore: obj.color, thigh: obj.color, shin: obj.color, torso: obj.color, head: "#ffffff", hand: null, shoe: null },
    box: false,
  };
}

function buildHuman(obj: StickmanObj, id: string, images: RenderOptions["images"]): Entry {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const look = obj.look ?? DEFAULT_LOOK;

  // Picture puppets: the 2D cut-out drawn onto a card that stands in the world.
  if (look.style === "cutout") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 384;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(160, 240), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.05 }));
    card.position.set(0, 110, 0);
    card.userData.id = id;
    inner.add(card);
    return {
      root,
      sig: "",
      update: (scene, t, cur) => {
        const obj = cur as StickmanObj;
        placeRoot(root, inner, scene, obj, t, 0);
        const g = canvas.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, canvas.width, canvas.height);
        const facing = valueAt(obj, "facing", t) < 0 ? -1 : 1;
        g.setTransform(1.6 * facing, 0, 0, 1.6, 128, 368);
        const j = jointsAt(obj, t);
        drawLook({ ctx: g, p: solveRig(j), j, look, expression: "none", mouth: mouthAt(scene, obj.id, t), images });
        tex.needsUpdate = true;
      },
      headTop: () => inner.localToWorld(new THREE.Vector3(0, 230, 0)),
      dispose: () => disposeTree(root),
    };
  }

  const P = lookParams(obj);
  const seg = (color: string) => mesh(P.box ? unitBox : unitCylinder, toon(color), id);
  const joint = (color: string) => mesh(unitSphere, toon(color, OUTLINE, P.box ? 0.0035 : 0), id);
  const parts = {
    lThigh: seg(P.colors.thigh), lShin: seg(P.colors.shin), rThigh: seg(P.colors.thigh), rShin: seg(P.colors.shin),
    torso: seg(P.colors.torso), neck: seg(P.colors.head),
    lUpper: seg(P.colors.upper), lFore: seg(P.colors.fore), rUpper: seg(P.colors.upper), rFore: seg(P.colors.fore),
  };
  for (const m of Object.values(parts)) inner.add(m);
  const knots = look.style === "stick" ? [] : [joint(P.colors.upper), joint(P.colors.upper), joint(P.colors.thigh), joint(P.colors.thigh)];
  knots.forEach((k) => inner.add(k));
  const hands = P.colors.hand ? [joint(P.colors.hand), joint(P.colors.hand)] : [];
  hands.forEach((h) => inner.add(h));
  const shoes = P.colors.shoe ? [mesh(unitSphere, toon(P.colors.shoe), id), mesh(unitSphere, toon(P.colors.shoe), id)] : [];
  shoes.forEach((s) => inner.add(s));

  const head = new THREE.Group();
  const skull = mesh(P.box ? unitBox : unitSphere, toon(P.colors.head), id);
  skull.scale.setScalar(P.box ? P.head * 1.9 : P.head);
  head.add(skull);
  inner.add(head);
  const eyeMat = toon("#1a1a1a", OUTLINE, 0);
  const eyes = [mesh(unitSphere, eyeMat, id), mesh(unitSphere, eyeMat, id)];
  const mouth = mesh(unitSphere, eyeMat, id);
  eyes.forEach((e) => head.add(e));
  head.add(mouth);
  if (look.style === "cartoon") addHairAndHat(head, look, P.head, id);
  if (look.style === "robot") {
    const antenna = mesh(unitCylinder, toon("#5d6b78", OUTLINE, 0), id);
    placeSegment(antenna, new THREE.Vector3(0, P.head, 0), new THREE.Vector3(0, P.head + 14, 0), 1.2);
    const ball = mesh(unitSphere, toon("#ff9f1c"), id);
    ball.position.set(0, P.head + 16, 0);
    ball.scale.setScalar(3.5);
    head.add(antenna, ball);
  }
  let skirt: THREE.Mesh | null = null;
  if (look.style === "cartoon" && look.dress) {
    skirt = mesh(new THREE.CylinderGeometry(0.45, 1, 1, 20, 1, true), toon(look.shirt), id);
    (skirt.material as THREE.Material).side = THREE.DoubleSide;
    inner.add(skirt);
  }

  const v = (p: Pt, side: number) => new THREE.Vector3(p.x, -p.y, side);
  const headTopLocal = new THREE.Vector3();

  return {
    root,
    sig: "",
    update: (scene, t, cur) => {
      const obj = cur as StickmanObj;
      placeRoot(root, inner, scene, obj, t, headingOf(obj, t));
      const j = jointsAt(obj, t);
      const p: RigPoints = solveRig(j);
      const sh = look.style === "stick" ? 5 : 10;
      const hp = look.style === "stick" ? 4 : 7;
      placeSegment(parts.lThigh, v(p.hip, -hp), v(p.lKnee, -hp), P.leg[0]);
      placeSegment(parts.lShin, v(p.lKnee, -hp), v(p.lFoot, -hp), P.leg[1]);
      placeSegment(parts.rThigh, v(p.hip, hp), v(p.rKnee, hp), P.leg[0]);
      placeSegment(parts.rShin, v(p.rKnee, hp), v(p.rFoot, hp), P.leg[1]);
      placeSegment(parts.torso, v(p.hip, 0), v(p.neck, 0), P.torso);
      placeSegment(parts.lUpper, v(p.neck, -sh), v(p.lElbow, -sh), P.arm[0]);
      placeSegment(parts.lFore, v(p.lElbow, -sh), v(p.lHand, -sh), P.arm[1]);
      placeSegment(parts.rUpper, v(p.neck, sh), v(p.rElbow, sh), P.arm[0]);
      placeSegment(parts.rFore, v(p.rElbow, sh), v(p.rHand, sh), P.arm[1]);
      const knotAt = [v(p.neck, -sh), v(p.neck, sh), v(p.hip, -hp), v(p.hip, hp)];
      knots.forEach((k, i) => {
        k.position.copy(knotAt[i]);
        k.scale.setScalar(i < 2 ? P.arm[0] * 1.1 : P.leg[0] * 1.1);
      });
      if (hands.length) {
        hands[0].position.copy(v(p.lHand, -sh));
        hands[1].position.copy(v(p.rHand, sh));
        hands.forEach((h) => h.scale.setScalar(P.arm[1] * 1.3));
      }
      if (shoes.length) {
        shoes[0].position.copy(v({ x: p.lFoot.x + 5, y: p.lFoot.y - 3 }, -hp));
        shoes[1].position.copy(v({ x: p.rFoot.x + 5, y: p.rFoot.y - 3 }, hp));
        shoes.forEach((s) => s.scale.set(11, 6, 7));
      }
      const a = (j.torso + j.neck) * DEG;
      const headDist = look.style === "stick" ? 25 : P.head + 5;
      const hc = { x: p.neck.x + Math.sin(a) * headDist, y: p.neck.y - Math.cos(a) * headDist };
      placeSegment(parts.neck, v(p.neck, 0), v(hc, 0), P.neck);
      head.position.copy(v(hc, 0));
      head.rotation.set(0, 0, -a);
      const expr = EXPRESSIONS[Math.round(valueAt(obj, "expr", t))] ?? "none";
      const talk = mouthAt(scene, obj.id, t);
      const showFace = look.style !== "stick" || expr !== "none" || talk > 0.06;
      const r = P.head;
      eyes.forEach((e, i) => {
        e.visible = showFace && look.style !== "robot";
        e.position.set(r * 0.82, r * 0.2, (i ? 1 : -1) * r * 0.32);
        e.scale.set(1.6, 2.2, 1.6);
      });
      mouth.visible = showFace;
      mouth.position.set(look.style === "robot" ? r * 0.95 : r * 0.9, -r * 0.38, 0);
      mouth.scale.set(1.5, 1 + talk * 5, look.style === "robot" ? 7 : 5);
      if (skirt) {
        const kneeY = -Math.max(p.lKnee.y, p.rKnee.y);
        const top = -p.hip.y + 8;
        skirt.position.set(p.hip.x, (top + kneeY) / 2, 0);
        skirt.scale.set(26, Math.max(4, top - kneeY), 20);
      }
      headTopLocal.set(hc.x, -hc.y + r + 4, 0);
    },
    headTop: () => inner.localToWorld(headTopLocal.clone()),
    dispose: () => disposeTree(root),
  };
}

function addHairAndHat(head: THREE.Group, look: Look, r: number, id: string) {
  const hairMat = toon(look.hairColor);
  const cap = (scale = 1.08) => {
    const m = mesh(new THREE.SphereGeometry(r * scale, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, id);
    m.rotation.z = 0.35;
    return m;
  };
  const sphereAt = (x: number, y: number, z: number, s: number, mat = hairMat) => {
    const m = mesh(unitSphere, mat, id);
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    return m;
  };
  switch (look.hair) {
    case "short":
      head.add(cap());
      break;
    case "long": {
      head.add(cap());
      const back = mesh(unitBox, hairMat, id);
      back.position.set(-r * 0.75, -r * 0.6, 0);
      back.scale.set(r * 0.5, r * 1.8, r * 1.7);
      head.add(back);
      break;
    }
    case "spiky":
      head.add(cap());
      for (let i = 0; i < 5; i++) {
        const c = mesh(new THREE.ConeGeometry(4, 12, 8), hairMat, id);
        const ang = (-60 + i * 30) * DEG;
        c.position.set(Math.sin(ang) * r * 0.7 - r * 0.2, Math.cos(ang) * r * 0.95, (i % 2 ? 1 : -1) * r * 0.3);
        c.rotation.z = -ang;
        head.add(c);
      }
      break;
    case "bun":
      head.add(cap(), sphereAt(-r * 0.6, r * 0.9, 0, r * 0.45));
      break;
    case "curly":
      for (let i = 0; i < 9; i++) {
        const ang = (-100 + i * 25) * DEG;
        head.add(sphereAt(Math.sin(ang) * r - r * 0.1, Math.cos(ang) * r * 0.95, (i % 3 - 1) * r * 0.5, 6.5));
      }
      break;
    case "ponytail": {
      head.add(cap());
      const tail = sphereAt(-r * 1.2, -r * 0.1, 0, 1);
      tail.scale.set(r * 0.35, r * 0.8, r * 0.35);
      head.add(tail);
      break;
    }
  }
  if (look.beard) {
    const beard = mesh(new THREE.SphereGeometry(r * 1.02, 20, 10, -Math.PI / 2, Math.PI, Math.PI * 0.55, Math.PI * 0.45), hairMat, id);
    head.add(beard);
  }
  if (look.glasses) {
    const frame = toon("#1a1a1a", OUTLINE, 0);
    for (const s of [-1, 1]) {
      const ring = mesh(new THREE.TorusGeometry(r * 0.24, 1, 8, 20), frame, id);
      ring.position.set(r * 0.9, r * 0.2, s * r * 0.32);
      ring.rotation.y = Math.PI / 2;
      head.add(ring);
    }
  }
  const hatMat = toon(look.hatColor);
  const disc = (radius: number, y: number, x = 0, mat = hatMat) => {
    const m = mesh(unitCylinder, mat, id);
    m.position.set(x, y, 0);
    m.scale.set(radius, 2.5, radius);
    return m;
  };
  switch (look.hat) {
    case "cap": {
      const dome = mesh(new THREE.SphereGeometry(r * 1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatMat, id);
      dome.position.y = r * 0.1;
      head.add(dome, disc(r * 0.8, r * 0.15, r * 0.7));
      break;
    }
    case "beanie": {
      const dome = mesh(new THREE.SphereGeometry(r * 1.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatMat, id);
      head.add(dome, sphereAt(0, r * 1.2, 0, 4.5, toon("#ffffff")));
      break;
    }
    case "tophat": {
      const top = mesh(unitCylinder, hatMat, id);
      top.position.y = r * 1.6;
      top.scale.set(r * 0.72, r * 1.6, r * 0.72);
      head.add(top, disc(r * 1.25, r * 0.8));
      break;
    }
    case "crown": {
      const ring = mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.85, r * 0.7, 10, 1, true), toon("#f4c430"), id);
      (ring.material as THREE.Material).side = THREE.DoubleSide;
      ring.position.y = r * 1.1;
      head.add(ring);
      break;
    }
    case "hardhat": {
      const dome = mesh(new THREE.SphereGeometry(r * 1.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon("#ffc300"), id);
      head.add(dome, disc(r * 1.35, r * 0.05, 0, toon("#ffc300")));
      break;
    }
    case "cowboy": {
      const crown = mesh(unitCylinder, hatMat, id);
      crown.position.y = r * 1.05;
      crown.scale.set(r * 0.75, r * 0.9, r * 0.75);
      head.add(crown, disc(r * 1.8, r * 0.65));
      break;
    }
    case "chef": {
      const white = toon("#ffffff");
      const band = mesh(unitCylinder, white, id);
      band.position.y = r * 0.95;
      band.scale.set(r * 0.85, r * 0.6, r * 0.85);
      head.add(band, sphereAt(0, r * 1.6, 0, r * 0.75, white));
      break;
    }
  }
}

// Animals and custom creatures

function buildCreature(obj: CreatureObj, id: string): Entry {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const bones = rigOf(obj);
  const side = obj.species === "cat" ? 11 : obj.species === "bird" ? 8 : obj.species === "fish" ? 0 : 14;
  const groups = new Map<string, { g: THREE.Group; z: number }>();
  for (const b of bones) {
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    const far = /2$/.test(b.name);
    const near = !far && bones.some((o) => o.name === `${b.name}2`) ;
    const zOff = obj.species === "custom" ? ((b.z ?? 3) - 3) * 3 : far ? -side : near ? side : 0;
    const flatDepth = obj.species === "custom" ? 10 : /leg|shin|wing|tail|jaw|fin/i.test(b.name) ? 7 : 24;
    b.parts.forEach((part, i) => {
      const o = partToObject(part, flatDepth + i * 0.8, id);
      if (o) g.add(o);
    });
    inner.add(g);
    groups.set(b.name, { g, z: zOff });
  }
  const eyes = obj.species !== "custom" ? EYES[obj.species] : null;
  const eyeMeshes: THREE.Mesh[] = [];
  if (eyes) {
    const host = groups.get(eyes.bone);
    const eyeMat = toon("#1a1a1a", OUTLINE, 0);
    for (const s of [-1, 1]) {
      const e = mesh(unitSphere, eyeMat, id);
      e.position.set(eyes.x, -eyes.y, s * (obj.species === "fish" ? 13 : 9));
      e.scale.setScalar(eyes.r);
      host?.g.add(e);
      eyeMeshes.push(e);
    }
  }
  const m4 = new THREE.Matrix4();
  let top = new THREE.Vector3();
  return {
    root,
    sig: "",
    update: (scene, t, cur) => {
      const obj = cur as CreatureObj;
      placeRoot(root, inner, scene, obj, t, headingOf(obj, t));
      const solved = solveCreature(obj, t, mouthAt(scene, obj.id, t));
      let maxY = -Infinity;
      let topX = 0;
      for (const [name, sb] of solved) {
        const entry = groups.get(name);
        if (!entry) continue;
        const { a, b, c, d, e, f } = sb.m;
        m4.set(a, -c, 0, e, -b, d, 0, -f, 0, 0, 1, entry.z, 0, 0, 0, 1);
        entry.g.matrix.copy(m4);
        entry.g.matrixWorldNeedsUpdate = true;
        if (-f > maxY) {
          maxY = -f;
          topX = e;
        }
      }
      const open = valueAt(obj, "eyes", t) > 0.5;
      eyeMeshes.forEach((m) => (m.scale.y = open ? eyes!.r : eyes!.r * 0.25));
      top = new THREE.Vector3(topX, maxY + 40, 0);
    },
    headTop: () => inner.localToWorld(top.clone()),
    dispose: () => disposeTree(root),
  };
}

// Props, text and pictures

function buildDrawing(scene: Scene, obj: DrawingObj, id: string): Entry {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const b = localBounds(undefined, obj);
  const scaleNow = obj.scale || 1;
  const solid = obj.parts.some((p) => p.kind === "box3" || p.kind === "prism3" || p.kind === "sphere3" || p.kind === "cylinder3" || p.kind === "cone3");
  const backdrop = !solid && (b.w * scaleNow >= scene.width * 0.7 || b.h * scaleNow >= scene.height * 0.7);
  const floorDecal = !solid && !backdrop && obj.y + b.y * scaleNow >= scene.ground - 6;
  const autoDepth = Math.max(8, Math.min(60, Math.min(b.w, b.h) * 0.5));
  const depth = obj.depth ?? (backdrop || floorDecal ? 1 : autoDepth);
  const content = new THREE.Group();
  obj.parts.forEach((part, i) => {
    // Later parts stick out a little so a panel inside a frame shows on both sides.
    const o = partToObject(part, depth + i * 1.2, id);
    if (o) content.add(o);
  });
  inner.add(content);
  const partsVisible = (reveal: number) => {
    const shown = reveal * content.children.length;
    content.children.forEach((c, i) => (c.visible = i < shown));
  };
  return {
    root,
    sig: "",
    update: (sc, t, cur) => {
      const obj = cur as DrawingObj;
      const st = worldState(sc, obj, t);
      const z = valueAt(obj, "z", t);
      if (floorDecal) {
        // Ground strips (grass, roads) lie flat on the floor, running toward the camera.
        root.position.set(st.x, 0.6, z);
        root.rotation.set(-Math.PI / 2, 0, 0);
        inner.position.set(0, 0, 0);
        content.position.set(0, st.y - sc.ground, 0);
        inner.scale.setScalar(st.scale);
      } else if (backdrop) {
        // Big backgrounds stand far behind, enlarged so they still fill the view.
        const k = 1.9;
        root.position.set(sc.width / 2 + (st.x - sc.width / 2) * k, (sc.ground - st.y) * k, -900 + z);
        root.rotation.set(0, 0, 0);
        inner.rotation.set(0, 0, -st.rotation * DEG);
        inner.scale.setScalar(st.scale * k);
      } else {
        placeRoot(root, inner, sc, obj, t, valueAt(obj, "yaw", t));
      }
      root.visible = st.opacity > 0.02;
      partsVisible(st.reveal);
    },
    dispose: () => disposeTree(root),
  };
}

function buildText(obj: TextObj, id: string): Entry {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  let shown = "";
  let plane: THREE.Mesh | null = null;
  return {
    root,
    sig: "",
    update: (scene, t, cur) => {
      const obj = cur as TextObj;
      placeRoot(root, inner, scene, obj, t, valueAt(obj, "yaw", t));
      const st = objState(obj, t);
      const text = st.reveal >= 1 ? obj.text : obj.text.slice(0, Math.floor(obj.text.length * st.reveal));
      if (text !== shown || !plane) {
        shown = text;
        if (plane) {
          inner.remove(plane);
          disposeTree(plane);
        }
        const { tex, w, h } = textTexture(text || " ", obj.size, obj.color, FONT_STACKS[obj.font], obj.bold);
        plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
        const full = textTexture(obj.text, obj.size, obj.color, FONT_STACKS[obj.font], obj.bold);
        const left = obj.align === "center" ? -full.w / 2 : obj.align === "right" ? -full.w : 0;
        plane.position.set(left + w / 2, -h / 2, 32);
        plane.userData.id = id;
        full.tex.dispose();
        inner.add(plane);
      }
    },
    dispose: () => disposeTree(root),
  };
}

function buildLight(obj: LightObj, id: string): Entry {
  const root = new THREE.Group();
  const light = obj.kind === "spot" ? new THREE.SpotLight(obj.color, 1, obj.distance, 0.6, 0.5, 1.2) : new THREE.PointLight(obj.color, 1, obj.distance, 1.2);
  light.castShadow = false;
  root.add(light);
  if (light instanceof THREE.SpotLight) {
    root.add(light.target);
    light.target.position.set(0, -1, 0);
  }
  return {
    root,
    sig: "",
    update: (scene, t, cur) => {
      const o = cur as LightObj;
      const st = worldState(scene, o, t);
      root.position.set(st.x, scene.ground - st.y, valueAt(o, "z", t));
      light.color.set(safeColor(o.color));
      light.distance = o.distance;
      // Physically based lights need large numbers; scale so 1 is a pleasant lamp.
      light.intensity = o.intensity * st.opacity * o.distance * o.distance * 0.001;
    },
    dispose: () => light.dispose(),
  };
}

function buildImage(obj: ImageObj, id: string, images: RenderOptions["images"]): Entry {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const img = images?.(obj.asset);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, color: img ? 0xffffff : 0xcccccc });
  if (img) {
    const tex = new THREE.Texture(img as HTMLImageElement);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    mat.map = tex;
  }
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(obj.w, obj.h), mat);
  plane.position.set(obj.w / 2, -obj.h / 2, 0);
  plane.userData.id = id;
  inner.add(plane);
  return {
    root,
    sig: img ? "loaded" : "",
    update: (scene, t, cur) => placeRoot(root, inner, scene, cur, t, valueAt(cur, "yaw", t)),
    dispose: () => disposeTree(root),
  };
}

// ── The stage ────────────────────────────────────────────────────────

const sigCache = new WeakMap<SceneObj, string>();
function structureSig(obj: SceneObj, images: RenderOptions["images"]): string {
  let s = sigCache.get(obj);
  if (s === undefined) {
    const { tracks: _t, links: _l, x: _x, y: _y, rotation: _r, scale: _s, opacity: _o, ...rest } = obj as SceneObj & { pose?: unknown };
    void _t, _l, _x, _y, _r, _s, _o;
    if ("pose" in rest) delete (rest as { pose?: unknown }).pose;
    s = JSON.stringify(rest);
    sigCache.set(obj, s);
  }
  s += `|${LOOK}`;
  if (obj.type === "image") s += images?.(obj.asset) ? "|img" : "";
  if (obj.type === "drawing") s += `|${obj.x},${obj.y},${obj.scale}`;
  return s;
}

interface LightingSpec {
  skyTop: string;
  skyHorizon: string;
  sun: string;
  sunIntensity: number;
  sunElevation: number;
  sunAzimuth: number;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  floor: string;
  exposure: number;
  fogFar: number;
  sunDisc: number;
}

const LIGHTING: Record<LightingPreset, LightingSpec> = {
  day: { skyTop: "#4f9be6", skyHorizon: "#d7ebfb", sun: "#fff3df", sunIntensity: 3.2, sunElevation: 52, sunAzimuth: -38, hemiSky: "#cfe6ff", hemiGround: "#8a8f78", hemi: 1.15, floor: "#b9cf94", exposure: 1.0, fogFar: 22000, sunDisc: 0.6 },
  golden: { skyTop: "#3b4f8f", skyHorizon: "#ffb37a", sun: "#ffb46b", sunIntensity: 3.0, sunElevation: 11, sunAzimuth: -62, hemiSky: "#ffcfa6", hemiGround: "#4b3b4a", hemi: 0.85, floor: "#b59a6e", exposure: 1.05, fogFar: 16000, sunDisc: 1 },
  night: { skyTop: "#050914", skyHorizon: "#22335c", sun: "#9db4ff", sunIntensity: 1.1, sunElevation: 38, sunAzimuth: 35, hemiSky: "#6078b8", hemiGround: "#1a1c28", hemi: 0.8, floor: "#3a4150", exposure: 1.35, fogFar: 9000, sunDisc: 0.25 },
  overcast: { skyTop: "#8d9aa6", skyHorizon: "#d6dce1", sun: "#ffffff", sunIntensity: 0.9, sunElevation: 60, sunAzimuth: -20, hemiSky: "#e6ebef", hemiGround: "#7d8288", hemi: 1.9, floor: "#a8ad9c", exposure: 1.0, fogFar: 12000, sunDisc: 0 },
  studio: { skyTop: "#23262c", skyHorizon: "#4a4f58", sun: "#ffffff", sunIntensity: 2.6, sunElevation: 48, sunAzimuth: -45, hemiSky: "#ffffff", hemiGround: "#30343a", hemi: 0.9, floor: "#3c4048", exposure: 1.05, fogFar: 30000, sunDisc: 0 },
  indoor: { skyTop: "#d8c5a5", skyHorizon: "#f0e3cc", sun: "#ffe7c2", sunIntensity: 1.8, sunElevation: 35, sunAzimuth: -55, hemiSky: "#fff1dc", hemiGround: "#8c7760", hemi: 1.2, floor: "#c9a87c", exposure: 1.0, fogFar: 30000, sunDisc: 0 },
};

function makeSky(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color() },
      sunDisc: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunDisc; varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        if (vDir.y < 0.0) col = horizon;
        float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * sunDisc * (pow(d, 900.0) * 2.0 + pow(d, 12.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40000, 32, 16), material);
  sky.frustumCulled = false;
  return sky;
}

class Stage3D {
  readonly canvas = document.createElement("canvas");
  readonly renderer: THREE.WebGLRenderer;
  readonly outline: OutlineEffect;
  readonly world = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 16 / 9, 5, 60000);
  readonly floor: THREE.Mesh;
  readonly sun: THREE.DirectionalLight;
  readonly entries = new Map<string, Entry>();
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6);
  readonly sky = makeSky();
  readonly fog = new THREE.Fog(0xffffff, 4000, 16000);
  private look: "soft" | "toon" = "soft";
  private sunDir = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.outline = new OutlineEffect(this.renderer, { defaultThickness: 0.0035, defaultColor: [0.1, 0.1, 0.1] });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.world.add(this.hemi, this.sky);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -1600, right: 1600, top: 1600, bottom: -1600, near: 10, far: 8000 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 1.5;
    this.world.add(this.sun, this.sun.target);
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(30000, 64), new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 1, metalness: 0 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.floor.userData.floor = true;
    (this.floor.material as THREE.Material).userData.outlineParameters = { visible: false };
    this.world.add(this.floor);
  }

  private lightCount = 0;

  sync(scene: Scene, t: number, images: RenderOptions["images"]) {
    const seen = new Set<string>();
    this.lightCount = 0;
    for (const obj of scene.objects) {
      if (obj.type === "bubble" || obj.type === "effect" || obj.type === "sound" || FLAT_TYPES.has(obj.type)) continue;
      if (obj.type === "light" && this.lightCount++ > 12) continue;
      seen.add(obj.id);
      const sig = structureSig(obj, images);
      let entry = this.entries.get(obj.id);
      if (entry && entry.sig !== sig) {
        this.world.remove(entry.root);
        entry.dispose();
        entry = undefined;
      }
      if (!entry) {
        entry =
          obj.type === "stickman"
            ? buildHuman(obj, obj.id, images)
            : obj.type === "creature"
              ? buildCreature(obj, obj.id)
              : obj.type === "drawing"
                ? buildDrawing(scene, obj, obj.id)
                : obj.type === "text"
                  ? buildText(obj, obj.id)
                  : obj.type === "light"
                    ? buildLight(obj, obj.id)
                    : buildImage(obj as ImageObj, obj.id, images);
        entry.sig = sig;
        this.world.add(entry.root);
        this.entries.set(obj.id, entry);
      }
      entry.update(scene, t, obj);
    }
    for (const [id, entry] of this.entries) {
      if (!seen.has(id)) {
        this.world.remove(entry.root);
        entry.dispose();
        this.entries.delete(id);
      }
    }
  }

  placeCamera(scene: Scene, t: number) {
    const c3 = camera3dAt(scene, t);
    const c2 = cameraAt(scene, t);
    const dist = c3.dist / c2.zoom;
    const target = new THREE.Vector3(c3.tx + (c2.x - scene.width / 2), c3.ty - (c2.y - scene.height / 2), c3.tz);
    const yaw = c3.yaw * DEG;
    const pitch = c3.pitch * DEG;
    this.camera.fov = c3.fov;
    this.camera.aspect = scene.width / scene.height;
    this.camera.far = Math.max(dist * 20 + 5000, 40000);
    this.camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    // Shadows cover the area around what the camera looks at.
    const reach = Math.min(6000, Math.max(1400, dist * 1.1));
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, far: reach * 6 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.position.copy(target).addScaledVector(this.sunDir, reach * 2.5);
    this.sun.target.position.copy(target);
    this.sky.position.copy(this.camera.position);
    this.sky.scale.setScalar((this.camera.far * 0.9) / 40000);
  }

  render(ctx: Ctx, scene: Scene, t: number, opts: RenderOptions) {
    const w = scene.width;
    const h = scene.height;
    if (this.canvas.width !== w || this.canvas.height !== h) this.renderer.setSize(w, h, false);
    const spec = LIGHTING[scene.lighting ?? "day"];
    const look = scene.look3d ?? "soft";
    if (look !== this.look) this.look = look;
    LOOK = look;
    const el = spec.sunElevation * DEG;
    const az = spec.sunAzimuth * DEG;
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const skyU = (this.sky.material as THREE.ShaderMaterial).uniforms;
    skyU.top.value.set(spec.skyTop);
    skyU.horizon.value.set(spec.skyHorizon);
    skyU.sunColor.value.set(spec.sun);
    skyU.sunDisc.value = spec.sunDisc;
    skyU.sunDir.value.copy(this.sunDir);
    this.world.background = null;
    this.fog.color.set(spec.skyHorizon);
    this.fog.near = spec.fogFar * 0.25;
    this.fog.far = spec.fogFar;
    this.world.fog = this.fog;
    this.sun.color.set(spec.sun);
    this.sun.intensity = spec.sunIntensity;
    this.hemi.color.set(spec.hemiSky);
    this.hemi.groundColor.set(spec.hemiGround);
    this.hemi.intensity = spec.hemi;
    this.renderer.toneMappingExposure = spec.exposure;
    (this.floor.material as THREE.MeshStandardMaterial).color.set(safeColor(scene.floor ?? spec.floor));
    this.sync(scene, t, opts.images);
    this.placeCamera(scene, t);
    // The sky replaces the background color, so nothing else clears the old frame.
    this.renderer.clear();
    if (look === "toon") this.outline.render(this.world, this.camera);
    else this.renderer.render(this.world, this.camera);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.canvas, 0, 0, w, h);
    // Effects and speech bubbles go on top of the 3D picture; bubbles never cover each other.
    const anchorOf = (b: BubbleObj) => (b.target ? this.project(this.entries.get(b.target)?.headTop?.() ?? null, w, h) : null);
    const layouts = arrangeBubbles(ctx, scene, t, anchorOf);
    drawFlatObjects(ctx, scene, t, opts);
    for (const obj of scene.objects) {
      if (obj.type === "effect") drawEffectOverlay(ctx, obj as EffectObj, t);
      if (obj.type === "bubble" && layouts.has(obj.id)) drawBubbleAt(ctx, scene, obj as BubbleObj, t, anchorOf(obj), layouts.get(obj.id));
    }
    ctx.restore();
  }

  project(p: THREE.Vector3 | null, w: number, h: number): Pt | null {
    if (!p) return null;
    const v = p.clone().project(this.camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }

  /** The object under a canvas pixel. */
  pick(scene: Scene, px: number, py: number): string | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((px / scene.width) * 2 - 1, -(py / scene.height) * 2 + 1), this.camera);
    const roots = [...this.entries.values()].map((e) => e.root).filter((r) => r.visible);
    for (const hit of ray.intersectObjects(roots, true)) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.id) o = o.parent;
      if (o?.userData.id) return o.userData.id as string;
    }
    return null;
  }

  /** Screen rectangle around an object. */
  screenBounds(scene: Scene, id: string) {
    const e = this.entries.get(id);
    if (!e) return null;
    const box = new THREE.Box3().setFromObject(e.root);
    if (box.isEmpty()) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = this.project(new THREE.Vector3(x, y, z), scene.width, scene.height);
      if (!p) continue;
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
  }

  /** Where a canvas pixel meets a horizontal plane at the given height. */
  groundPoint(scene: Scene, px: number, py: number, height: number): { x: number; z: number } | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((px / scene.width) * 2 - 1, -(py / scene.height) * 2 + 1), this.camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), hit) ? { x: hit.x, z: hit.z } : null;
  }
}

function drawEffectOverlay(ctx: Ctx, fx: EffectObj, t: number) {
  const st = objState(fx, t);
  if (st.opacity <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= st.opacity;
  ctx.translate(st.x, st.y);
  ctx.scale(st.scale, st.scale);
  drawEffect(ctx, fx, t);
  ctx.restore();
}

let stage: Stage3D | null = null;
let unavailable = false;

export function stage3D(): Stage3D | null {
  if (unavailable) return null;
  if (!stage) {
    try {
      stage = new Stage3D();
    } catch {
      unavailable = true;
      return null;
    }
  }
  return stage;
}

/** RenderOptions.threeD: draws a 3D-mode scene into a 2D canvas context. */
export function render3D(ctx: Ctx, scene: Scene, t: number, opts: RenderOptions): boolean {
  const s = stage3D();
  if (!s) return false;
  s.render(ctx, scene, t, opts);
  return true;
}

