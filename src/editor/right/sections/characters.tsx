import { useState } from "react";
import { Loader2, Mic, Play, Volume2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useStore } from "@/store";
import {
  DEFAULT_LOOK,
  EFFECT_KINDS,
  EXPRESSIONS,
  HAIRS,
  HATS,
  SOUND_KINDS,
  VOICE_IDS,
  cloneScene,
  findObj,
  type BubbleObj,
  type CreatureObj,
  type DrawingObj,
  type EffectObj,
  type LightObj,
  type SoundObj,
  type StickmanObj,
  type VoiceId,
} from "@/engine/scene";
import { POSE_NAMES } from "@/engine/rig";
import { ACTIONS } from "@/engine/motion";
import { CREATURE_POSES, creatureActionsFor } from "@/engine/creatures";
import { VOICES } from "@/engine/voices";
import { partSchema } from "@/engine/ops";
import { activeLink } from "@/engine/render";
import { api } from "@/lib/api";
import { audioContext, playClip } from "@/audio";
import { soundBuffer } from "@/sfx";
import { generateVoices, voiceFor } from "@/voice";
import { ColorInput, NumField, Row, Section, SelectField, SliderRow, TextField, Toggle, Note, run } from "../../fields";

const time = () => Math.round(useStore.getState().time * 100) / 100;

function patch<T extends { id: string }>(id: string, apply: (o: T) => void) {
  const s = useStore.getState();
  const next = cloneScene(s.scene);
  const o = findObj(next, id) as unknown as T | undefined;
  if (!o) return;
  apply(o);
  s.commit(next);
}

async function hearVoice(voice: VoiceId, text: string) {
  const rec = await api.voice(text, voice);
  await playClip({ id: rec.id, src: rec.src });
}

function VoiceRow({ value, onChange, sample, allowAuto }: { value: string; onChange: (v: string) => void; sample: string; allowAuto?: boolean }) {
  const [busy, setBusy] = useState(false);
  const voice = (value || "man") as VoiceId;
  return (
    <Row label="Voice">
      <SelectField value={value} options={[...(allowAuto ? [{ value: "", label: "Speaker's voice" }, { value: "none", label: "Silent" }] : []), ...VOICE_IDS.map((v) => ({ value: v, label: VOICES[v].label }))]} onChange={onChange} />
      <button
        className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
        disabled={busy || value === "none"}
        title="Hear this voice"
        onClick={() => {
          setBusy(true);
          hearVoice(voice, sample)
            .catch((e) => toast.error("Couldn't play the voice", { description: (e as Error).message }))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}
      </button>
    </Row>
  );
}

export function StickmanSection({ obj }: { obj: StickmanObj }) {
  const [action, setAction] = useState<string>("wave");
  const [walkX, setWalkX] = useState(Math.round(obj.x + 200));
  const stick = !obj.look || obj.look.style === "stick";
  return (
    <Section title="Character">
      {stick && (
        <>
          <Row label="Line color">
            <ColorInput value={obj.color} onChange={(c) => run([{ op: "update", id: obj.id, set: { color: c } }])} />
          </Row>
          <Row label="Line width">
            <NumField value={obj.lineWidth} min={1} max={40} onCommit={(v) => run([{ op: "update", id: obj.id, set: { lineWidth: v } }])} />
          </Row>
        </>
      )}
      <Row label="Face">
        <SelectField value={obj.expression} options={EXPRESSIONS} onChange={(v) => run([{ op: "expression", id: obj.id, expression: v, at: time() }])} />
      </Row>
      <Row label="Turn">
        <button className="chip" onClick={() => run([{ op: "face", id: obj.id, direction: "left", at: time() }])}>
          Left
        </button>
        <button className="chip" onClick={() => run([{ op: "face", id: obj.id, direction: "right", at: time() }])}>
          Right
        </button>
      </Row>
      <p className="eyebrow mt-2">Pose at the playhead</p>
      <div className="flex flex-wrap gap-1">
        {POSE_NAMES.map((p) => (
          <button key={p} className="chip h-6 px-2 text-[11px]" onClick={() => run([{ op: "pose", id: obj.id, pose: p, at: time(), duration: 0.4 }])}>
            {p}
          </button>
        ))}
      </div>
      <Row label="Action">
        <SelectField value={action} options={ACTIONS} onChange={setAction} />
        <button className="chip" onClick={() => run([{ op: "action", id: obj.id, action, at: time() }])}>
          Add
        </button>
      </Row>
      <Row label="Walk to x">
        <NumField value={walkX} onCommit={setWalkX} />
        <button className="chip" onClick={() => run([{ op: "walk", id: obj.id, x: walkX, at: time() }])}>
          Walk
        </button>
      </Row>
      <HoldTools obj={obj} />
    </Section>
  );
}

export function LookSection({ obj }: { obj: StickmanObj }) {
  const look = obj.look ?? DEFAULT_LOOK;
  const set = (p: Record<string, unknown>) => run([{ op: "look", id: obj.id, set: p }]);
  const voice = obj.voice ?? (look.style === "robot" ? "robot" : "man");
  return (
    <Section title="Look and voice">
      <Row label="Style">
        <SelectField
          value={look.style}
          options={[{ value: "stick", label: "Stick figure" }, { value: "cartoon", label: "Cartoon person" }, { value: "robot", label: "Robot" }, ...(look.cutout ? [{ value: "cutout", label: "Picture puppet" }] : [])]}
          onChange={(v) => {
            if (v === "stick") patch<StickmanObj>(obj.id, (o) => o.look && (o.look = { ...o.look, style: "stick" }));
            else set({ style: v });
          }}
        />
      </Row>
      {look.style === "cartoon" && (
        <>
          <div className="grid grid-cols-2 gap-x-3">
            <Row label="Skin">
              <input type="color" className="h-7 w-9" value={look.skin} onChange={(e) => set({ skin: e.target.value })} />
            </Row>
            <Row label="Shirt">
              <input type="color" className="h-7 w-9" value={look.shirt} onChange={(e) => set({ shirt: e.target.value })} />
            </Row>
            <Row label="Pants">
              <input type="color" className="h-7 w-9" value={look.pants} onChange={(e) => set({ pants: e.target.value })} />
            </Row>
            <Row label="Shoes">
              <input type="color" className="h-7 w-9" value={look.shoes} onChange={(e) => set({ shoes: e.target.value })} />
            </Row>
          </div>
          <Row label="Hair">
            <SelectField value={look.hair} options={HAIRS} onChange={(v) => set({ hair: v })} />
            <input type="color" className="h-7 w-9" value={look.hairColor} onChange={(e) => set({ hairColor: e.target.value })} />
          </Row>
          <Row label="Hat">
            <SelectField value={look.hat} options={HATS} onChange={(v) => set({ hat: v })} />
            <input type="color" className="h-7 w-9" value={look.hatColor} onChange={(e) => set({ hatColor: e.target.value })} />
          </Row>
          <div className="grid grid-cols-3 gap-x-2">
            <Toggle label="Glasses" checked={look.glasses} onChange={(v) => set({ glasses: v })} />
            <Toggle label="Beard" checked={look.beard} onChange={(v) => set({ beard: v })} />
            <Toggle label="Dress" checked={look.dress} onChange={(v) => set({ dress: v })} />
          </div>
        </>
      )}
      {look.style === "robot" && (
        <Row label="Body">
          <ColorInput value={look.shirt} onChange={(c) => set({ shirt: c })} />
        </Row>
      )}
      <VoiceRow value={voice} sample={`Hi, I'm ${obj.name}!`} onChange={(v) => run([{ op: "update", id: obj.id, set: { voice: v } }])} />
    </Section>
  );
}

function HoldTools({ obj }: { obj: StickmanObj | CreatureObj }) {
  const scene = useStore((s) => s.scene);
  const now = useStore((s) => s.time);
  const [item, setItem] = useState("");
  const candidates = scene.objects.filter((o) => o.id !== obj.id && ["drawing", "image", "text", "svg"].includes(o.type));
  const held = scene.objects.filter((o) => activeLink(o, now)?.parent === obj.id);
  return (
    <>
      <Row label={obj.type === "creature" ? "Carry in mouth" : "Pick up"}>
        <SelectField value={item} width={130} options={[{ value: "", label: "Choose…" }, ...candidates.map((o) => ({ value: o.id, label: o.name }))]} onChange={setItem} />
        <button className="chip" disabled={!item} onClick={() => run([{ op: "hold", id: obj.id, item, at: time() }])}>
          Take
        </button>
      </Row>
      {held.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {held.map((o) => (
            <button key={o.id} className="chip" onClick={() => run([{ op: "drop", id: o.id, at: time() }])}>
              Drop {o.name}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function CreatureSection({ obj }: { obj: CreatureObj }) {
  const actions = creatureActionsFor(obj.species);
  const [action, setAction] = useState<string>(actions[0]);
  const [walkX, setWalkX] = useState(Math.round(obj.x + 200));
  return (
    <Section title={obj.species === "custom" ? "Creature" : obj.species}>
      {obj.species !== "custom" && (
        <>
          <Row label="Color">
            <ColorInput value={obj.color} onChange={(c) => run([{ op: "update", id: obj.id, set: { color: c } }])} />
          </Row>
          <Row label="Accent">
            <ColorInput value={obj.accent} onChange={(c) => run([{ op: "update", id: obj.id, set: { accent: c } }])} />
          </Row>
        </>
      )}
      <Row label="Turn">
        <button className="chip" onClick={() => run([{ op: "face", id: obj.id, direction: "left", at: time() }])}>
          Left
        </button>
        <button className="chip" onClick={() => run([{ op: "face", id: obj.id, direction: "right", at: time() }])}>
          Right
        </button>
      </Row>
      {obj.species !== "fish" && obj.species !== "custom" && (
        <div className="flex flex-wrap gap-1">
          {CREATURE_POSES.map((p) => (
            <button key={p} className="chip h-6 px-2 text-[11px]" onClick={() => run([{ op: "pose", id: obj.id, pose: p, at: time() }])}>
              {p}
            </button>
          ))}
        </div>
      )}
      <Row label="Action">
        <SelectField value={action} options={actions} onChange={setAction} />
        <button className="chip" onClick={() => run([{ op: "action", id: obj.id, action, at: time() }])}>
          Add
        </button>
      </Row>
      <Row label={obj.species === "fish" ? "Swim to x" : "Go to x"}>
        <NumField value={walkX} onCommit={setWalkX} />
        <button className="chip" onClick={() => run([{ op: "walk", id: obj.id, x: walkX, at: time() }])}>
          Go
        </button>
      </Row>
      <VoiceRow value={obj.voice ?? "boy"} sample={obj.species === "dog" ? "Woof woof!" : obj.species === "cat" ? "Meow!" : "Hello!"} onChange={(v) => run([{ op: "update", id: obj.id, set: { voice: v } }])} />
      {obj.species !== "fish" && <HoldTools obj={obj} />}
    </Section>
  );
}

export function BubbleSection({ obj }: { obj: BubbleObj }) {
  const scene = useStore((s) => s.scene);
  const assets = useStore((s) => s.assets);
  const [busy, setBusy] = useState(false);
  const voice = voiceFor(scene, obj);
  const stale = obj.audio && (obj.audio.text !== obj.text || obj.audio.voice !== voice);
  const asset = obj.audio ? assets.find((a) => a.id === obj.audio!.asset) : undefined;
  return (
    <Section title="Speech bubble">
      <TextField multiline value={obj.text} onCommit={(v) => run([{ op: "update", id: obj.id, set: { text: v } }])} />
      <Row label="Said by">
        <SelectField value={obj.target ?? ""} options={[{ value: "", label: "Nobody (a caption)" }, ...scene.objects.filter((o) => o.type === "stickman" || o.type === "creature").map((o) => ({ value: o.id, label: o.name }))]} onChange={(v) => run([{ op: "update", id: obj.id, set: { target: v || null } }])} />
      </Row>
      <Row label="Text size">
        <NumField value={obj.size} min={8} max={120} onCommit={(v) => run([{ op: "update", id: obj.id, set: { size: v } }])} />
      </Row>
      <Toggle label="Thought bubble" checked={obj.thought} onChange={(v) => run([{ op: "update", id: obj.id, set: { thought: v } }])} />
      <VoiceRow allowAuto value={obj.voice ?? ""} sample={obj.text.slice(0, 80)} onChange={(v) => run([{ op: "update", id: obj.id, set: { voice: v || voice || "man" } }])} />
      {voice && (
        <div className="flex items-center gap-2">
          <button
            className="chip"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await generateVoices(obj.id);
              setBusy(false);
              if (r.failed.length) toast.error("Couldn't record", { description: r.failed[0] });
            }}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Mic className="size-3.5" />} {obj.audio && !stale ? "Record again" : "Record voice"}
          </button>
          {asset && (
            <button className="chip" onClick={() => void playClip(asset)}>
              <Play className="size-3.5" />
            </button>
          )}
          <span className="text-xs text-muted-foreground">{obj.audio ? (stale ? "text changed" : `${obj.audio.duration.toFixed(1)}s, lip-synced`) : "no voice yet"}</span>
        </div>
      )}
    </Section>
  );
}

export function EffectSection({ obj }: { obj: EffectObj }) {
  const set = (p: Record<string, unknown>) => run([{ op: "update", id: obj.id, set: p }]);
  return (
    <Section title="Effect">
      <Row label="Kind">
        <SelectField value={obj.kind} options={EFFECT_KINDS} onChange={(v) => set({ kind: v })} />
      </Row>
      <SliderRow label="Amount" value={obj.density} min={0.1} max={4} step={0.1} onCommit={(v) => set({ density: v })} />
      <Toggle label="Its own colors" checked={obj.color === null} onChange={(v) => patch<EffectObj>(obj.id, (o) => (o.color = v ? null : "#ffffff"))} />
      {obj.color !== null && (
        <Row label="Color">
          <ColorInput value={obj.color} onChange={(c) => set({ color: c })} />
        </Row>
      )}
      <div className="grid grid-cols-2 gap-x-3">
        <Row label="Width">
          <NumField value={Math.round(obj.w)} min={10} onCommit={(v) => set({ w: v })} />
        </Row>
        <Row label="Height">
          <NumField value={Math.round(obj.h)} min={10} onCommit={(v) => set({ h: v })} />
        </Row>
      </div>
      <button className="chip w-fit" onClick={() => run([{ op: "hide", id: obj.id, at: time(), duration: 0.6 }])}>
        Stop at the playhead
      </button>
    </Section>
  );
}

async function previewSound(kind: SoundObj["kind"], duration: number, volume: number) {
  const buf = await soundBuffer(kind, Math.min(duration, 3));
  const ac = audioContext();
  if (ac.state === "suspended") await ac.resume();
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.value = volume;
  src.connect(g).connect(ac.destination);
  src.start();
}

export function SoundSection({ obj }: { obj: SoundObj }) {
  const set = (p: Partial<SoundObj>) => patch<SoundObj>(obj.id, (o) => Object.assign(o, p));
  return (
    <Section title="Sound effect">
      <Row label="Sound">
        <SelectField value={obj.kind} options={SOUND_KINDS} onChange={(v) => set({ kind: v })} />
        <button className="rounded p-1 text-muted-foreground hover:text-foreground" title="Hear it" onClick={() => void previewSound(obj.kind, obj.duration, obj.volume)}>
          <Volume2 className="size-3.5" />
        </button>
      </Row>
      <Row label="Starts">
        <NumField value={obj.at} step={0.1} min={0} suffix="s" onCommit={(v) => set({ at: v })} />
      </Row>
      {(obj.kind === "rain" || obj.kind === "wind") && (
        <Row label="Lasts">
          <NumField value={obj.duration} step={0.5} min={0.2} suffix="s" onCommit={(v) => set({ duration: v })} />
        </Row>
      )}
      <SliderRow label="Volume" value={obj.volume} min={0} max={2} step={0.05} onCommit={(v) => set({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
    </Section>
  );
}

export function LightSection({ obj }: { obj: LightObj }) {
  const set = (p: Partial<LightObj>) => patch<LightObj>(obj.id, (o) => Object.assign(o, p));
  return (
    <Section title="Light">
      <Row label="Kind">
        <SelectField value={obj.kind} options={[{ value: "point", label: "Bulb" }, { value: "spot", label: "Spot (down)" }]} onChange={(v) => set({ kind: v })} />
      </Row>
      <Row label="Color">
        <ColorInput value={obj.color} onChange={(c) => set({ color: c })} />
      </Row>
      <SliderRow label="Brightness" value={obj.intensity} min={0} max={6} step={0.1} onCommit={(v) => set({ intensity: v })} />
      <SliderRow label="Reach" value={obj.distance} min={100} max={4000} step={50} onCommit={(v) => set({ distance: v })} />
      <Note>Lights only show in the 3D view.</Note>
    </Section>
  );
}

export function DrawingSection({ obj }: { obj: DrawingObj }) {
  const json = JSON.stringify(obj.parts, null, 1);
  const [err, setErr] = useState<string | null>(null);
  const firstFill = obj.parts.find((p) => p.fill && p.fill !== "none")?.fill;
  return (
    <Section title={`Drawing · ${obj.parts.length} shapes`} defaultOpen={obj.parts.length <= 3}>
      {firstFill && obj.parts.length <= 3 && (
        <Row label="Fill">
          <ColorInput value={firstFill} onChange={(c) => patch<DrawingObj>(obj.id, (o) => o.parts.forEach((p) => p.fill && p.fill !== "none" && (p.fill = c)))} />
        </Row>
      )}
      <textarea
        className="h-40 w-full resize-y rounded-md border border-input bg-panel-sunken p-2 font-mono text-[11px] text-foreground outline-none focus:border-ring"
        defaultValue={json}
        key={json}
        spellCheck={false}
        onBlur={(e) => {
          try {
            const parsed = z.array(partSchema).min(1).parse(JSON.parse(e.target.value));
            setErr(null);
            if (JSON.stringify(parsed, null, 1) !== json) run([{ op: "update", id: obj.id, set: { parts: parsed } }]);
          } catch (x) {
            setErr(x instanceof SyntaxError ? "Not valid JSON" : "Some shapes are invalid");
          }
        }}
      />
      {err ? <p className="text-xs text-destructive">{err}</p> : <Note>The shapes in the drawing's own coordinates. Edit and click away to apply, or ask the AI.</Note>}
    </Section>
  );
}
