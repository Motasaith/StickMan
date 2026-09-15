import { Captions, Flag, X } from "lucide-react";
import { useStore } from "@/store";
import { COLOR_LOOKS, LIGHTING_PRESETS, cloneScene } from "@/engine/scene";
import { THEMES } from "@/engine/themes";
import { ColorInput, NumField, Row, Section, SelectField, SliderRow, Segmented, Note, run } from "../fields";

const FORMATS = [
  { value: "1280x720", label: "16:9 HD (1280×720)" },
  { value: "1920x1080", label: "16:9 Full HD (1920×1080)" },
  { value: "1080x1920", label: "9:16 Vertical (1080×1920)" },
  { value: "720x1280", label: "9:16 Light (720×1280)" },
  { value: "1080x1080", label: "1:1 Square (1080×1080)" },
  { value: "1080x1350", label: "4:5 Portrait (1080×1350)" },
];

export function ProjectPanel() {
  const scene = useStore((s) => s.scene);
  const size = `${scene.width}x${scene.height}`;
  const bg = scene.backgroundFill;
  const grade = scene.grade;
  const narration = scene.objects.some((o) => o.type === "audio" && o.role === "narration");
  const hasCaptions = scene.objects.some((o) => o.type === "caption");
  const setGrade = (patch: Record<string, number>) => run([{ op: "grade", ...(grade ?? { brightness: 0, contrast: 0, saturation: 0, warmth: 0 }), ...patch }]);
  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <p className="eyebrow">Project</p>
        <p className="mt-1 text-sm text-muted-foreground">Nothing selected. Click something on the canvas or timeline to edit it.</p>
      </div>
      <Section title="Format">
        <Row label="Size">
          <SelectField
            value={size}
            options={FORMATS.some((f) => f.value === size) ? FORMATS : [{ value: size, label: size }, ...FORMATS]}
            onChange={(v) => {
              const [w, h] = v.split("x").map(Number);
              run([{ op: "scene", width: w, height: h }]);
            }}
          />
        </Row>
        <Row label="Length">
          <NumField value={scene.duration} step={0.5} min={0.5} suffix="s" onCommit={(v) => run([{ op: "scene", duration: v }])} />
        </Row>
        <Row label="Frame rate">
          <SelectField value={String(scene.fps)} options={["24", "25", "30", "60"]} onChange={(v) => run([{ op: "scene", fps: Number(v) }])} />
        </Row>
      </Section>

      <Section title="Background">
        <Row label="Fill">
          <Segmented
            value={bg?.kind === "gradient" ? "gradient" : "color"}
            options={[
              { value: "color", label: "Color" },
              { value: "gradient", label: "Gradient" },
            ]}
            onChange={(k) => run([k === "gradient" ? { op: "background", gradient: { from: "#4F7CFF", to: "#7B61FF", angle: 135 } } : { op: "background", color: scene.background }])}
          />
        </Row>
        {bg?.kind === "gradient" ? (
          <>
            <Row label="From">
              <ColorInput value={bg.from} onChange={(c) => run([{ op: "background", gradient: { ...bg, from: c } }])} />
            </Row>
            <Row label="To">
              <ColorInput value={bg.to} onChange={(c) => run([{ op: "background", gradient: { ...bg, to: c } }])} />
            </Row>
            <SliderRow label="Angle" value={bg.angle} min={0} max={360} step={5} onCommit={(a) => run([{ op: "background", gradient: { ...bg, angle: a } }])} format={(v) => `${v}°`} />
          </>
        ) : (
          <Row label="Color">
            <ColorInput value={scene.background} onChange={(c) => run([{ op: "background", color: c }])} />
          </Row>
        )}
      </Section>

      <Section title="Color grade">
        <Row label="Look">
          <SelectField value={COLOR_LOOKS.find((l) => grade && JSON.stringify(l.adjust) === JSON.stringify(grade))?.id ?? (grade ? "custom" : "natural")} options={[...COLOR_LOOKS.map((l) => ({ value: l.id, label: l.label })), ...(grade && !COLOR_LOOKS.some((l) => JSON.stringify(l.adjust) === JSON.stringify(grade)) ? [{ value: "custom", label: "Custom" }] : [])]} onChange={(v) => v !== "custom" && run([{ op: "grade", look: v }])} />
        </Row>
        <SliderRow label="Brightness" value={grade?.brightness ?? 0} min={-60} max={60} onCommit={(v) => setGrade({ brightness: v })} />
        <SliderRow label="Contrast" value={grade?.contrast ?? 0} min={-60} max={60} onCommit={(v) => setGrade({ contrast: v })} />
        <SliderRow label="Color" value={grade?.saturation ?? 0} min={-100} max={80} onCommit={(v) => setGrade({ saturation: v })} />
        <SliderRow label="Warmth" value={grade?.warmth ?? 0} min={-60} max={60} onCommit={(v) => setGrade({ warmth: v })} />
      </Section>

      <Section title="Captions">
        {hasCaptions ? (
          <Note>Captions are on: select them on the timeline to change their style.</Note>
        ) : (
          <>
            <Note>Show the spoken words on screen, a line at a time.</Note>
            <div className="flex flex-wrap gap-1.5">
              <button className="chip" disabled={!narration} onClick={() => run([{ op: "captions", from: "narration", style: "highlight" }])}>
                <Captions className="size-3.5" /> From narration
              </button>
              <button className="chip" disabled={!scene.objects.some((o) => o.type === "bubble")} onClick={() => run([{ op: "captions", from: "bubbles", style: "outline" }])}>
                <Captions className="size-3.5" /> From speech bubbles
              </button>
            </div>
            <Note>For videos and recordings, select the clip and use "Captions from speech".</Note>
          </>
        )}
      </Section>

      {scene.slides?.length ? (
        <Section title="Presentation">
          <Row label="Theme">
            <SelectField value={scene.theme ?? "clean"} options={THEMES.map((t) => ({ value: t.id, label: t.label }))} onChange={(v) => run([{ op: "theme", theme: v }])} />
          </Row>
          <Note>{scene.slides.length} slides. Select a slide on the timeline strip to edit it.</Note>
        </Section>
      ) : null}

      {scene.mode === "3d" && (
        <Section title="3D world">
          <Row label="Lighting">
            <SelectField value={scene.lighting ?? "day"} options={LIGHTING_PRESETS} onChange={(v) => run([{ op: "scene", lighting: v }])} />
          </Row>
          <Row label="Look">
            <SelectField value={scene.look3d ?? "soft"} options={[{ value: "soft", label: "Soft render" }, { value: "toon", label: "Toon outlines" }]} onChange={(v) => run([{ op: "scene", look3d: v }])} />
          </Row>
          <Row label="Floor">
            <ColorInput value={scene.floor ?? "#b9cf94"} onChange={(c) => run([{ op: "scene", floor: c }])} />
          </Row>
          <button className="chip" onClick={() => run([{ op: "direct" }])}>
            Plan the camera shots
          </button>
        </Section>
      )}

      {scene.markers?.length ? (
        <Section title="Markers">
          {scene.markers.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <Flag className="size-3.5 fill-warn text-warn" />
              <button className="flex-1 truncate text-left hover:text-primary" onClick={() => useStore.getState().setTime(m.t)}>
                {m.label}
              </button>
              <span className="font-mono text-muted-foreground">{m.t.toFixed(2)}s</span>
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  const s = useStore.getState();
                  const next = cloneScene(s.scene);
                  next.markers = next.markers!.filter((_, j) => j !== i);
                  s.commit(next);
                }}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </Section>
      ) : null}
    </>
  );
}
