import { useState } from "react";
import { Mic, Play, Volume2 } from "lucide-react";
import { useStore } from "../store";
import {
  DEFAULT_LOOK,
  EFFECT_KINDS,
  HAIRS,
  HATS,
  VOICE_IDS,
  type BubbleObj,
  type CreatureObj,
  type EffectObj,
  type LightObj,
  type SceneObj,
  type StickmanObj,
  type VoiceId,
  type SoundObj,
  type SoundKind,
  SOUND_KINDS,
} from "../engine/scene";
import { CREATURE_POSES, creatureActionsFor } from "../engine/creatures";
import { activeLink } from "../engine/render";
import { VOICES } from "../engine/voices";
import { audioContext, playClip } from "../audio";
import { soundBuffer } from "../sfx";
import { generateVoices, voiceFor } from "../voice";

const run = (ops: Record<string, unknown>[]) => useStore.getState().run(ops);

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function VoiceSelect({ value, onChange, allowAuto, allowNone }: { value: string; onChange: (v: string) => void; allowAuto?: boolean; allowNone?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowAuto && <option value="">Speaker's voice</option>}
      {allowNone && <option value="none">Silent</option>}
      {VOICE_IDS.map((v) => (
        <option key={v} value={v}>
          {VOICES[v].label}
        </option>
      ))}
    </select>
  );
}

async function hearVoice(voice: VoiceId, text: string) {
  const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
  const data = (await res.json()) as { audio?: string; error?: string };
  if (!data.audio) throw new Error(data.error ?? "no audio");
  await playClip({ id: `sample_${voice}_${text}`, src: data.audio });
}

function HearButton({ voice, text }: { voice: VoiceId; text: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      title="Hear this voice"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        hearVoice(voice, text)
          .catch((e) => alert(`Couldn't play the voice: ${(e as Error).message}`))
          .finally(() => setBusy(false));
      }}
    >
      <Volume2 size={14} />
    </button>
  );
}

// ── Character look ───────────────────────────────────────────────────

export function LookPanel({ obj }: { obj: StickmanObj }) {
  const look = obj.look ?? DEFAULT_LOOK;
  const set = (patch: Record<string, unknown>) => run([{ op: "look", id: obj.id, set: patch }]);
  const voice = obj.voice ?? (look.style === "robot" ? "robot" : "man");
  return (
    <section>
      <h3>Look & voice</h3>
      <label className="field">
        <span>Style</span>
        <select
          value={look.style}
          onChange={(e) => {
            if (e.target.value === "stick") {
              const s = useStore.getState();
              const next = structuredClone(s.scene);
              const o = next.objects.find((x) => x.id === obj.id);
              if (o?.type === "stickman" && o.look) o.look = { ...o.look, style: "stick" };
              s.commit(next);
            } else set({ style: e.target.value });
          }}
        >
          <option value="stick">Stick figure</option>
          <option value="cartoon">Cartoon person</option>
          <option value="robot">Robot</option>
          {look.cutout && <option value="cutout">Picture puppet</option>}
        </select>
      </label>
      {look.style === "cartoon" && (
        <>
          <div className="field-row">
            <ColorField label="Skin" value={look.skin} onChange={(v) => set({ skin: v })} />
            <ColorField label="Shirt" value={look.shirt} onChange={(v) => set({ shirt: v })} />
          </div>
          <div className="field-row">
            <ColorField label="Pants" value={look.pants} onChange={(v) => set({ pants: v })} />
            <ColorField label="Shoes" value={look.shoes} onChange={(v) => set({ shoes: v })} />
          </div>
          <label className="field">
            <span>Hair</span>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={look.hair} onChange={(e) => set({ hair: e.target.value })} style={{ flex: 1 }}>
                {HAIRS.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
              <input type="color" value={look.hairColor} onChange={(e) => set({ hairColor: e.target.value })} />
            </div>
          </label>
          <label className="field">
            <span>Hat</span>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={look.hat} onChange={(e) => set({ hat: e.target.value })} style={{ flex: 1 }}>
                {HATS.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
              <input type="color" value={look.hatColor} onChange={(e) => set({ hatColor: e.target.value })} />
            </div>
          </label>
          <div className="chips">
            {(["glasses", "beard", "dress"] as const).map((k) => (
              <label key={k} style={{ display: "flex", gap: 4, alignItems: "center", marginRight: 8 }}>
                <input type="checkbox" checked={look[k]} onChange={(e) => set({ [k]: e.target.checked })} /> {k}
              </label>
            ))}
          </div>
        </>
      )}
      {look.style === "robot" && <ColorField label="Body" value={look.shirt} onChange={(v) => set({ shirt: v })} />}
      <label className="field" style={{ marginTop: 8 }}>
        <span>Voice</span>
        <div style={{ display: "flex", gap: 6 }}>
          <VoiceSelect value={voice} onChange={(v) => run([{ op: "update", id: obj.id, set: { voice: v } }])} />
          <HearButton voice={voice} text={`Hi, I'm ${obj.name}!`} />
        </div>
      </label>
      <HoldTools obj={obj} />
    </section>
  );
}

function HoldTools({ obj }: { obj: StickmanObj | CreatureObj }) {
  const scene = useStore((s) => s.scene);
  const time = useStore((s) => s.time);
  const [item, setItem] = useState("");
  const t = Math.round(time * 100) / 100;
  const candidates = scene.objects.filter((o) => o.id !== obj.id && ["drawing", "image", "text"].includes(o.type));
  const held = scene.objects.filter((o) => activeLink(o, time)?.parent === obj.id);
  return (
    <>
      <p className="note" style={{ margin: "10px 0 6px" }}>
        {obj.type === "creature" ? "Carry in mouth" : "Pick up"} at {t}s:
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        <select value={item} onChange={(e) => setItem(e.target.value)} style={{ flex: 1 }}>
          <option value="">Choose an object…</option>
          {candidates.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button disabled={!item} onClick={() => run([{ op: "hold", id: obj.id, item, at: t }])}>
          Pick up
        </button>
      </div>
      {held.length > 0 && (
        <div className="chips" style={{ marginTop: 6 }}>
          {held.map((o) => (
            <button key={o.id} onClick={() => run([{ op: "drop", id: o.id, at: t }])}>
              Drop {o.name}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── Animals ──────────────────────────────────────────────────────────

export function CreaturePanel({ obj }: { obj: CreatureObj }) {
  const time = useStore((s) => s.time);
  const t = Math.round(time * 100) / 100;
  const actions = creatureActionsFor(obj.species);
  const [action, setAction] = useState<string>(actions[0]);
  const [walkX, setWalkX] = useState("");
  const voice = obj.voice ?? "boy";
  return (
    <section>
      <h3>{obj.species === "custom" ? "Custom creature" : obj.species}</h3>
      {obj.species !== "custom" && (
        <div className="field-row">
          <ColorField label="Color" value={obj.color} onChange={(v) => run([{ op: "update", id: obj.id, set: { color: v } }])} />
          <ColorField label="Accent" value={obj.accent} onChange={(v) => run([{ op: "update", id: obj.id, set: { accent: v } }])} />
        </div>
      )}
      <div className="chips" style={{ margin: "6px 0 10px" }}>
        <button onClick={() => run([{ op: "face", id: obj.id, direction: "left", at: t }])}>Face left</button>
        <button onClick={() => run([{ op: "face", id: obj.id, direction: "right", at: t }])}>Face right</button>
      </div>
      {obj.species !== "fish" && obj.species !== "custom" && (
        <>
          <p className="note" style={{ margin: "0 0 6px" }}>Pose at {t}s:</p>
          <div className="chips">
            {CREATURE_POSES.map((p) => (
              <button key={p} onClick={() => run([{ op: "pose", id: obj.id, pose: p, at: t }])}>
                {p}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="note" style={{ margin: "12px 0 6px" }}>Action at {t}s:</p>
      <div style={{ display: "flex", gap: 6 }}>
        <select value={action} onChange={(e) => setAction(e.target.value)} style={{ flex: 1 }}>
          {actions.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <button onClick={() => run([{ op: "action", id: obj.id, action, at: t }])}>Add</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input placeholder={obj.species === "fish" ? "swim to x…" : obj.species === "bird" ? "hop to x…" : "walk to x…"} value={walkX} onChange={(e) => setWalkX(e.target.value)} style={{ flex: 1 }} />
        <button disabled={!Number.isFinite(parseFloat(walkX))} onClick={() => run([{ op: "walk", id: obj.id, x: parseFloat(walkX), at: t }])}>
          Go
        </button>
      </div>
      <label className="field" style={{ marginTop: 8 }}>
        <span>Voice</span>
        <div style={{ display: "flex", gap: 6 }}>
          <VoiceSelect value={voice} onChange={(v) => run([{ op: "update", id: obj.id, set: { voice: v } }])} />
          <HearButton voice={voice} text={obj.species === "dog" ? "Woof woof!" : obj.species === "cat" ? "Meow!" : "Hello!"} />
        </div>
      </label>
      {obj.species !== "fish" && <HoldTools obj={obj} />}
    </section>
  );
}

// ── Effects ──────────────────────────────────────────────────────────

export function EffectPanel({ obj }: { obj: EffectObj }) {
  const time = useStore((s) => s.time);
  const t = Math.round(time * 100) / 100;
  const set = (patch: Record<string, unknown>) => run([{ op: "update", id: obj.id, set: patch }]);
  return (
    <section>
      <h3>Effect</h3>
      <label className="field">
        <span>Kind</span>
        <select value={obj.kind} onChange={(e) => set({ kind: e.target.value })}>
          {EFFECT_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Amount</span>
        <input type="range" min={0.1} max={4} step={0.1} value={obj.density} onChange={(e) => set({ density: Number(e.target.value) })} />
      </label>
      <label className="field">
        <span>Color</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={obj.color === null} onChange={(e) => set({ color: e.target.checked ? null : "#ffffff" })} /> auto
          {obj.color !== null && <input type="color" value={obj.color} onChange={(e) => set({ color: e.target.value })} />}
        </div>
      </label>
      <div className="field-row">
        <label className="field">
          <span>W</span>
          <input type="number" value={Math.round(obj.w)} onChange={(e) => Number(e.target.value) > 0 && set({ w: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>H</span>
          <input type="number" value={Math.round(obj.h)} onChange={(e) => Number(e.target.value) > 0 && set({ h: Number(e.target.value) })} />
        </label>
      </div>
      <p className="note">Smoke and fire rise from the bottom middle of the area. Use "Fade in/out here" above to start or stop it.</p>
      <button onClick={() => run([{ op: "hide", id: obj.id, at: t, duration: 0.6 }])}>Stop at {t}s</button>
    </section>
  );
}

// ── Speech voice ─────────────────────────────────────────────────────

export function BubbleVoice({ obj }: { obj: BubbleObj }) {
  const scene = useStore((s) => s.scene);
  const assets = useStore((s) => s.assets);
  const [busy, setBusy] = useState(false);
  const voice = voiceFor(scene, obj);
  const stale = obj.audio && (obj.audio.text !== obj.text || obj.audio.voice !== voice);
  const asset = obj.audio ? assets.find((a) => a.id === obj.audio!.asset) : undefined;
  return (
    <>
      <label className="field" style={{ marginTop: 6 }}>
        <span>Voice</span>
        <VoiceSelect value={obj.voice ?? ""} allowAuto allowNone onChange={(v) => run([{ op: "update", id: obj.id, set: { voice: v || voice || "man" } }])} />
      </label>
      {voice && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await generateVoices(obj.id);
              setBusy(false);
              if (r.failed.length) alert(r.failed[0]);
            }}
          >
            <Mic size={14} /> {obj.audio && !stale ? "Re-record" : "Record voice"}
          </button>
          {asset && (
            <button title="Play this line" onClick={() => playClip(asset)}>
              <Play size={14} />
            </button>
          )}
          <span className="note" style={{ margin: 0 }}>
            {busy ? "Recording…" : obj.audio ? (stale ? "Text changed, re-record" : `${obj.audio.duration.toFixed(1)}s, lip-synced`) : "No voice yet"}
          </span>
        </div>
      )}
    </>
  );
}

// ── Sound effects ────────────────────────────────────────────────────

export function SoundPanel({ obj }: { obj: SoundObj }) {
  const setField = (patch: Partial<SoundObj>) => {
    const s = useStore.getState();
    const next = structuredClone(s.scene);
    const o = next.objects.find((x) => x.id === obj.id);
    if (o?.type !== "sound") return;
    Object.assign(o, patch);
    s.commit(next);
  };
  return (
    <section>
      <h3>Sound effect</h3>
      <label className="field">
        <span>Sound</span>
        <div style={{ display: "flex", gap: 6 }}>
          <select value={obj.kind} onChange={(e) => setField({ kind: e.target.value as SoundKind })} style={{ flex: 1 }}>
            {SOUND_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <button title="Hear it" onClick={() => previewSound(obj.kind, obj.duration, obj.volume)}>
            <Volume2 size={14} />
          </button>
        </div>
      </label>
      <label className="field">
        <span>Starts at</span>
        <input type="number" step={0.1} value={obj.at} onChange={(e) => Number(e.target.value) >= 0 && setField({ at: Number(e.target.value) })} />
      </label>
      {(obj.kind === "rain" || obj.kind === "wind") && (
        <label className="field">
          <span>Lasts (s)</span>
          <input type="number" step={0.5} value={obj.duration} onChange={(e) => Number(e.target.value) > 0 && setField({ duration: Number(e.target.value) })} />
        </label>
      )}
      <label className="field">
        <span>Volume</span>
        <input type="range" min={0} max={2} step={0.05} value={obj.volume} onChange={(e) => setField({ volume: Number(e.target.value) })} />
      </label>
      <p className="note">Drag its diamond on the timeline to move it.</p>
    </section>
  );
}

async function previewSound(kind: SoundKind, duration: number, volume: number) {
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

// ── Motion tools for any object ──────────────────────────────────────

export function MotionTools({ obj }: { obj: SceneObj }) {
  const scene = useStore((s) => s.scene);
  const time = useStore((s) => s.time);
  const [parent, setParent] = useState("");
  const t = Math.round(time * 100) / 100;
  const link = activeLink(obj, time);
  if (obj.type === "bubble" || obj.type === "sound") return null;
  return (
    <section>
      <h3>Motion at {t}s</h3>
      <div className="chips">
        <button onClick={() => run([{ op: "bounce", id: obj.id, at: t }])}>Bounce</button>
        <button onClick={() => run([{ op: "shake", id: obj.id, at: t }])}>Shake</button>
        <button onClick={() => run([{ op: "shake", at: t }])}>Shake camera</button>
      </div>
      {link ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
          <span className="note" style={{ margin: 0, flex: 1 }}>
            Attached to {scene.objects.find((o) => o.id === link.parent)?.name ?? link.parent}
          </span>
          <button onClick={() => run([{ op: "detach", id: obj.id, at: t }])}>Detach</button>
          <button onClick={() => run([{ op: "drop", id: obj.id, at: t }])}>Drop</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <select value={parent} onChange={(e) => setParent(e.target.value)} style={{ flex: 1 }}>
            <option value="">Attach to…</option>
            {scene.objects
              .filter((o) => o.id !== obj.id && o.type !== "bubble" && o.type !== "effect")
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
          <button disabled={!parent} onClick={() => run([{ op: "attach", id: obj.id, to: parent, at: t }])}>
            Attach
          </button>
        </div>
      )}
    </section>
  );
}

export function LightPanel({ obj }: { obj: LightObj }) {
  const setField = (patch: Partial<LightObj>) => {
    const s = useStore.getState();
    const next = structuredClone(s.scene);
    const o = next.objects.find((x) => x.id === obj.id);
    if (o?.type !== "light") return;
    Object.assign(o, patch);
    s.commit(next);
  };
  return (
    <section>
      <h3>Light</h3>
      <label className="field">
        <span>Kind</span>
        <select value={obj.kind} onChange={(e) => setField({ kind: e.target.value as LightObj["kind"] })}>
          <option value="point">Point (bulb)</option>
          <option value="spot">Spot (points down)</option>
        </select>
      </label>
      <label className="field">
        <span>Color</span>
        <input type="color" value={obj.color} onChange={(e) => setField({ color: e.target.value })} />
      </label>
      <label className="field">
        <span>Brightness</span>
        <input type="range" min={0} max={6} step={0.1} value={obj.intensity} onChange={(e) => setField({ intensity: Number(e.target.value) })} />
      </label>
      <label className="field">
        <span>Reach</span>
        <input type="range" min={100} max={4000} step={50} value={obj.distance} onChange={(e) => setField({ distance: Number(e.target.value) })} />
      </label>
      <p className="note">Lights only show in the 3D view. Fade them with Opacity keyframes.</p>
    </section>
  );
}
