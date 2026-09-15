// Draw every sticker (or illustration) with the engine's SVG renderer into one sheet.
// Usage: npx tsx scripts/sticker-sheet.ts <out.png> [stickers|illustrations] [time] [cell size] [id,id,...]
import { createCanvas } from "@napi-rs/canvas";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { drawSvg, parseSvg } from "../src/engine/svg";

const out = process.argv[2] ?? "sheet.png";
const dir = join("public", process.argv[3] ?? "stickers");
const t = Number(process.argv[4] ?? 0);
const only = process.argv[6]?.split(",");
const files = readdirSync(dir).filter((f) => f.endsWith(".svg") && (!only || only.includes(f.replace(".svg", "")))).sort();
const cell = Number(process.argv[5] ?? 96);
const cols = Math.max(4, Math.floor(1600 / cell));
const rows = Math.ceil(files.length / cols);
const canvas = createCanvas(cols * cell, rows * (cell + 14));
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
ctx.fillStyle = "#f3f0e8";
ctx.fillRect(0, 0, canvas.width, canvas.height);
let failed = 0;
files.forEach((f, i) => {
  const doc = parseSvg(readFileSync(join(dir, f), "utf8"));
  const x = (i % cols) * cell;
  const y = Math.floor(i / cols) * (cell + 14);
  ctx.save();
  ctx.translate(x + 8, y + 4);
  if (doc) drawSvg(ctx, doc, t, cell - 16, cell - 16);
  else failed++;
  ctx.restore();
  ctx.fillStyle = "#555";
  ctx.font = "10px sans-serif";
  ctx.fillText(f.replace(".svg", "").slice(0, 16), x + 4, y + cell + 8);
});
writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`${files.length} drawn, ${failed} failed -> ${out}`);
