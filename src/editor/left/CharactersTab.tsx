import { useStore } from "@/store";
import { PanelHeader, GroupLabel, addAt } from "./common";

type Make = Parameters<typeof addAt>[1];

const slot = (s: ReturnType<typeof useStore.getState>) => s.scene.width / 2 + [0, -220, 220, -420, 420][s.scene.objects.filter((o) => o.type === "stickman" || o.type === "creature").length % 5];

const PEOPLE: { label: string; emoji: string; base: string; make: Make }[] = [
  { label: "Stick figure", emoji: "\u{1F9CD}", base: "man", make: (id, at, s) => ({ op: "character", id, x: slot(s), at: at || undefined }) },
  { label: "Cartoon man", emoji: "\u{1F468}", base: "man", make: (id, at, s) => ({ op: "character", id, name: "Man", x: slot(s), look: { style: "cartoon", hair: "short", shirt: "#3a86ff" }, voice: "man", at: at || undefined }) },
  { label: "Cartoon woman", emoji: "\u{1F469}", base: "woman", make: (id, at, s) => ({ op: "character", id, name: "Woman", x: slot(s), look: { style: "cartoon", hair: "long", shirt: "#ff70a6", dress: true }, voice: "woman", at: at || undefined }) },
  { label: "Kid", emoji: "\u{1F9D2}", base: "kid", make: (id, at, s) => ({ op: "character", id, name: "Kid", x: slot(s), scale: 0.75, look: { style: "cartoon", hair: "spiky", shirt: "#2a9d8f", hat: "cap" }, voice: "boy", at: at || undefined }) },
  { label: "Doctor", emoji: "\u{1F9D1}‍⚕️", base: "doctor", make: (id, at, s) => ({ op: "character", id, name: "Doctor", x: slot(s), look: { style: "cartoon", hair: "bun", shirt: "#ffffff", pants: "#6b7689", glasses: true }, voice: "woman", at: at || undefined }) },
  { label: "Teacher", emoji: "\u{1F9D1}‍\u{1F3EB}", base: "teacher", make: (id, at, s) => ({ op: "character", id, name: "Teacher", x: slot(s), look: { style: "cartoon", hair: "short", shirt: "#6a4c93", beard: true, glasses: true }, voice: "man", at: at || undefined }) },
  { label: "Chef", emoji: "\u{1F9D1}‍\u{1F373}", base: "chef", make: (id, at, s) => ({ op: "character", id, name: "Chef", x: slot(s), look: { style: "cartoon", hat: "chef", shirt: "#ffffff" }, voice: "man", at: at || undefined }) },
  { label: "Robot", emoji: "\u{1F916}", base: "robot", make: (id, at, s) => ({ op: "character", id, name: "Robot", x: slot(s), look: { style: "robot", shirt: "#8ecae6" }, voice: "robot", at: at || undefined }) },
];

const ANIMALS: { label: string; emoji: string; species: string }[] = [
  { label: "Dog", emoji: "\u{1F415}", species: "dog" },
  { label: "Cat", emoji: "\u{1F408}", species: "cat" },
  { label: "Bird", emoji: "\u{1F426}", species: "bird" },
  { label: "Fish", emoji: "\u{1F41F}", species: "fish" },
];

export function CharactersTab() {
  return (
    <>
      <PanelHeader title="Characters and animals" subtitle="Rigged figures you can pose, walk, and give a voice. Select one to pose it by dragging its joints." />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <GroupLabel>People</GroupLabel>
        <div className="grid grid-cols-2 gap-2">
          {PEOPLE.map((p) => (
            <button key={p.label} className="tile h-16" onClick={() => addAt(p.base, p.make)}>
              <span className="text-2xl">{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
        <GroupLabel>Animals</GroupLabel>
        <div className="grid grid-cols-4 gap-2">
          {ANIMALS.map((a) => (
            <button
              key={a.species}
              className="tile h-16"
              onClick={() => addAt(a.species, (id, at, s) => ({ op: "creature", id, name: a.label, species: a.species, x: slot(s), ...(a.species === "fish" ? { y: s.scene.height / 2 } : {}), at: at || undefined }))}
            >
              <span className="text-2xl">{a.emoji}</span>
              {a.label}
            </button>
          ))}
        </div>
        <GroupLabel>Your own character</GroupLabel>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Upload a full-body picture in Media, then press the little person button on it. The AI finds its joints and it becomes a puppet that walks, waves and talks.
        </p>
        <button className="chip mt-2" onClick={() => useStore.getState().setLeftTab("media")}>
          Go to Media
        </button>
      </div>
    </>
  );
}
