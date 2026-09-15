// Render frames of a scene to PNG files without a browser, for checking the look.
// Usage: tsx scripts/render-frames.ts <scene.json|--poses> <outDir> [times...]
import { createCanvas, Path2D } from "@napi-rs/canvas";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderScene } from "../src/engine/render";
import { applyOps } from "../src/engine/ops";
import { emptyScene, type Scene } from "../src/engine/scene";
import { POSE_NAMES } from "../src/engine/rig";

(globalThis as { Path2D?: unknown }).Path2D = Path2D;

const [input = "--poses", outDir = "frames", ...timeArgs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

let scene: Scene;
if (input === "--poses") {
  const s = emptyScene(1600, 900);
  const ops: unknown[] = [];
  POSE_NAMES.forEach((pose, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    ops.push({ op: "character", id: `p${i}`, x: 130 + col * 260, y: 260 + row * 300, pose, expression: "happy" });
    ops.push({ op: "text", id: `l${i}`, text: pose, x: 130 + col * 260, y: 275 + row * 300, size: 22, align: "center" });
  });
  scene = applyOps(s, ops).scene;
} else {
  const data = JSON.parse(readFileSync(input, "utf8"));
  scene = data.scene ?? data;
}

const times = timeArgs.length ? timeArgs.map(Number) : [0];
for (const t of times) {
  const canvas = createCanvas(scene.width, scene.height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  renderScene(ctx, scene, t);
  const file = join(outDir, `t${t.toFixed(2)}.png`);
  writeFileSync(file, canvas.toBuffer("image/png"));
  console.log(file);
}
