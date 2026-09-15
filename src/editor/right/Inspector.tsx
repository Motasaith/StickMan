import { useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, Copy, Diamond, Lock, Trash2, Unlock } from "lucide-react";
import { useStore } from "@/store";
import { findObj, LOOPS, type SceneObj } from "@/engine/scene";
import { cloneScene } from "@/engine/scene";
import { setAt, valueAt } from "@/engine/tracks";
import { activeLink } from "@/engine/render";
import { ENTER_KINDS, EXIT_KINDS } from "@/engine/entrances";
import { Row, NumField, Section, SelectField, TextField, run, Note } from "../fields";
import { duplicateObject } from "../actions";
import { ProjectPanel } from "./ProjectPanel";
import { SlidePanel } from "./SlidePanel";
import { TextSection } from "./sections/text";
import { MediaLookSection, VideoClipSection } from "./sections/media";
import { AudioSection } from "./sections/audio";
import { SvgSection } from "./sections/svg";
import { CaptionSection } from "./sections/caption";
import { RegionSection } from "./sections/region";
import { ChartSection } from "./sections/chart";
import { BubbleSection, CreatureSection, DrawingSection, EffectSection, LightSection, LookSection, SoundSection, StickmanSection } from "./sections/characters";

const LABEL: Record<string, string> = {
  stickman: "Character",
  creature: "Animal",
  drawing: "Drawing",
  text: "Text",
  bubble: "Speech bubble",
  image: "Picture",
  svg: "Sticker / illustration",
  video: "Video clip",
  audio: "Sound clip",
  sound: "Sound effect",
  effect: "Effect",
  caption: "Captions",
  region: "Area effect",
  chart: "Chart",
  light: "Light",
};

export function Inspector() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const time = useStore((s) => s.time);
  if (selectedId?.startsWith("slide:")) {
    const slide = scene.slides?.find((sl) => sl.id === selectedId.slice(6));
    if (slide) return <Scroll><SlidePanel slide={slide} /></Scroll>;
  }
  const obj = selectedId ? findObj(scene, selectedId) : undefined;
  return <Scroll>{obj ? <ObjectPanel key={obj.id} obj={obj} time={time} /> : <ProjectPanel />}</Scroll>;
}

function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto pb-10">{children}</div>;
}

function ObjectPanel({ obj, time }: { obj: SceneObj; time: number }) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{LABEL[obj.type] ?? obj.type}</p>
          <div className="mt-1">
            <TextField value={obj.name} onCommit={(v) => run([{ op: "update", id: obj.id, set: { name: v.slice(0, 60) || obj.name } }])} />
          </div>
        </div>
        <div className="flex gap-0.5 self-end">
          <IconBtn title="Duplicate (Ctrl+D)" onClick={() => duplicateObject(obj.id)}>
            <Copy className="size-3.5" />
          </IconBtn>
          <IconBtn title="Bring to front" onClick={() => run([{ op: "order", id: obj.id, to: "front" }])}>
            <ArrowUpToLine className="size-3.5" />
          </IconBtn>
          <IconBtn title="Send to back" onClick={() => run([{ op: "order", id: obj.id, to: "back" }])}>
            <ArrowDownToLine className="size-3.5" />
          </IconBtn>
          <IconBtn title={obj.locked ? "Unlock" : "Lock (can't be dragged)"} onClick={() => run([{ op: "edit", id: obj.id, set: { locked: !obj.locked } }])}>
            {obj.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
          </IconBtn>
          <IconBtn title="Delete" danger onClick={() => run([{ op: "remove", id: obj.id }])}>
            <Trash2 className="size-3.5" />
          </IconBtn>
        </div>
      </div>

      {obj.type === "text" && <TextSection obj={obj} />}
      {obj.type === "bubble" && <BubbleSection obj={obj} />}
      {obj.type === "video" && <VideoClipSection obj={obj} />}
      {(obj.type === "image" || obj.type === "video") && <MediaLookSection obj={obj} />}
      {obj.type === "audio" && <AudioSection obj={obj} />}
      {obj.type === "svg" && <SvgSection obj={obj} />}
      {obj.type === "caption" && <CaptionSection obj={obj} />}
      {obj.type === "region" && <RegionSection obj={obj} />}
      {obj.type === "chart" && <ChartSection obj={obj} />}
      {obj.type === "stickman" && <StickmanSection obj={obj} />}
      {obj.type === "stickman" && <LookSection obj={obj} />}
      {obj.type === "creature" && <CreatureSection obj={obj} />}
      {obj.type === "effect" && <EffectSection obj={obj} />}
      {obj.type === "sound" && <SoundSection obj={obj} />}
      {obj.type === "light" && <LightSection obj={obj} />}
      {obj.type === "drawing" && <DrawingSection obj={obj} />}

      {obj.type !== "audio" && obj.type !== "sound" && obj.type !== "caption" && obj.type !== "bubble" && <TransformSection obj={obj} time={time} />}
      {obj.type !== "audio" && obj.type !== "sound" && obj.type !== "light" && <AnimateSection obj={obj} time={time} />}
    </>
  );
}

function IconBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`rounded-md p-1.5 text-muted-foreground hover:bg-accent ${danger ? "hover:text-destructive" : "hover:text-foreground"}`}>
      {children}
    </button>
  );
}

function setProp(id: string, prop: string, v: number) {
  if (!Number.isFinite(v)) return;
  const s = useStore.getState();
  const next = cloneScene(s.scene);
  const o = findObj(next, id);
  if (!o) return;
  setAt(o, prop, s.time, v);
  s.commit(next);
}

/** A diamond that keys a property at the playhead (filled when it has keys). */
function KeyToggle({ obj, prop, time }: { obj: SceneObj; prop: string; time: number }) {
  const keys = obj.tracks[prop];
  const here = keys?.some((k) => Math.abs(k.t - time) < 0.01);
  return (
    <button
      title={keys?.length ? (here ? "Keyframe here" : "Animated: add a keyframe here") : "Animate this: add a keyframe at the playhead"}
      className={`p-0.5 ${keys?.length ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}
      onClick={(e) => {
        e.preventDefault();
        const s = useStore.getState();
        const next = cloneScene(s.scene);
        const o = findObj(next, obj.id);
        if (!o) return;
        const v = valueAt(o, prop, s.time);
        const list = (o.tracks[prop] ??= []);
        if (!list.length) list.push({ t: 0, v });
        if (!list.some((k) => Math.abs(k.t - s.time) < 0.01)) list.push({ t: Math.round(s.time * 100) / 100, v });
        list.sort((a, b) => a.t - b.t);
        s.commit(next);
      }}
    >
      <Diamond className={`size-3 ${here ? "fill-current" : ""}`} />
    </button>
  );
}

function TransformSection({ obj, time }: { obj: SceneObj; time: number }) {
  const mode3d = useStore((s) => s.scene.mode === "3d");
  const v = (p: string) => valueAt(obj, p, time);
  const field = (label: string, prop: string, step = 1, digits = 0) => (
    <Row label={label}>
      <NumField value={digits ? Math.round(v(prop) * 100) / 100 : Math.round(v(prop))} step={step} onCommit={(n) => setProp(obj.id, prop, n)} />
      <KeyToggle obj={obj} prop={prop} time={time} />
    </Row>
  );
  return (
    <Section title="Position and size">
      <div className="grid grid-cols-2 gap-x-3">
        {field("X", "x")}
        {field("Y", "y")}
        {field("Scale", "scale", 0.05, 2)}
        {field("Rotate", "rotation")}
        {mode3d && field("Depth", "z")}
        {mode3d && field("Turn", "yaw")}
      </div>
      <Row label="Opacity">
        <NumField value={Math.round(v("opacity") * 100)} step={5} min={0} max={100} suffix="%" onCommit={(n) => setProp(obj.id, "opacity", n / 100)} />
        <KeyToggle obj={obj} prop="opacity" time={time} />
      </Row>
      {"w" in obj && typeof obj.w === "number" && "h" in obj && (
        <div className="grid grid-cols-2 gap-x-3">
          <Row label="Width">
            <NumField value={Math.round(obj.w)} min={4} onCommit={(n) => run([{ op: "edit", id: obj.id, set: { w: n } }])} />
          </Row>
          <Row label="Height">
            <NumField value={Math.round(obj.h as number)} min={4} onCommit={(n) => run([{ op: "edit", id: obj.id, set: { h: n } }])} />
          </Row>
        </div>
      )}
      <Row label="Scale and turn from" hint="Around the middle of the object, or its corner">
        <SelectField value={obj.pivot === "center" ? "center" : "origin"} options={[{ value: "center", label: "Middle" }, { value: "origin", label: "Corner (x,y)" }]} onChange={(p) => run([{ op: "edit", id: obj.id, set: { pivot: p === "center" ? "center" : null } }])} />
      </Row>
      <Note>◆ keys a value at the playhead. Once a value is animated, changing it sets a key where the playhead is.</Note>
    </Section>
  );
}

function AnimateSection({ obj, time }: { obj: SceneObj; time: number }) {
  const t = Math.round(time * 100) / 100;
  const scene = useStore((s) => s.scene);
  const [enter, setEnter] = useState<(typeof ENTER_KINDS)[number]>("pop");
  const [exit, setExit] = useState<(typeof EXIT_KINDS)[number]>("fade");
  const [parent, setParent] = useState("");
  const link = activeLink(obj, time);
  return (
    <Section title={`Animate · at ${t}s`}>
      <Row label="Comes in">
        <SelectField value={enter} options={ENTER_KINDS} onChange={setEnter} />
        <button className="chip" onClick={() => run([{ op: "enter", id: obj.id, kind: enter, at: t }])}>
          Add
        </button>
      </Row>
      <Row label="Leaves">
        <SelectField value={exit} options={EXIT_KINDS} onChange={setExit} />
        <button className="chip" onClick={() => run([{ op: "exit", id: obj.id, kind: exit, at: t + 0.5 }])}>
          Add
        </button>
      </Row>
      <Row label="Keeps moving">
        <SelectField value={obj.loop ?? "none"} options={LOOPS} onChange={(l) => run([{ op: "loop", id: obj.id, kind: l }])} />
      </Row>
      {obj.loop && obj.loop !== "none" && (
        <Row label="Loop strength">
          <NumField value={obj.loopAmount ?? 1} step={0.1} min={0.1} max={5} onCommit={(n) => run([{ op: "loop", id: obj.id, kind: obj.loop, amount: n }])} />
        </Row>
      )}
      <div className="mt-1 flex flex-wrap gap-1.5">
        <button className="chip" onClick={() => run([{ op: "bounce", id: obj.id, at: t }])}>
          Bounce
        </button>
        <button className="chip" onClick={() => run([{ op: "shake", id: obj.id, at: t }])}>
          Shake
        </button>
        <button className="chip" onClick={() => run([{ op: "show", id: obj.id, at: t, duration: 0.4 }])}>
          Fade in here
        </button>
        <button className="chip" onClick={() => run([{ op: "hide", id: obj.id, at: t, duration: 0.4 }])}>
          Fade out here
        </button>
        {Object.keys(obj.tracks).length > 0 && (
          <button className="chip hover:text-destructive" onClick={() => run([{ op: "clearMotion", id: obj.id }])}>
            Clear animation
          </button>
        )}
      </div>
      {obj.type !== "caption" && (
        <Row label={link ? "Attached to" : "Attach to"} hint="Move together with another object (a region following a face, a hat on a head)">
          {link ? (
            <>
              <span className="truncate text-xs">{scene.objects.find((o) => o.id === link.parent)?.name ?? link.parent}</span>
              <button className="chip" onClick={() => run([{ op: "detach", id: obj.id, at: t }])}>
                Detach
              </button>
            </>
          ) : (
            <>
              <SelectField
                value={parent}
                width={140}
                options={[{ value: "", label: "Choose…" }, ...scene.objects.filter((o) => o.id !== obj.id && o.type !== "audio" && o.type !== "sound" && o.type !== "caption").map((o) => ({ value: o.id, label: o.name }))]}
                onChange={setParent}
              />
              <button className="chip" disabled={!parent} onClick={() => run([{ op: "attach", id: obj.id, to: parent, at: t }])}>
                Attach
              </button>
            </>
          )}
        </Row>
      )}
    </Section>
  );
}
