import { REGION_KINDS, type RegionObj } from "@/engine/scene";
import { ColorInput, Row, Section, SelectField, SliderRow, Segmented, Note, run } from "../../fields";

const LABEL: Record<string, string> = { blur: "Blur", pixelate: "Pixelate", redact: "Solid cover", highlight: "Highlight box", spotlight: "Spotlight (dim the rest)", magnify: "Magnify" };

export function RegionSection({ obj }: { obj: RegionObj }) {
  const edit = (set: Record<string, unknown>) => run([{ op: "edit", id: obj.id, set }]);
  const strengthLabel = obj.kind === "blur" ? "Blur" : obj.kind === "pixelate" ? "Block size" : obj.kind === "spotlight" ? "Darkness" : obj.kind === "magnify" ? "Zoom" : "Line width";
  return (
    <Section title="Area">
      <Row label="Effect">
        <SelectField value={obj.kind} options={REGION_KINDS.map((k) => ({ value: k, label: LABEL[k] ?? k }))} onChange={(v) => edit({ kind: v })} />
      </Row>
      <Row label="Shape">
        <Segmented value={obj.shape} options={[{ value: "rect", label: "Box" }, { value: "ellipse", label: "Oval" }]} onChange={(v) => edit({ shape: v === "ellipse" ? "circle" : "rect" })} />
      </Row>
      {obj.kind !== "redact" && <SliderRow label={strengthLabel} value={obj.strength} min={1} max={100} onCommit={(v) => edit({ strength: v })} />}
      {(obj.kind === "redact" || obj.kind === "highlight" || obj.kind === "magnify") && (
        <Row label="Color">
          <ColorInput value={obj.color} onChange={(c) => edit({ color: c })} />
        </Row>
      )}
      <Note>To follow something that moves, attach this area to it below, or move it with keyframes.</Note>
    </Section>
  );
}
