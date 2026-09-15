import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, Copy, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { EXPRESSIONS, FONTS, LIGHTING_PRESETS, cloneScene, findObj, uniqueId, type SceneObj } from "../engine/scene";
import { POSE_NAMES } from "../engine/rig";
import { ACTIONS } from "../engine/motion";
import { partSchema } from "../engine/ops";
import { setAt, valueAt } from "../engine/tracks";
import { z } from "zod";
import { BubbleVoice, CreaturePanel, EffectPanel, LightPanel, LookPanel, MotionTools, SoundPanel } from "./panels";

export function Inspector() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const time = useStore((s) => s.time);
  const obj = selectedId ? findObj(scene, selectedId) : undefined;

  return <div className="inspector">{obj ? <ObjectPanel obj={obj} time={time} /> : <ScenePanel />}</div>;
}

/** An input that commits on Enter or blur, so typing doesn't flood undo history. */
function Field({ label, value, onCommit, type = "number", step }: { label: string; value: string | number; onCommit: (v: string) => void; type?: string; step?: number }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => draft !== String(value) && onCommit(draft);
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} step={step} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
    </label>
  );
}

function ScenePanel() {
  const scene = useStore((s) => s.scene);
  const assets = useStore((s) => s.assets);
  const run = (op: Record<string, unknown>) => useStore.getState().run([{ op: "scene", ...op }]);
  const size = `${scene.width}x${scene.height}`;
  return (
    <>
      <section>
        <h3>Scene</h3>
        <label className="field">
          <span>Size</span>
          <select
            value={size}
            onChange={(e) => {
              const [w, h] = e.target.value.split("x").map(Number);
              run({ width: w, height: h });
            }}
          >
            {!["1280x720", "1920x1080", "720x1280", "1080x1920", "1080x1080"].includes(size) && <option value={size}>{size}</option>}
            <option value="1280x720">1280×720 (16:9)</option>
            <option value="1920x1080">1920×1080 (16:9 HD)</option>
            <option value="720x1280">720×1280 (9:16 short)</option>
            <option value="1080x1920">1080×1920 (9:16 HD)</option>
            <option value="1080x1080">1080×1080 (square)</option>
          </select>
        </label>
        <label className="field">
          <span>Background</span>
          <input type="color" value={toHex(scene.background)} onChange={(e) => run({ background: e.target.value })} />
        </label>
        <label className="field">
          <span>Picture</span>
          <select value={scene.backgroundImage ?? ""} onChange={(e) => run({ backgroundImage: e.target.value || null })}>
            <option value="">None</option>
            {assets.filter((a) => a.kind !== "audio").map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {scene.mode === "3d" && (
          <>
            <label className="field">
              <span>Lighting</span>
              <select value={scene.lighting ?? "day"} onChange={(e) => run({ lighting: e.target.value })}>
                {LIGHTING_PRESETS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>3D look</span>
              <select value={scene.look3d ?? "soft"} onChange={(e) => run({ look3d: e.target.value })}>
                <option value="soft">Soft (render)</option>
                <option value="toon">Toon (outlines)</option>
              </select>
            </label>
            <label className="field">
              <span>Floor</span>
              <input type="color" value={toHex(scene.floor ?? "#b9cf94")} onChange={(e) => run({ floor: e.target.value })} />
            </label>
            <label className="field">
              <span>Camera</span>
              <button title="Plan cinematic shots for the whole film from what happens in it" onClick={() => useStore.getState().run([{ op: "direct" }])}>
                Auto camera
              </button>
            </label>
          </>
        )}
        <Field label="Length (s)" value={scene.duration} step={0.5} onCommit={(v) => Number(v) >= 0.5 && run({ duration: Number(v) })} />
        <label className="field">
          <span>FPS</span>
          <select value={scene.fps} onChange={(e) => run({ fps: Number(e.target.value) })}>
            {[24, 25, 30, 60].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </section>
      <p className="note">
        Click something on the canvas to edit it. The AI and you edit the same scene: everything it makes is ordinary objects and keyframes you can change, and Ctrl+Z undoes either.
      </p>
    </>
  );
}

function ObjectPanel({ obj, time }: { obj: SceneObj; time: number }) {
  const run = (ops: Record<string, unknown>[]) => useStore.getState().run(ops);
  const t = Math.round(time * 100) / 100;
  const mode3d = useStore((s) => s.scene.mode === "3d");

  const setProp = (prop: string, v: number) => {
    if (!Number.isFinite(v)) return;
    const s = useStore.getState();
    const next = cloneScene(s.scene);
    const o = findObj(next, obj.id);
    if (!o) return;
    setAt(o, prop, s.time, v);
    s.commit(next);
  };

  const duplicate = () => {
    const s = useStore.getState();
    const next = cloneScene(s.scene);
    const copy = structuredClone(obj);
    copy.id = uniqueId(next, obj.id);
    copy.name = `${obj.name} copy`;
    copy.x += 40;
    for (const k of copy.tracks.x ?? []) k.v += 40;
    next.objects.push(copy);
    s.commit(next);
    s.select(copy.id);
  };

  const keyed = (prop: string) => (obj.tracks[prop]?.length ? <span className="keyed">◆</span> : null);

  return (
    <>
      <section>
        <h3>
          {labelFor(obj.type)}
          <span style={{ display: "flex", gap: 2 }}>
            <button className="ghost" title="Duplicate" onClick={duplicate}>
              <Copy size={14} />
            </button>
            <button className="ghost" title="Bring to front" onClick={() => run([{ op: "order", id: obj.id, to: "front" }])}>
              <ArrowUpToLine size={14} />
            </button>
            <button className="ghost" title="Send to back" onClick={() => run([{ op: "order", id: obj.id, to: "back" }])}>
              <ArrowDownToLine size={14} />
            </button>
            <button className="ghost danger" title="Delete" onClick={() => run([{ op: "remove", id: obj.id }])}>
              <Trash2 size={14} />
            </button>
          </span>
        </h3>
        <Field label="Name" type="text" value={obj.name} onCommit={(v) => run([{ op: "update", id: obj.id, set: { name: v.slice(0, 60) } }])} />
        <label className="field">
          <span>Id</span>
          <code style={{ color: "var(--muted)" }}>{obj.id}</code>
        </label>
        {obj.type !== "bubble" && obj.type !== "sound" && (
          <>
            <div className="field-row">
              <Field label={`X`} value={Math.round(valueAt(obj, "x", time))} onCommit={(v) => setProp("x", Number(v))} />
              <Field label={`Y`} value={Math.round(valueAt(obj, "y", time))} onCommit={(v) => setProp("y", Number(v))} />
            </div>
            {mode3d && (
              <div className="field-row">
                <Field label="Depth" value={Math.round(valueAt(obj, "z", time))} onCommit={(v) => setProp("z", Number(v))} />
                <Field label="Turn°" value={Math.round(valueAt(obj, "yaw", time))} onCommit={(v) => setProp("yaw", Number(v))} />
              </div>
            )}
            <div className="field-row">
              <Field label="Scale" step={0.05} value={round(valueAt(obj, "scale", time))} onCommit={(v) => setProp("scale", Number(v))} />
              <Field label="Rotate°" value={Math.round(valueAt(obj, "rotation", time))} onCommit={(v) => setProp("rotation", Number(v))} />
            </div>
          </>
        )}
        <Field label="Opacity" step={0.1} value={round(valueAt(obj, "opacity", time))} onCommit={(v) => setProp("opacity", Math.max(0, Math.min(1, Number(v))))} />
        <p className="note">
          {keyed("x") || keyed("y") ? "◆ Animated: changes set a keyframe at the playhead." : "Not animated: changes apply to the whole video."}
        </p>
        <div className="chips" style={{ marginTop: 6 }}>
          <button onClick={() => run([{ op: "show", id: obj.id, at: t, duration: 0.4 }])}>Fade in here</button>
          <button onClick={() => run([{ op: "hide", id: obj.id, at: t, duration: 0.4 }])}>Fade out here</button>
          {Object.keys(obj.tracks).length > 0 && (
            <button className="danger" onClick={() => run([{ op: "clearMotion", id: obj.id }])}>
              Clear animation
            </button>
          )}
        </div>
      </section>

      {obj.type === "stickman" && <StickmanPanel id={obj.id} color={obj.color} lineWidth={obj.lineWidth} t={t} expression={obj.expression} />}
      {obj.type === "stickman" && <LookPanel obj={obj} />}
      {obj.type === "creature" && <CreaturePanel obj={obj} />}
      {obj.type === "effect" && <EffectPanel obj={obj} />}
      {obj.type === "sound" && <SoundPanel obj={obj} />}
      {obj.type === "light" && <LightPanel obj={obj} />}

      {obj.type === "text" && (
        <section>
          <h3>Text</h3>
          <TextArea value={obj.text} onCommit={(v) => run([{ op: "update", id: obj.id, set: { text: v } }])} />
          <Field label="Size" value={obj.size} onCommit={(v) => run([{ op: "update", id: obj.id, set: { size: Number(v) } }])} />
          <label className="field">
            <span>Color</span>
            <input type="color" value={toHex(obj.color)} onChange={(e) => run([{ op: "update", id: obj.id, set: { color: e.target.value } }])} />
          </label>
          <label className="field">
            <span>Font</span>
            <select value={obj.font} onChange={(e) => run([{ op: "update", id: obj.id, set: { font: e.target.value } }])}>
              {FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Bold</span>
            <input type="checkbox" checked={obj.bold} onChange={(e) => run([{ op: "update", id: obj.id, set: { bold: e.target.checked } }])} />
          </label>
          <button onClick={() => typeOnHere(obj.id, t)}>Type it out from here</button>
        </section>
      )}

      {obj.type === "bubble" && (
        <section>
          <h3>Speech bubble</h3>
          <TextArea value={obj.text} onCommit={(v) => run([{ op: "update", id: obj.id, set: { text: v } }])} />
          <label className="field">
            <span>From</span>
            <select value={obj.target ?? ""} onChange={(e) => run([{ op: "update", id: obj.id, set: { target: e.target.value || null } }])}>
              <option value="">(caption)</option>
              {useStore
                .getState()
                .scene.objects.filter((o) => o.type === "stickman" || o.type === "creature")
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </label>
          <Field label="Text size" value={obj.size} onCommit={(v) => run([{ op: "update", id: obj.id, set: { size: Number(v) } }])} />
          <BubbleVoice obj={obj} />
        </section>
      )}

      {obj.type === "drawing" && <PartsEditor id={obj.id} parts={obj.parts} />}

      <MotionTools obj={obj} />

      {obj.type === "image" && (
        <section>
          <h3>Picture</h3>
          <div className="field-row">
            <Field label="W" value={Math.round(obj.w)} onCommit={(v) => run([{ op: "update", id: obj.id, set: { w: Number(v) } }])} />
            <Field label="H" value={Math.round(obj.h)} onCommit={(v) => run([{ op: "update", id: obj.id, set: { h: Number(v) } }])} />
          </div>
        </section>
      )}
    </>
  );
}

function StickmanPanel({ id, color, lineWidth, t, expression }: { id: string; color: string; lineWidth: number; t: number; expression: string }) {
  const run = (ops: Record<string, unknown>[]) => useStore.getState().run(ops);
  const [action, setAction] = useState<string>("wave");
  const [walkX, setWalkX] = useState("");
  return (
    <section>
      <h3>Stick man</h3>
      <label className="field">
        <span>Color</span>
        <input type="color" value={toHex(color)} onChange={(e) => run([{ op: "update", id, set: { color: e.target.value } }])} />
      </label>
      <Field label="Line width" value={lineWidth} onCommit={(v) => run([{ op: "update", id, set: { lineWidth: Number(v) } }])} />
      <label className="field">
        <span>Face at {t}s</span>
        <select value={expression} onChange={(e) => run([{ op: "expression", id, expression: e.target.value, at: t }])}>
          {EXPRESSIONS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <div className="chips" style={{ margin: "6px 0 10px" }}>
        <button onClick={() => run([{ op: "face", id, direction: "left", at: t }])}>Face left</button>
        <button onClick={() => run([{ op: "face", id, direction: "right", at: t }])}>Face right</button>
      </div>

      <p className="note" style={{ margin: "0 0 6px" }}>Pose at {t}s:</p>
      <div className="chips">
        {POSE_NAMES.map((p) => (
          <button key={p} onClick={() => run([{ op: "pose", id, pose: p, at: t, duration: 0.4 }])}>
            {p}
          </button>
        ))}
      </div>

      <p className="note" style={{ margin: "12px 0 6px" }}>Action at {t}s:</p>
      <div style={{ display: "flex", gap: 6 }}>
        <select value={action} onChange={(e) => setAction(e.target.value)} style={{ flex: 1 }}>
          {ACTIONS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <button onClick={() => run([{ op: "action", id, action, at: t }])}>Add</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input placeholder="walk to x…" value={walkX} onChange={(e) => setWalkX(e.target.value)} style={{ flex: 1 }} />
        <button disabled={!Number.isFinite(parseFloat(walkX))} onClick={() => run([{ op: "walk", id, x: parseFloat(walkX), at: t }])}>
          Walk
        </button>
      </div>
    </section>
  );
}

function TextArea({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <textarea style={{ width: "100%", height: 70, marginBottom: 6, resize: "vertical" }} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== value && onCommit(draft)} />;
}

function PartsEditor({ id, parts }: { id: string; parts: unknown[] }) {
  const json = JSON.stringify(parts, null, 1);
  const [draft, setDraft] = useState(json);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setDraft(json), [json]);
  const apply = () => {
    try {
      const parsed = z.array(partSchema).min(1).parse(JSON.parse(draft));
      setErr(null);
      if (JSON.stringify(parsed, null, 1) !== json) useStore.getState().run([{ op: "update", id, set: { parts: parsed } }]);
    } catch (e) {
      setErr(e instanceof SyntaxError ? "Not valid JSON" : "Some shapes are invalid");
    }
  };
  return (
    <section>
      <h3>Drawing · {parts.length} shapes</h3>
      <textarea className="code" value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)} onBlur={apply} />
      {err ? <p className="note" style={{ color: "var(--danger)" }}>{err}</p> : <p className="note">Shapes in the drawing's own coordinates. Edit and click away to apply, or just ask the AI.</p>}
      <button style={{ marginTop: 6 }} onClick={() => drawOnHere(id)}>
        Draw it on from here
      </button>
    </section>
  );
}

function drawOnHere(id: string) {
  revealFrom(id, 1.2);
}
function typeOnHere(id: string, _t: number) {
  const obj = findObj(useStore.getState().scene, id);
  revealFrom(id, obj && obj.type === "text" ? Math.max(0.6, obj.text.length * 0.08) : 1);
}
function revealFrom(id: string, dur: number) {
  const s = useStore.getState();
  const t = s.time;
  const next = cloneScene(s.scene);
  const o = findObj(next, id);
  if (!o) return;
  o.tracks.reveal = [
    { t: 0, v: 0 },
    { t, v: 0 },
    { t: t + dur, v: 1 },
  ];
  if (t === 0) o.tracks.reveal.shift();
  s.commit(next);
}

function labelFor(type: string) {
  return { stickman: "Character", drawing: "Drawing", text: "Text", bubble: "Bubble", image: "Picture", creature: "Animal", effect: "Effect" }[type] ?? type;
}

const round = (v: number) => Math.round(v * 100) / 100;

function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${[...color.slice(1)].map((c) => c + c).join("")}`;
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  return /^#[0-9a-f]{6}$/i.test(ctx.fillStyle) ? ctx.fillStyle : "#000000";
}
