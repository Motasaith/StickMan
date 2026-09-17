import { Play } from "lucide-react";
import { SOUND_KINDS, type SoundKind } from "@/engine/scene";
import { soundBuffer } from "@/sfx";
import { audioContext } from "@/audio";
import { useStore } from "@/store";
import { PanelHeader, GroupLabel } from "./common";
import { MusicSearch } from "./MusicSearch";

const LABEL: Record<SoundKind, string> = {
  pop: "Pop", boing: "Boing", whoosh: "Whoosh", thud: "Thud", ding: "Ding", click: "Click", splash: "Splash", applause: "Applause", thunder: "Thunder", magic: "Magic",
  bark: "Bark", meow: "Meow", tweet: "Tweet", honk: "Honk", footsteps: "Footsteps", drumroll: "Drum roll", rain: "Rain (ambience)", wind: "Wind (ambience)",
};

async function hear(kind: SoundKind) {
  const buf = await soundBuffer(kind, 2);
  const ac = audioContext();
  if (ac.state === "suspended") await ac.resume();
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.connect(ac.destination);
  src.start();
}

export function SoundsTab() {
  return (
    <>
      <PanelHeader title="Music and sound effects" subtitle="Creative Commons music you can use in monetized videos, and effects made on your computer." />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <GroupLabel>Music</GroupLabel>
        <MusicSearch />
        <GroupLabel>Effects (click to add at the playhead)</GroupLabel>
        <div className="flex flex-col gap-1">
          {SOUND_KINDS.map((k) => (
            <div key={k} className="flex items-center gap-2 rounded-md border border-line bg-panel-sunken px-2 py-1.5">
              <button className="rounded-full bg-panel-raised p-1.5 hover:bg-primary hover:text-primary-foreground" title="Hear it" onClick={() => void hear(k)}>
                <Play className="size-3" />
              </button>
              <button
                className="flex-1 text-left text-[13px] hover:text-primary"
                onClick={() => {
                  const s = useStore.getState();
                  s.run([{ op: "sound", kind: k, at: Math.round(s.time * 100) / 100, ...(k === "rain" || k === "wind" ? { duration: Math.max(2, s.scene.duration - s.time) } : {}) }]);
                  const made = [...useStore.getState().scene.objects].reverse().find((o) => o.type === "sound");
                  if (made) useStore.getState().select(made.id);
                }}
              >
                {LABEL[k]}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Voices come from the AI Director (narration and speech bubbles) or from Record. Upload your own music or sounds in Media.</p>
      </div>
    </>
  );
}
