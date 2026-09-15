// Builds a sample classroom scene from ops, the same way the AI does.
import { writeFileSync } from "node:fs";
import { applyOps } from "../src/engine/ops";
import { emptyScene } from "../src/engine/scene";

const ops = [
  { op: "draw", id: "board", name: "Blackboard", x: 640, y: 110, drawOn: 1.2, parts: [
    { kind: "rect", x: 0, y: 0, w: 520, h: 300, r: 6, fill: "#2f4f3a", stroke: "#8b5a2b", width: 14 },
    { kind: "rect", x: 20, y: 300, w: 480, h: 14, fill: "#8b5a2b" },
  ]},
  { op: "draw", id: "floor", x: 0, y: 0, parts: [{ kind: "line", x1: 0, y1: 620, x2: 1280, y2: 620, stroke: "#999", width: 3 }] },
  { op: "character", id: "teacher", name: "Teacher", x: 150, facing: "right", expression: "happy" },
  { op: "walk", id: "teacher", x: 580, at: 0.5 },
  { op: "action", id: "teacher", action: "write", at: 3.4, times: 3 },
  { op: "text", id: "sum", text: "2 + 2 = 4", x: 900, y: 200, size: 64, color: "#ffffff", font: "chalk", align: "center", at: 3.6, typeOn: 1.4 },
  { op: "face", id: "teacher", direction: "left", at: 5.4 },
  { op: "say", character: "teacher", text: "Easy, right?", at: 5.6, duration: 2 },
  { op: "action", id: "teacher", action: "jump", at: 7.8 },
  { op: "camera", zoom: 1.4, x: 760, y: 360, at: 3.4, duration: 1 },
];
const out = applyOps(emptyScene(), ops);
for (const r of out.results) console.log(r.ok ? "ok  " : "ERR ", r.message);
writeFileSync(process.argv[2] ?? "demo.json", JSON.stringify(out.scene, null, 1));
