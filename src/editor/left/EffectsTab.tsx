import { EFFECT_KINDS, COLOR_LOOKS } from "@/engine/scene";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { PanelHeader, GroupLabel, addAt } from "./common";

const EMOJI: Record<string, string> = { rain: "\u{1F327}", snow: "❄️", confetti: "\u{1F389}", smoke: "\u{1F32B}", sparkles: "✨", bubbles: "\u{1F535}", leaves: "\u{1F342}", fire: "\u{1F525}", stars: "⭐", hearts: "\u{1F496}" };

export function EffectsTab() {
  const grade = useStore((s) => s.scene.grade);
  return (
    <>
      <PanelHeader title="Effects and looks" subtitle="Particles over the scene, and a color grade for the whole video." />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <GroupLabel>Particles</GroupLabel>
        <div className="grid grid-cols-3 gap-2">
          {EFFECT_KINDS.map((k) => (
            <button
              key={k}
              className="tile h-16 capitalize"
              onClick={() =>
                addAt(k, (id, at, s) => {
                  const small = k === "smoke" || k === "fire";
                  return { op: "effect", id, kind: k, ...(small ? { x: s.scene.width / 2 - 70, y: s.scene.ground - 300, w: 140, h: 300 } : {}), at };
                })
              }
            >
              <span className="text-xl">{EMOJI[k]}</span>
              {k}
            </button>
          ))}
        </div>
        <GroupLabel>Color grade (whole video)</GroupLabel>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_LOOKS.map((l) => {
            const on = l.id === "natural" ? !grade : !!grade && JSON.stringify(grade) === JSON.stringify(l.adjust);
            const f = `brightness(${1 + l.adjust.brightness / 100}) contrast(${1 + l.adjust.contrast / 100}) saturate(${Math.max(0, 1 + l.adjust.saturation / 100)}) sepia(${Math.max(0, l.adjust.warmth) / 150})`;
            return (
              <button key={l.id} onClick={() => useStore.getState().run([{ op: "grade", look: l.id }])} className={cn("overflow-hidden rounded-lg border text-left text-[11px] transition", on ? "border-primary" : "border-line hover:border-primary/60")}>
                <div className="h-12 bg-gradient-to-br from-[#e07a5f] via-[#81b29a] to-[#3d405b]" style={{ filter: f }} />
                <div className="px-2 py-1">{l.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
