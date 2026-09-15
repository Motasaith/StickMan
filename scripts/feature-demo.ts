// Builds a scene that uses every character type and effect, then renders contact sheets.
// Usage: tsx scripts/feature-demo.ts <outDir>
import { createCanvas, Path2D } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyOps } from "../src/engine/ops";
import { renderScene } from "../src/engine/render";
import { emptyScene, type Asset, type Scene } from "../src/engine/scene";

(globalThis as { Path2D?: unknown }).Path2D = Path2D;
const out = process.argv[2] ?? "feature-demo";
mkdirSync(out, { recursive: true });

// A front-facing test character picture with known joints (arms held out a little).
const pic = createCanvas(300, 520);
const pc = pic.getContext("2d");
const J = {
  head: { x: 150, y: 70 },
  neck: { x: 150, y: 128 },
  hip: { x: 150, y: 290 },
  lElbow: { x: 88, y: 200 },
  lHand: { x: 60, y: 272 },
  rElbow: { x: 212, y: 200 },
  rHand: { x: 240, y: 272 },
  lKnee: { x: 122, y: 390 },
  lFoot: { x: 112, y: 490 },
  rKnee: { x: 178, y: 390 },
  rFoot: { x: 188, y: 490 },
};
const limb = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, c: string) => {
  pc.strokeStyle = "#222";
  pc.lineCap = "round";
  pc.lineWidth = w + 6;
  pc.beginPath();
  pc.moveTo(a.x, a.y);
  pc.lineTo(b.x, b.y);
  pc.stroke();
  pc.strokeStyle = c;
  pc.lineWidth = w;
  pc.stroke();
};
limb(J.hip, J.lKnee, 30, "#264653");
limb(J.lKnee, J.lFoot, 26, "#264653");
limb(J.hip, J.rKnee, 30, "#264653");
limb(J.rKnee, J.rFoot, 26, "#264653");
limb(J.neck, J.hip, 70, "#e76f51");
limb({ x: 128, y: 140 }, J.lElbow, 22, "#e76f51");
limb(J.lElbow, J.lHand, 18, "#f4a261");
limb({ x: 172, y: 140 }, J.rElbow, 22, "#e76f51");
limb(J.rElbow, J.rHand, 18, "#f4a261");
pc.fillStyle = "#f4a261";
pc.strokeStyle = "#222";
pc.lineWidth = 5;
pc.beginPath();
pc.arc(J.head.x, J.head.y, 52, 0, Math.PI * 2);
pc.fill();
pc.stroke();
pc.fillStyle = "#222";
for (const ex of [130, 170]) {
  pc.beginPath();
  pc.arc(ex, 62, 6, 0, Math.PI * 2);
  pc.fill();
}
pc.beginPath();
pc.arc(150, 88, 16, 0.1 * Math.PI, 0.9 * Math.PI);
pc.stroke();
const picBuf = pic.toBuffer("image/png");
writeFileSync(join(out, "puppet-source.png"), picBuf);

const assets: Asset[] = [{ id: "asset_hero", name: "hero", src: "", w: 300, h: 520, joints: J }];
const images = new Map<string, unknown>([["asset_hero", pic]]);

const s0 = emptyScene();
const g = s0.ground;
const ops = [
  { op: "scene", background: "#dff3ff", duration: 12 },
  { op: "draw", id: "grass", x: 0, y: g, parts: [{ kind: "rect", x: 0, y: 0, w: 1280, h: 110, fill: "#8bc34a" }] },
  { op: "draw", id: "tree", x: 1120, y: g, parts: [{ kind: "rect", x: -14, y: -170, w: 28, h: 170, fill: "#8d5524" }, { kind: "circle", cx: 0, cy: -200, r: 70, fill: "#4caf50", stroke: "#1a1a1a", width: 3 }] },
  { op: "draw", id: "pond", x: 540, y: 690, parts: [{ kind: "ellipse", cx: 0, cy: 0, rx: 160, ry: 28, fill: "#4fc3f7", stroke: "#1a1a1a", width: 3 }] },
  { op: "draw", id: "ball", name: "Ball", x: 420, y: g - 22, parts: [{ kind: "circle", cx: 0, cy: 0, r: 22, fill: "#ff595e", stroke: "#1a1a1a", width: 3 }] },
  { op: "draw", id: "plane", name: "Paper plane", x: 80, y: 120, parts: [{ kind: "poly", points: [30, 0, -20, -14, -10, 0, -20, 14], closed: true, fill: "#ffffff", stroke: "#1a1a1a", width: 2 }] },
  { op: "character", id: "ali", name: "Ali", x: 150, look: { hair: "spiky", hat: "cap", hatColor: "#e63946", shirt: "#2a9d8f" }, voice: "boy" },
  { op: "character", id: "zara", name: "Zara", x: 820, look: { hair: "ponytail", hairColor: "#6d3b1f", shirt: "#ff70a6", dress: true, glasses: true }, facing: "left" },
  { op: "character", id: "bot", name: "Bot", x: 1000, look: { style: "robot", shirt: "#8ecae6" }, facing: "left" },
  { op: "puppet", id: "hero", asset: "hero", x: 640, scale: 1.1 },
  { op: "creature", id: "rex", species: "dog", x: 250 },
  { op: "creature", id: "tom", species: "cat", x: 960, pose: "lie" },
  { op: "creature", id: "tweety", species: "bird", x: 700, facing: "left" },
  { op: "creature", id: "nemo", species: "fish", x: 470, y: 694, scale: 0.8 },
  { op: "walk", id: "ali", to: "ball", at: 0.5 },
  { op: "hold", id: "ali", item: "ball", at: 2.0 },
  { op: "walk", id: "ali", x: 360, at: 3.2 },
  { op: "drop", id: "ball", at: 4.4 },
  { op: "bounce", id: "ball", at: 4.9, height: 160, times: 3 },
  { op: "walk", id: "rex", x: 560, at: 0.3 },
  { op: "pose", id: "rex", pose: "sit", at: 3 },
  { op: "action", id: "rex", action: "wagTail", at: 3.6, times: 4 },
  { op: "action", id: "rex", action: "bark", at: 5.2, times: 3 },
  { op: "action", id: "tom", action: "sleep", at: 0.5 },
  { op: "walk", id: "tweety", x: 620, at: 0.5 },
  { op: "fly", id: "tweety", x: 1110, y: g - 270, at: 2.5 },
  { op: "walk", id: "nemo", x: 610, at: 0.2, duration: 3 },
  { op: "action", id: "hero", action: "wave", at: 1, times: 3 },
  { op: "walk", id: "hero", x: 760, at: 3.5 },
  { op: "action", id: "bot", action: "dance", at: 1, times: 2 },
  { op: "say", character: "zara", text: "Nice catch!", at: 5, duration: 2 },
  { op: "path", id: "plane", points: [80, 120, 400, 60, 700, 200, 1000, 90, 1250, 150], at: 0, duration: 6, orient: true },
  { op: "effect", id: "party", kind: "confetti", at: 8 },
  { op: "effect", id: "sparks", kind: "sparkles", x: 560, y: 360, w: 200, h: 200, at: 6 },
  { op: "effect", id: "chimney", kind: "smoke", x: 40, y: 300, w: 120, h: 300 },
  { op: "shake", at: 8, duration: 0.6, strength: 14 },
  { op: "action", id: "ali", action: "celebrate", at: 8.2 },
];
const outcome = applyOps(s0, ops, assets);
for (const r of outcome.results) console.log(r.ok ? "  ok " : "  ERR", r.message);
const scene: Scene = outcome.scene;
writeFileSync(join(out, "scene.json"), JSON.stringify({ scene, assets: [] }));

function sheet(name: string, times: number[], cols = 3) {
  const cw = 640;
  const ch = 360;
  const rows = Math.ceil(times.length / cols);
  const c = createCanvas(cols * cw, rows * ch);
  const cx = c.getContext("2d");
  times.forEach((t, i) => {
    const f = createCanvas(scene.width, scene.height);
    renderScene(f.getContext("2d") as unknown as CanvasRenderingContext2D, scene, t, {
      images: (id) => images.get(id) as unknown as CanvasImageSource,
    });
    cx.drawImage(f, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
    cx.fillStyle = "#c00";
    cx.font = "bold 22px sans-serif";
    cx.fillText(`${t}s`, (i % cols) * cw + 8, Math.floor(i / cols) * ch + 26);
  });
  writeFileSync(join(out, name), c.toBuffer("image/png"));
}
sheet("sheet-a.png", [0.1, 1.2, 2.2, 3.4, 4.6, 5.3]);
sheet("sheet-b.png", [6.2, 8.1, 8.5, 9.5, 3.8, 1.6]);
// Close-up of the characters at rest, full resolution.
const f = createCanvas(scene.width, scene.height);
renderScene(f.getContext("2d") as unknown as CanvasRenderingContext2D, scene, 1.35, { images: (id) => images.get(id) as unknown as CanvasImageSource });
writeFileSync(join(out, "frame-1.35.png"), f.toBuffer("image/png"));
