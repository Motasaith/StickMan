import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { svgColors } from "@/engine/svg";
import { cloneScene, findObj, type SvgObj } from "@/engine/scene";
import { useStore } from "@/store";
import { svgLookup } from "@/runtime/media";
import { ColorInput, Row, Section, SliderRow, Toggle, Note, run } from "../../fields";

export function SvgSection({ obj }: { obj: SvgObj }) {
  const assets = useStore((s) => s.assets);
  const version = useStore((s) => s.imagesVersion);
  const edit = (set: Record<string, unknown>) => run([{ op: "edit", id: obj.id, set }]);
  const markup = svgLookup(assets)(obj.src);
  const palette = useMemo(() => (markup ? svgColors(markup).slice(0, 8) : []), [markup, version]);
  const swap = (from: string, to: string) => {
    const s = useStore.getState();
    const next = cloneScene(s.scene);
    const o = findObj(next, obj.id) as SvgObj;
    o.colors = { ...(o.colors ?? {}), [from]: to };
    s.commit(next);
  };
  return (
    <Section title={obj.src.startsWith("emoji:") ? "Sticker" : "Illustration"}>
      <SliderRow label="Animation speed" value={obj.speed} min={0} max={3} step={0.1} onCommit={(v) => edit({ speed: v })} format={(v) => (v === 0 ? "still" : `${v.toFixed(1)}×`)} />
      <Row label="Animation">
        <button className="chip" onClick={() => edit({ clock: Math.round(useStore.getState().time * 100) / 100 })}>
          <RotateCcw className="size-3.5" /> Start it at the playhead
        </button>
      </Row>
      <Toggle label="Mirror" checked={!!obj.flipX} onChange={(v) => edit({ flipX: v })} />
      {palette.length > 0 && (
        <>
          <p className="eyebrow mt-2">Colors</p>
          <Note>Swap colors to match your theme or brand.</Note>
          <div className="grid grid-cols-2 gap-x-3">
            {palette.map((c) => (
              <Row key={c} label="">
                <span className="size-4 rounded border border-line" style={{ background: c }} />
                <ColorInput value={obj.colors?.[c] ?? c} onChange={(v) => swap(c, v)} />
              </Row>
            ))}
          </div>
          {obj.colors && Object.keys(obj.colors).length > 0 && (
            <button className="chip" onClick={() => edit({ colors: {} })}>
              Original colors
            </button>
          )}
        </>
      )}
    </Section>
  );
}
