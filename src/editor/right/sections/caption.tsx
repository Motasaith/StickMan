import { CAPTION_STYLES, cloneScene, findObj, type CaptionObj } from "@/engine/scene";
import { FONT_LIST } from "@/engine/fonts";
import { estimateWords } from "@/engine/media";
import { useStore } from "@/store";
import { ColorInput, NumField, Row, Section, SelectField, Segmented, TextField, Note, run } from "../../fields";

const STYLE_LABEL: Record<string, string> = { standard: "Soft shadow", outline: "Bold outline", box: "Dark box", highlight: "Highlight word", karaoke: "Karaoke", pop: "Pop word" };

export function CaptionSection({ obj }: { obj: CaptionObj }) {
  const edit = (set: Record<string, unknown>) => run([{ op: "edit", id: obj.id, set }]);
  const text = obj.words.map((w) => w.text).join(" ");
  const setText = (v: string) => {
    // Keep the timing: re-spread the new words across the same stretch of time.
    const s = useStore.getState();
    const next = cloneScene(s.scene);
    const o = findObj(next, obj.id) as CaptionObj;
    if (!obj.words.length) return;
    const start = obj.words[0].start;
    const end = obj.words[obj.words.length - 1].end;
    const newWords = v.split(/\s+/).filter(Boolean);
    o.words = newWords.length === obj.words.length ? obj.words.map((w, i) => ({ ...w, text: newWords[i] })) : estimateWords(v, start, end - start);
    s.commit(next);
  };
  return (
    <Section title="Captions">
      <Row label="Style">
        <SelectField value={obj.style} options={CAPTION_STYLES.map((s) => ({ value: s, label: STYLE_LABEL[s] ?? s }))} onChange={(v) => edit({ captionStyle: v })} />
      </Row>
      <Row label="Position">
        <Segmented value={obj.position} options={[{ value: "top", label: "Top" }, { value: "middle", label: "Middle" }, { value: "bottom", label: "Bottom" }]} onChange={(v) => edit({ position: v })} />
      </Row>
      <Row label="Font">
        <SelectField value={obj.font} options={FONT_LIST.map((f) => ({ value: f.id, label: f.label }))} onChange={(v) => edit({ font: v })} />
      </Row>
      <div className="grid grid-cols-2 gap-x-3">
        <Row label="Size">
          <NumField value={obj.size} min={10} max={200} width={56} onCommit={(v) => edit({ size: v })} />
        </Row>
        <Row label="Line">
          <NumField value={obj.maxChars} min={8} max={80} width={56} suffix="ch" onCommit={(v) => edit({ maxChars: v })} />
        </Row>
      </div>
      <Row label="Text">
        <ColorInput value={obj.color} onChange={(c) => edit({ color: c })} />
      </Row>
      <Row label="Accent">
        <ColorInput value={obj.accent} onChange={(c) => edit({ accent: c })} />
      </Row>
      <p className="eyebrow mt-2">Words ({obj.words.length})</p>
      <TextField multiline rows={5} value={text} onCommit={setText} />
      <Note>
        {obj.source === "narration" ? "These follow the narration: re-recording a voice updates them." : "Fix a misheard word here; the timing stays."} Drag the captions box on the canvas to move it.
      </Note>
    </Section>
  );
}
