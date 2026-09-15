import { useState } from "react";
import { Captions, Loader2, Pipette, Unlink } from "lucide-react";
import { toast } from "sonner";
import { COLOR_LOOKS, cloneScene, findObj, uniqueId, type ImageObj, type VideoObj } from "@/engine/scene";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { ColorInput, NumField, Row, Section, SelectField, SliderRow, Toggle, Note, run } from "../../fields";

const LANGS = ["english", "urdu", "hindi", "arabic", "punjabi", "bengali", "persian", "turkish", "indonesian", "malay", "spanish", "french", "german", "portuguese", "italian", "russian", "chinese", "japanese", "korean"];

export function MediaLookSection({ obj }: { obj: ImageObj | VideoObj }) {
  const edit = (set: Record<string, unknown>) => run([{ op: "edit", id: obj.id, set }]);
  const a = obj.adjust ?? { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
  const lookId = COLOR_LOOKS.find((l) => JSON.stringify({ ...l.adjust }) === JSON.stringify({ brightness: a.brightness, contrast: a.contrast, saturation: a.saturation, warmth: a.warmth }))?.id ?? "custom";
  return (
    <>
      <Section title="Look">
        <Row label="Shape">
          <SelectField value={obj.shape ?? "rect"} options={[{ value: "rect", label: "Rectangle" }, { value: "rounded", label: "Rounded" }, { value: "circle", label: "Circle" }]} onChange={(v) => edit({ shape: v })} />
        </Row>
        <Row label="Fit to frame">
          <button
            className="chip"
            onClick={() => {
              const s = useStore.getState();
              const next = cloneScene(s.scene);
              const o = findObj(next, obj.id) as ImageObj | VideoObj;
              o.x = 0;
              o.y = 0;
              o.w = next.width;
              o.h = next.height;
              delete o.tracks.x;
              delete o.tracks.y;
              delete o.tracks.scale;
              o.scale = 1;
              s.commit(next);
            }}
          >
            Fill the frame
          </button>
        </Row>
        <Toggle label="Mirror" checked={!!obj.flipX} onChange={(v) => edit({ flipX: v })} />
        <Toggle label="Drop shadow" checked={!!obj.shadow} onChange={(v) => edit({ shadow: v })} />
        <Toggle label="Border" checked={!!obj.border} onChange={(v) => edit({ border: v ? { width: 8, color: "#ffffff" } : null })} />
        {obj.border && (
          <Row label="Border">
            <NumField value={obj.border.width} min={1} max={60} width={56} onCommit={(v) => edit({ border: { ...obj.border!, width: v } })} />
            <ColorInput value={obj.border.color} onChange={(c) => edit({ border: { ...obj.border!, color: c } })} />
          </Row>
        )}
      </Section>
      <Section title="Color">
        <Row label="Look">
          <SelectField value={lookId} options={[...COLOR_LOOKS.map((l) => ({ value: l.id, label: l.label })), ...(lookId === "custom" ? [{ value: "custom", label: "Custom" }] : [])]} onChange={(v) => v !== "custom" && edit({ look: v })} />
        </Row>
        <SliderRow label="Brightness" value={a.brightness} min={-60} max={60} onCommit={(v) => edit({ adjust: { brightness: v } })} />
        <SliderRow label="Contrast" value={a.contrast} min={-60} max={60} onCommit={(v) => edit({ adjust: { contrast: v } })} />
        <SliderRow label="Color" value={a.saturation} min={-100} max={80} onCommit={(v) => edit({ adjust: { saturation: v } })} />
        <SliderRow label="Warmth" value={a.warmth} min={-60} max={60} onCommit={(v) => edit({ adjust: { warmth: v } })} />
        <SliderRow label="Blur" value={a.blur ?? 0} min={0} max={30} onCommit={(v) => edit({ adjust: { blur: v } })} />
      </Section>
      <Section title="Green screen" defaultOpen={!!obj.chroma}>
        <Toggle label="Remove a background color" checked={!!obj.chroma} onChange={(v) => edit({ chroma: v ? { color: "#00ff00", similarity: 0.25, smoothness: 0.08 } : null })} />
        {obj.chroma && (
          <>
            <Row label="Color to remove">
              <ColorInput value={obj.chroma.color} onChange={(c) => edit({ chroma: { ...obj.chroma!, color: c } })} />
              <Pipette className="size-3.5 text-muted-foreground" />
            </Row>
            <SliderRow label="How close" value={obj.chroma.similarity} min={0.01} max={0.5} step={0.01} onCommit={(v) => edit({ chroma: { ...obj.chroma!, similarity: v } })} />
            <SliderRow label="Soft edge" value={obj.chroma.smoothness} min={0} max={0.3} step={0.01} onCommit={(v) => edit({ chroma: { ...obj.chroma!, smoothness: v } })} />
          </>
        )}
      </Section>
    </>
  );
}

export function VideoClipSection({ obj }: { obj: VideoObj }) {
  const asset = useStore((s) => s.assets.find((a) => a.id === obj.asset));
  const edit = (set: Record<string, unknown>) => run([{ op: "edit", id: obj.id, set }]);
  const [lang, setLang] = useState("english");
  const [busy, setBusy] = useState(false);

  const transcribe = async () => {
    setBusy(true);
    const toastId = toast.loading("Listening to the clip…", { description: "The first time downloads the speech model (about 150 MB)." });
    try {
      const { words } = await api.transcribe(obj.asset, lang, obj.in, obj.in + obj.duration * obj.speed);
      if (!words.length) {
        toast.message("No speech found in this clip", { id: toastId });
        return;
      }
      const s = useStore.getState();
      const next = cloneScene(s.scene);
      const id = uniqueId(next, `${obj.id}_captions`);
      const timed = words.map((w) => ({ text: w.text, start: obj.start + (w.start - obj.in) / obj.speed, end: obj.start + (w.end - obj.in) / obj.speed }));
      next.objects.push({
        id,
        name: `Captions: ${obj.name}`,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        tracks: {},
        type: "caption",
        words: timed,
        source: obj.id,
        style: "karaoke",
        position: "bottom",
        font: "poppins",
        size: Math.round(Math.min(next.width, next.height) * 0.055),
        color: "#FFFFFF",
        accent: "#FFD23F",
        maxChars: next.height > next.width ? 22 : 38,
      });
      s.commit(next);
      toast.success(`Captions added: ${words.length} words`, { id: toastId, description: "Select them on the timeline to restyle." });
    } catch (err) {
      toast.error("Couldn't make captions", { id: toastId, description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Clip">
      <div className="grid grid-cols-2 gap-x-3">
        <Row label="Starts">
          <NumField value={Math.round(obj.start * 100) / 100} step={0.1} min={0} width={64} suffix="s" onCommit={(v) => run([{ op: "trim", id: obj.id, start: v }])} />
        </Row>
        <Row label="Length">
          <NumField value={Math.round(obj.duration * 100) / 100} step={0.1} min={0.1} width={64} suffix="s" onCommit={(v) => run([{ op: "trim", id: obj.id, duration: v }])} />
        </Row>
        <Row label="From source">
          <NumField value={Math.round(obj.in * 100) / 100} step={0.1} min={0} max={asset?.duration} width={64} suffix="s" onCommit={(v) => run([{ op: "trim", id: obj.id, in: v }])} />
        </Row>
        <Row label="Freeze end">
          <NumField value={obj.freeze ?? 0} step={0.5} min={0} max={30} width={64} suffix="s" onCommit={(v) => edit({ freeze: v })} />
        </Row>
      </div>
      <Row label="Speed">
        <SelectField value={String(obj.speed)} options={["0.25", "0.5", "0.75", "1", "1.25", "1.5", "2", "3", "4"].map((v) => ({ value: v, label: `${v}×` }))} onChange={(v) => {
          const speed = Number(v);
          const s = useStore.getState();
          const next = cloneScene(s.scene);
          const o = findObj(next, obj.id) as VideoObj;
          // Same stretch of source, played faster or slower.
          o.duration = Math.max(0.1, (obj.duration * obj.speed) / speed);
          o.speed = speed;
          s.commit(next);
        }} />
      </Row>
      <Toggle label="Play backwards" checked={!!obj.reverse} onChange={(v) => edit({ reverse: v })} />
      <SliderRow label="Volume" value={obj.volume} min={0} max={2} step={0.05} onCommit={(v) => edit({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <div className="grid grid-cols-2 gap-x-3">
        <Row label="Fade in">
          <NumField value={obj.fadeIn} step={0.1} min={0} max={10} width={56} suffix="s" onCommit={(v) => edit({ fadeIn: v })} />
        </Row>
        <Row label="Fade out">
          <NumField value={obj.fadeOut} step={0.1} min={0} max={10} width={56} suffix="s" onCommit={(v) => edit({ fadeOut: v })} />
        </Row>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <button className="chip" onClick={() => run([{ op: "detachAudio", id: obj.id }])} disabled={asset?.hasAudio === false}>
          <Unlink className="size-3.5" /> Detach sound
        </button>
      </div>
      <p className="eyebrow mt-3">Captions from speech</p>
      <Row label="Language">
        <SelectField value={lang} options={LANGS} onChange={setLang} />
        <button className="chip" disabled={busy || asset?.hasAudio === false} onClick={transcribe}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Captions className="size-3.5" />} Make
        </button>
      </Row>
      {asset?.hasAudio === false && <Note>This clip has no sound track.</Note>}
    </Section>
  );
}
