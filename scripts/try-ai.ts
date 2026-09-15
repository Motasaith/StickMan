// Send a prompt through the real AI endpoint and save the resulting scene.
// Usage: tsx scripts/try-ai.ts "<prompt>" <out.json> [existing-scene.json]
import { readFileSync, writeFileSync } from "node:fs";
import { app } from "../server/app";
import { applyOps } from "../src/engine/ops";
import { emptyScene } from "../src/engine/scene";

const [prompt, out = "ai-scene.json", from] = process.argv.slice(2);
const scene = from ? JSON.parse(readFileSync(from, "utf8")) : emptyScene();
const started = Date.now();
const res = await app.request("/api/ai/plan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, scene, assets: [], time: 0, selectedId: null, history: [] }),
});
const data = (await res.json()) as { reply?: string; ops?: unknown[]; skipped?: string[]; error?: string };
console.log(`status ${res.status} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (data.error) throw new Error(data.error);
console.log("reply:", data.reply);
console.log("ops:", data.ops?.length, "skipped:", data.skipped, "warnings left:", (data as { warnings?: string[] }).warnings);
const result = applyOps(scene, data.ops ?? []);
for (const r of result.results) console.log(r.ok ? "  ok " : "  ERR", r.message);
writeFileSync(out, JSON.stringify(result.scene, null, 1));
console.log("duration", result.scene.duration);
