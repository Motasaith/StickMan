// Print the AI system prompt size and a scene description for a sample presentation.
// Usage: npx tsx scripts/prompt-peek.ts [section]
import { describeScene, systemPrompt } from "../server/prompt";
import { emptyScene } from "../src/engine/scene";
import { applyOps } from "../src/engine/ops";

const scene = emptyScene();
const sp = systemPrompt(scene);
console.log("system prompt chars:", sp.length);
const section = process.argv[2];
if (section) {
  const i = sp.indexOf(section);
  console.log(i < 0 ? "(section not found)" : sp.slice(i, i + 3000));
}
const r = applyOps(
  scene,
  [
    {
      op: "presentation",
      title: "Smiles",
      theme: "medical",
      slides: [
        { layout: "title", title: "Hi", illustration: "teeth", narration: "Hello there." },
        { layout: "bullets", title: "Braces", bullets: ["a", "b"], illustration: "dental braces" },
      ],
    },
  ],
  []
);
console.log(r.results.map((x) => x.message));
console.log(describeScene(r.scene, [], { time: 0, selectedId: null }));
