import { useState } from "react";
import { Loader2, Mic, Play } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { TRANSITIONS, VOICE_IDS, cloneScene, type AudioObj, type Slide } from "@/engine/scene";
import { themeById } from "@/engine/themes";
import { VOICES } from "@/engine/voices";
import { speechSeconds } from "@/engine/slides";
import { estimateWords } from "@/engine/media";
import { generateVoices } from "@/voice";
import { playClip } from "@/audio";
import { ColorInput, NumField, Row, Section, SelectField, SliderRow, Segmented, TextField, Note, run } from "../fields";

const TRANSITION_LABEL: Record<string, string> = { cut: "Cut", fade: "Fade", slideLeft: "Slide in from right", slideRight: "Slide in from left", slideUp: "Slide up", slideDown: "Slide down", push: "Push", zoom: "Zoom", wipe: "Wipe", circle: "Circle reveal", blur: "Blur", flip: "Flip" };

export function SlidePanel({ slide }: { slide: Slide }) {
  const scene = useStore((s) => s.scene);
  const assets = useStore((s) => s.assets);
  const index = scene.slides!.findIndex((s) => s.id === slide.id);
  const theme = themeById(scene.theme);
  const voice = scene.objects.find((o): o is AudioObj => o.type === "audio" && o.role === "narration" && o.slide === slide.id);
  const [busy, setBusy] = useState(false);
  const bg = slide.background;

  const setNarration = (text: string) => {
    const s = useStore.getState();
    if (voice) {
      if (!text.trim()) s.run([{ op: "remove", id: voice.id }]);
      else s.run([{ op: "edit", id: voice.id, set: { text } }]);
      return;
    }
    if (!text.trim()) return;
    // A slide without narration gets a new clip where its content has arrived.
    const next = cloneScene(s.scene);
    const start = Math.round((slide.start + slide.transition.duration * 0.5 + 0.35) * 100) / 100;
    const duration = speechSeconds(text);
    next.objects.push({
      id: `${slide.id}_voice`,
      name: `Narration: ${text.slice(0, 24)}`,
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      opacity: 1,
      tracks: {},
      type: "audio",
      asset: null,
      role: "narration",
      start,
      duration,
      in: 0,
      speed: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      text,
      voice: "narrator",
      words: estimateWords(text, start, duration),
      slide: slide.id,
    });
    s.commit(next);
  };

  const record = async () => {
    if (!voice) return;
    setBusy(true);
    try {
      const r = await generateVoices(voice.id);
      if (r.failed.length) toast.error("Couldn't record the voice", { description: r.failed[0] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <p className="eyebrow">
          Slide {index + 1} of {scene.slides!.length} · {slide.layout}
        </p>
        <div className="mt-1">
          <TextField value={slide.title} onCommit={(v) => run([{ op: "updateSlide", id: slide.id, title: v }])} />
        </div>
      </div>
      <Section title="Timing">
        <Row label="Length">
          <NumField value={Math.round(slide.duration * 10) / 10} step={0.5} min={1} suffix="s" onCommit={(v) => run([{ op: "updateSlide", id: slide.id, duration: v }])} />
        </Row>
        {index > 0 && (
          <>
            <Row label="Arrives with">
              <SelectField value={slide.transition.kind} options={TRANSITIONS.map((t) => ({ value: t, label: TRANSITION_LABEL[t] ?? t }))} onChange={(v) => run([{ op: "updateSlide", id: slide.id, transition: v }])} />
            </Row>
            <SliderRow label="Transition" value={slide.transition.duration} min={0} max={2} step={0.1} onCommit={(v) => run([{ op: "updateSlide", id: slide.id, transitionDuration: v }])} format={(v) => `${v.toFixed(1)}s`} />
          </>
        )}
      </Section>

      <Section title="Narration">
        <TextField multiline rows={4} value={voice?.text ?? slide.notes ?? ""} placeholder="What the narrator says on this slide…" onCommit={setNarration} />
        {voice && (
          <>
            <Row label="Voice">
              <SelectField value={voice.voice ?? "narrator"} options={VOICE_IDS.map((v) => ({ value: v, label: VOICES[v].label }))} onChange={(v) => run([{ op: "edit", id: voice.id, set: { voice: v } }])} />
            </Row>
            <div className="flex items-center gap-2">
              <button className="chip" disabled={busy} onClick={record}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Mic className="size-3.5" />} {voice.asset ? "Record again" : "Record voice"}
              </button>
              {voice.asset && (
                <button
                  className="chip"
                  onClick={() => {
                    const a = assets.find((x) => x.id === voice.asset);
                    if (a) void playClip(a);
                  }}
                >
                  <Play className="size-3.5" /> Hear it
                </button>
              )}
              <span className="text-xs text-muted-foreground">{voice.asset ? `${voice.duration.toFixed(1)}s` : "not voiced yet"}</span>
            </div>
            <Note>Voices are recorded automatically before export. The slide grows if the voice runs longer.</Note>
          </>
        )}
      </Section>

      <Section title="Background">
        <Row label="Style">
          <Segmented
            value={bg.kind === "image" ? "color" : bg.kind}
            options={[
              { value: "color", label: "Color" },
              { value: "gradient", label: "Gradient" },
            ]}
            onChange={(k) => run([{ op: "updateSlide", id: slide.id, background: k === "gradient" ? theme.cover.kind === "gradient" ? theme.cover : { kind: "gradient", from: theme.accent, to: theme.accent2, angle: 135 } : { kind: "color", color: bg.kind === "gradient" ? bg.from : theme.background.kind === "color" ? theme.background.color : "#ffffff" } }])}
          />
        </Row>
        {bg.kind === "color" && (
          <Row label="Color">
            <ColorInput value={bg.color} onChange={(c) => run([{ op: "updateSlide", id: slide.id, background: { kind: "color", color: c } }])} />
          </Row>
        )}
        {bg.kind === "gradient" && (
          <>
            <Row label="From">
              <ColorInput value={bg.from} onChange={(c) => run([{ op: "updateSlide", id: slide.id, background: { ...bg, from: c } }])} />
            </Row>
            <Row label="To">
              <ColorInput value={bg.to} onChange={(c) => run([{ op: "updateSlide", id: slide.id, background: { ...bg, to: c } }])} />
            </Row>
          </>
        )}
        <div className="flex gap-1.5">
          <button className="chip" onClick={() => run([{ op: "updateSlide", id: slide.id, background: theme.cover }])}>
            Theme cover
          </button>
          <button className="chip" onClick={() => run([{ op: "updateSlide", id: slide.id, background: theme.background }])}>
            Theme content
          </button>
        </div>
      </Section>
      <div className="px-4 pt-3">
        <button className="chip hover:text-destructive" onClick={() => run([{ op: "removeSlide", id: slide.id }])}>
          Remove this slide
        </button>
      </div>
    </>
  );
}
