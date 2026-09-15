import { Plus, X } from "lucide-react";
import { CHART_KINDS, cloneScene, findObj, type ChartObj } from "@/engine/scene";
import { useStore } from "@/store";
import { ColorInput, NumField, Row, Section, SelectField, TextField, Toggle, run } from "../../fields";

const LABEL: Record<string, string> = { bar: "Bars", hbar: "Rows", line: "Line", pie: "Pie", donut: "Donut" };

export function ChartSection({ obj }: { obj: ChartObj }) {
  const edit = (set: Record<string, unknown>) => run([{ op: "edit", id: obj.id, set }]);
  const setData = (data: ChartObj["data"]) => edit({ data });
  const restart = (patch: Partial<ChartObj>) => {
    const s = useStore.getState();
    const next = cloneScene(s.scene);
    Object.assign(findObj(next, obj.id) as ChartObj, patch);
    s.commit(next);
  };
  return (
    <Section title="Chart">
      <Row label="Kind">
        <SelectField value={obj.kind} options={CHART_KINDS.map((k) => ({ value: k, label: LABEL[k] }))} onChange={(v) => edit({ kind: v })} />
      </Row>
      <div className="flex flex-col gap-1">
        {obj.data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <TextField value={d.label} onCommit={(v) => setData(obj.data.map((x, j) => (j === i ? { ...x, label: v.slice(0, 40) } : x)))} />
            </div>
            <NumField value={d.value} width={64} onCommit={(v) => setData(obj.data.map((x, j) => (j === i ? { ...x, value: v } : x)))} />
            <button className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={obj.data.length < 2} onClick={() => setData(obj.data.filter((_, j) => j !== i))}>
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <button className="chip w-fit" onClick={() => setData([...obj.data, { label: `Item ${obj.data.length + 1}`, value: 10 }])} disabled={obj.data.length >= 20}>
          <Plus className="size-3.5" /> Add a value
        </button>
      </div>
      <Row label="Unit">
        <TextField value={obj.unit} placeholder="%, $, kg…" onCommit={(v) => edit({ unit: v.slice(0, 8) })} />
      </Row>
      <Row label="Text color">
        <ColorInput value={obj.textColor} onChange={(c) => edit({ textColor: c })} />
      </Row>
      <Toggle label="Show values" checked={obj.showValues} onChange={(v) => edit({ showValues: v })} />
      <div className="grid grid-cols-2 gap-x-3">
        <Row label="Grows from">
          <NumField value={obj.start} step={0.1} min={0} width={56} suffix="s" onCommit={(v) => restart({ start: v })} />
        </Row>
        <Row label="Takes">
          <NumField value={obj.duration} step={0.1} min={0} width={56} suffix="s" onCommit={(v) => restart({ duration: v })} />
        </Row>
      </div>
    </Section>
  );
}
