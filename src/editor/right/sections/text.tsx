import { Bold, Italic } from "lucide-react";
import { TEXT_STYLES, cloneScene, findObj, type TextObj } from "@/engine/scene";
import { FONT_LIST } from "@/engine/fonts";
import { useStore } from "@/store";
import { ColorInput, NumField, Row, Section, SelectField, Segmented, TextField, run } from "../../fields";

const STYLE_LABEL: Record<string, string> = { plain: "Plain", outline: "Outline", shadow: "Shadow", box: "Label box", highlight: "Marker highlight", lowerThird: "Name bar", gradient: "Gradient" };

export function TextSection({ obj }: { obj: TextObj }) {
  const edit = (set: Record<string, unknown>) => run([{ op: "edit", id: obj.id, set }]);
  const style = obj.style ?? "plain";
  const setCounter = (patch: Partial<NonNullable<TextObj["counter"]>>) => {
    const s = useStore.getState();
    const next = cloneScene(s.scene);
    const o = findObj(next, obj.id);
    if (o?.type !== "text" || !o.counter) return;
    Object.assign(o.counter, patch);
    o.text = `${o.counter.prefix}${o.counter.to}${o.counter.suffix}`;
    s.commit(next);
  };
  return (
    <Section title="Text">
      {!obj.counter && <TextField multiline value={obj.text} onCommit={(v) => edit({ text: v })} />}
      <Row label="Font">
        <SelectField value={obj.font} options={FONT_LIST.map((f) => ({ value: f.id, label: f.label }))} onChange={(v) => edit({ font: v })} />
      </Row>
      <Row label="Size">
        <NumField value={obj.size} min={4} max={600} onCommit={(v) => edit({ size: v })} />
        <button className={`rounded p-1 ${obj.bold ? "bg-panel-raised text-primary" : "text-muted-foreground"}`} title="Bold (system fonts)" onClick={() => run([{ op: "update", id: obj.id, set: { bold: !obj.bold } }])}>
          <Bold className="size-3.5" />
        </button>
        <button className={`rounded p-1 ${obj.italic ? "bg-panel-raised text-primary" : "text-muted-foreground"}`} title="Italic" onClick={() => edit({ italic: !obj.italic })}>
          <Italic className="size-3.5" />
        </button>
      </Row>
      <Row label="Align">
        <Segmented value={obj.align} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} onChange={(v) => edit({ align: v })} />
      </Row>
      <Row label="Color">
        <ColorInput value={obj.color} onChange={(c) => edit({ color: c })} />
      </Row>
      <Row label="Style">
        <SelectField value={style} options={TEXT_STYLES.map((s) => ({ value: s, label: STYLE_LABEL[s] ?? s }))} onChange={(v) => edit({ style: v })} />
      </Row>
      {style !== "plain" && style !== "shadow" && (
        <Row label={style === "gradient" ? "Second color" : style === "outline" ? "Outline" : "Box color"}>
          <ColorInput value={obj.accent ?? (style === "outline" ? "#111111" : "#E11D48")} onChange={(c) => edit({ accent: c })} />
        </Row>
      )}
      {style === "lowerThird" && (
        <Row label="Second line">
          <TextField value={obj.subtext ?? ""} onCommit={(v) => edit({ subtext: v })} />
        </Row>
      )}
      <Row label="Wrap width" hint="Break lines at this width (0: never)">
        <NumField value={Math.round(obj.maxWidth ?? 0)} min={0} onCommit={(v) => edit({ maxWidth: v > 0 ? v : null })} />
      </Row>
      <div className="grid grid-cols-2 gap-x-3">
        <Row label="Line height">
          <NumField value={obj.lineHeight ?? 1.25} step={0.05} min={0.6} max={3} width={56} onCommit={(v) => edit({ lineHeight: v })} />
        </Row>
        <Row label="Spacing">
          <NumField value={obj.letterSpacing ?? 0} min={-10} max={60} width={56} onCommit={(v) => edit({ letterSpacing: v })} />
        </Row>
      </div>
      {obj.counter && (
        <>
          <p className="eyebrow mt-2">Counting number</p>
          <div className="grid grid-cols-2 gap-x-3">
            <Row label="From">
              <NumField value={obj.counter.from} width={64} onCommit={(v) => setCounter({ from: v })} />
            </Row>
            <Row label="To">
              <NumField value={obj.counter.to} width={64} onCommit={(v) => setCounter({ to: v })} />
            </Row>
            <Row label="Starts">
              <NumField value={obj.counter.start} step={0.1} min={0} width={64} suffix="s" onCommit={(v) => setCounter({ start: v })} />
            </Row>
            <Row label="Takes">
              <NumField value={obj.counter.duration} step={0.1} min={0} width={64} suffix="s" onCommit={(v) => setCounter({ duration: v })} />
            </Row>
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            <Row label="Before">
              <TextField value={obj.counter.prefix} onCommit={(v) => setCounter({ prefix: v.slice(0, 6) })} />
            </Row>
            <Row label="After">
              <TextField value={obj.counter.suffix} onCommit={(v) => setCounter({ suffix: v.slice(0, 10) })} />
            </Row>
          </div>
        </>
      )}
    </Section>
  );
}
