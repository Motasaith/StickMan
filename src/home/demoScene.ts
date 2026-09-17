// The sample project on the home page: a short narrated deck with an animated intro.

import { emptyScene, type Scene } from "@/engine/scene";
import { applyOps } from "@/engine/ops";

export const DEMO_DECK = [
  {
    op: "presentation",
    title: "Healthy Smiles",
    theme: "medical",
    captions: true,
    slides: [
      { layout: "title", title: "Healthy Smiles", subtitle: "A guide to caring for your teeth", illustration: "teeth", narration: "Welcome! Today we will learn how to keep your smile healthy for life." },
      { layout: "bullets", title: "Daily habits", bullets: ["Brush twice a day for two minutes", "Floss once a day", "Drink water after meals"], illustration: "toothbrush", narration: "Three simple habits protect your teeth every single day." },
      { layout: "stat", title: "Did you know?", stat: { value: 92, label: "of adults have had a cavity", suffix: "%" }, illustration: "tooth", narration: "Most adults have had at least one cavity, so prevention really matters." },
      { layout: "steps", title: "How to brush", steps: ["Wet the brush", "Small circles", "Every surface", "Rinse"], narration: "Follow these four steps each time you brush." },
      { layout: "closing", title: "Keep smiling!", subtitle: "See your dentist every six months", illustration: "happyface", narration: "Keep smiling, and see your dentist every six months." },
    ],
  },
];

export function deckScene(): Scene {
  return applyOps(emptyScene(), DEMO_DECK).scene;
}
