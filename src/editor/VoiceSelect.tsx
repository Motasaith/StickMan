// Narration voice picker: online voices, studio voices, blends and the user's own voices.

import { useVoices, voiceOptions, type VoiceOption } from "@/lib/voices";
import { VOICES } from "@/engine/voices";
import { VOICE_IDS } from "@/engine/scene";

const GROUPS: VoiceOption["group"][] = ["Online (fast)", "Studio (on this computer)", "Blends", "Your voices"];

export function VoiceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const voices = useVoices();
  const options = voiceOptions(voices);
  // Until the list loads (or if the server can't list local voices), the online voices still work.
  const fallback = VOICE_IDS.filter((v) => !["dog", "cat", "bird"].includes(v)).map((v) => ({ id: v, label: VOICES[v].label, group: "Online (fast)" as const }));
  const list = options.length ? options : fallback;
  const known = list.some((o) => o.id === value);
  return (
    <select className="select-native max-w-[190px]" value={value} onChange={(e) => onChange(e.target.value)}>
      {!known && <option value={value}>{value}</option>}
      {GROUPS.map((g) => {
        const items = list.filter((o) => o.group === g);
        if (!items.length) return null;
        return (
          <optgroup key={g} label={g}>
            {items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
