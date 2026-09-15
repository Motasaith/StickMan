// Tile several frames of a scene into one PNG with time labels.
// Usage: tsx scripts/contact-sheet.ts <scene.json> <out.png> <cols> times...
import { createCanvas, Path2D } from "@napi-rs/canvas";
import { readFileSync, writeFileSync } from "node:fs";
import { renderScene } from "../src/engine/render";

(globalThis as { Path2D?: unknown }).Path2D = Path2D;
const [input, out, colsArg, ...timeArgs] = process.argv.slice(2);
const data = JSON.parse(readFileSync(input, "utf8"));
const scene = data.scene ?? data;
const times = timeArgs.map(Number);
const cols = Number(colsArg) || 3;
const cw = 640;
const ch = Math.round((cw * scene.height) / scene.width);
const rows = Math.ceil(times.length / cols);
const sheet = createCanvas(cols * cw, rows * ch);
const sctx = sheet.getContext("2d");
times.forEach((t, i) => {
  const c = createCanvas(scene.width, scene.height);
  renderScene(c.getContext("2d") as unknown as CanvasRenderingContext2D, scene, t);
  const x = (i % cols) * cw;
  const y = Math.floor(i / cols) * ch;
  sctx.drawImage(c, x, y, cw, ch);
  sctx.strokeStyle = "#888";
  sctx.strokeRect(x, y, cw, ch);
  sctx.fillStyle = "#c00";
  sctx.font = "bold 22px sans-serif";
  sctx.fillText(`${t}s`, x + 10, y + 28);
});
writeFileSync(out, sheet.toBuffer("image/png"));
