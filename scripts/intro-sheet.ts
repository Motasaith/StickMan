// Render every intro and outro template, a few moments each, into one sheet.
// Usage: npx tsx scripts/intro-sheet.ts <out.png> [16:9|9:16]
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { emptyScene } from "../src/engine/scene";
import { INTROS, OUTROS, addIntro, addOutro } from "../src/engine/intros";
import { renderScene } from "../src/engine/render";
import { nodeLookups, registerNodeFonts } from "./slides-sheet";

registerNodeFonts();
const out = process.argv[2] ?? "intros.png";
const vertical = process.argv[3] === "9:16";
const [W, H] = vertical ? [720, 1280] : [1280, 720];
const look = nodeLookups();
const card = { title: "The Salary Trap", subtitle: "Why hard work alone won't make you rich", channel: "Wealth Lab", accent: "#F59E0B", accent2: "#7C3AED" };

const rows: Array<{ label: string; scene: ReturnType<typeof emptyScene>; times: number[] }> = [];
for (const t of INTROS) {
  const base = emptyScene(W, H);
  base.duration = 1;
  base.slides = [{ id: "main", title: "Main", start: 0, duration: 1, background: { kind: "color", color: "#333" }, transition: { kind: "cut", duration: 0 } }];
  const { scene, problems } = addIntro(base, t.id, card);
  if (problems.length) console.log(t.id, problems);
  rows.push({ label: `intro ${t.id}`, scene, times: [0.5, 1.2, t.duration * 0.6, t.duration - 0.3, t.duration + 0.25] });
}
for (const t of OUTROS) {
  const base = emptyScene(W, H);
  base.duration = 1;
  base.slides = [{ id: "main", title: "Main", start: 0, duration: 1, background: { kind: "color", color: "#333" }, transition: { kind: "cut", duration: 0 } }];
  const { scene, problems } = addOutro(base, t.id, card);
  if (problems.length) console.log(t.id, problems);
  rows.push({ label: `outro ${t.id}`, scene, times: [1.3, 1.8, 2.6, 4, t.duration] });
}

const cw = vertical ? 180 : 320;
const ch = vertical ? 320 : 180;
const cols = 5;
const sheet = createCanvas(cols * cw, rows.length * ch);
const sctx = sheet.getContext("2d");
const frame = createCanvas(W, H);
const fctx = frame.getContext("2d") as unknown as CanvasRenderingContext2D;
rows.forEach((row, r) => {
  row.times.forEach((time, c) => {
    renderScene(fctx, row.scene, time, look);
    sctx.drawImage(frame, c * cw, r * ch, cw, ch);
    sctx.fillStyle = "rgba(0,0,0,0.65)";
    sctx.fillRect(c * cw, r * ch, 150, 16);
    sctx.fillStyle = "#fff";
    sctx.font = "11px sans-serif";
    sctx.fillText(`${row.label} ${time.toFixed(1)}s`, c * cw + 4, r * ch + 12);
  });
});
writeFileSync(out, sheet.toBuffer("image/png"));
console.log("wrote", out);
