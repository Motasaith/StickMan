import { useMemo, useState } from "react";
import { Captions, Loader2, Mic, Play } from "lucide-react";
import { toast } from "sonner";
import { AUDIO_ROLES, cloneScene, uniqueId, type AudioObj } from "@/engine/scene";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { generateVoices } from "@/voice";
import { playClip } from "@/audio";
import { NumField, Row, Section, SelectField, SliderRow, TextField, Note, run } from "../../fields";
import { VoiceSelect } from "../../VoiceSelect";

export function AudioSection({ obj }: { obj: AudioObj }) {
  const asset = useStore((s) => s.assets.find((a) => a.id === obj.asset));
  // Select the stable objects list; filtering inside the selector would make a new array every render.
  const objects = useStore((s) => s.scene.objects);
  const speakers = useMemo(() => objects.filter((o) => o.type === "stickman" || o.type === "creature"), [objects]);
  const edit = (set: Record<string, unknown>) => run([{ op: "edit", id: obj.id, set }]);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState("english");
  const narration = obj.role === "narration";

  const captionsFromSpeech = async () => {
    if (!obj.asset) return;
    setBusy(true);
    const t = toast.loading("Listening…", { description: "The first time downloads the speech model." });
    try {
      const { words } = await api.transcribe(obj.asset, lang, obj.in, obj.in + obj.duration * obj.speed);
      const s = useStore.getState();
      const next = cloneScene(s.scene);
      const target = next.objects.find((o) => o.id === obj.id) as AudioObj;
      target.words = words.map((w) => ({ text: w.text, start: obj.start + (w.start - obj.in) / obj.speed, end: obj.start + (w.end - obj.in) / obj.speed }));
      next.objects.push({
        id: uniqueId(next, `${obj.id}_captions`),
        name: `Captions: ${obj.name}`,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        tracks: {},
        type: "caption",
        words: target.words.map((w) => ({ ...w })),
        source: obj.id,
        style: "highlight",
        position: "bottom",
        font: "poppins",
        size: Math.round(Math.min(next.width, next.height) * 0.05),
        color: "#FFFFFF",
        accent: "#FFC857",
        maxChars: next.height > next.width ? 22 : 40,
      });
      s.commit(next);
      toast.success(`Captions added: ${words.length} words`, { id: t });
    } catch (err) {
      toast.error("Couldn't make captions", { id: t, description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={narration ? "Narration" : "Sound clip"}>
      {narration && (
        <>
          <TextField multiline rows={4} value={obj.text ?? ""} placeholder="The words to speak…" onCommit={(v) => edit({ text: v })} />
          <Row label="Voice">
            <VoiceSelect value={obj.voice ?? "narrator"} onChange={(v) => edit({ voice: v })} />
          </Row>
          <Row label="Lips move on">
            <SelectField value={obj.speaker ?? ""} options={[{ value: "", label: "Nobody (off screen)" }, ...speakers.map((o) => ({ value: o.id, label: o.name }))]} onChange={(v) => {
              const s = useStore.getState();
              const next = cloneScene(s.scene);
              const t = next.objects.find((o) => o.id === obj.id) as AudioObj;
              t.speaker = v || null;
              // Lip sync needs a loudness envelope, made when the voice is recorded.
              if (v && t.asset && !t.envelope) t.asset = null;
              s.commit(next);
            }} />
          </Row>
          <div className="flex items-center gap-2">
            <button
              className="chip"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (obj.asset) {
                    const st = useStore.getState();
                    const next = cloneScene(st.scene);
                    const t = next.objects.find((o) => o.id === obj.id) as AudioObj;
                    t.asset = null;
                    st.commit(next);
                  }
                  const r = await generateVoices(obj.id);
                  if (r.failed.length) toast.error("Couldn't record", { description: r.failed[0] });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Mic className="size-3.5" />} {obj.asset ? "Record again" : "Record voice"}
            </button>
            {asset && (
              <button className="chip" onClick={() => void playClip(asset)}>
                <Play className="size-3.5" /> Hear
              </button>
            )}
          </div>
          {!obj.asset && <Note>Not voiced yet. It's recorded automatically before export.</Note>}
        </>
      )}
      {!narration && (
        <Row label="Kind">
          <SelectField value={obj.role} options={AUDIO_ROLES.filter((role) => role !== "music")} onChange={(v) => edit({ role: v })} />
        </Row>
      )}
      <div className="grid grid-cols-2 gap-x-3">
        <Row label="Starts">
          <NumField value={Math.round(obj.start * 100) / 100} step={0.1} min={0} width={64} suffix="s" onCommit={(v) => run([{ op: "trim", id: obj.id, start: v }])} />
        </Row>
        <Row label="Length">
          <NumField value={Math.round(obj.duration * 100) / 100} step={0.1} min={0.1} width={64} suffix="s" onCommit={(v) => run([{ op: "trim", id: obj.id, duration: v }])} />
        </Row>
      </div>
      <SliderRow label="Volume" value={obj.volume} min={0} max={2} step={0.05} onCommit={(v) => edit({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <div className="grid grid-cols-2 gap-x-3">
        <Row label="Fade in">
          <NumField value={obj.fadeIn} step={0.1} min={0} max={10} width={56} suffix="s" onCommit={(v) => edit({ fadeIn: v })} />
        </Row>
        <Row label="Fade out">
          <NumField value={obj.fadeOut} step={0.1} min={0} max={10} width={56} suffix="s" onCommit={(v) => edit({ fadeOut: v })} />
        </Row>
      </div>
      {obj.asset && !narration && (
        <>
          <p className="eyebrow mt-3">Captions from speech</p>
          <Row label="Language">
            <SelectField value={lang} options={["english", "urdu", "hindi", "arabic", "spanish", "french", "german"]} onChange={setLang} />
            <button className="chip" disabled={busy} onClick={captionsFromSpeech}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Captions className="size-3.5" />} Make
            </button>
          </Row>
        </>
      )}
      {narration && !useStore.getState().scene.objects.some((o) => o.type === "caption" && o.source === "narration") && (
        <button className="chip mt-1" onClick={() => run([{ op: "captions", from: "narration", style: "highlight" }])}>
          <Captions className="size-3.5" /> Show captions for narration
        </button>
      )}
    </Section>
  );
}
