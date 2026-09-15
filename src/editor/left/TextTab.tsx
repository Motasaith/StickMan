import { Hash, Quote } from "lucide-react";
import { useStore } from "@/store";
import { FONT_LIST, fontStack } from "@/engine/fonts";
import { PanelHeader, GroupLabel, addAt } from "./common";

const PRESETS: { label: string; sample: string; make: (id: string, at: number, W: number, H: number) => Record<string, unknown> }[] = [
  { label: "Title", sample: "Big Title", make: (id, at, W, H) => ({ op: "heading", id, text: "Big Title", x: W / 2, y: H * 0.38, size: Math.round(H * 0.12), style: "shadow", color: "#ffffff", font: "poppins", at, enter: "slideUp" }) },
  { label: "Subtitle", sample: "A short subtitle", make: (id, at, W, H) => ({ op: "heading", id, text: "A short subtitle", x: W / 2, y: H * 0.56, size: Math.round(H * 0.055), style: "plain", color: "#ffffff", font: "roboto", at, enter: "fade" }) },
  { label: "Box label", sample: "BREAKING", make: (id, at, W, H) => ({ op: "heading", id, text: "BREAKING NEWS", x: W / 2, y: H * 0.12, size: Math.round(H * 0.06), style: "box", color: "#ffffff", accent: "#E11D48", font: "archivo", at, enter: "pop" }) },
  { label: "Name bar", sample: "Dr. Sara Khan", make: (id, at, W, H) => ({ op: "heading", id, text: "Dr. Sara Khan", subtext: "Family dentist", style: "lowerThird", x: W * 0.06, y: H * 0.74, size: Math.round(H * 0.05), accent: "#0FA3B1", at }) },
  { label: "Highlight", sample: "Key point", make: (id, at, W, H) => ({ op: "heading", id, text: "The key point", x: W / 2, y: H * 0.45, size: Math.round(H * 0.08), style: "highlight", color: "#1a1a1a", accent: "#FFE08A", font: "marker", at, enter: "pop" }) },
  { label: "Outline", sample: "WOW!", make: (id, at, W, H) => ({ op: "heading", id, text: "WOW!", x: W / 2, y: H * 0.4, size: Math.round(H * 0.16), style: "outline", color: "#FFD23F", font: "bebas", at, enter: "pop" }) },
  { label: "Gradient", sample: "Gradient", make: (id, at, W, H) => ({ op: "heading", id, text: "Gradient headline", x: W / 2, y: H * 0.4, size: Math.round(H * 0.1), style: "gradient", color: "#4F7CFF", accent: "#FF6B6B", font: "righteous", at, enter: "slideUp" }) },
  { label: "Typewriter", sample: "Typing…", make: (id, at, W, H) => ({ op: "heading", id, text: "Typing it out, letter by letter", x: W / 2, y: H * 0.45, size: Math.round(H * 0.06), style: "plain", color: "#1a1a1a", font: "mono", at, enter: "typewriter" }) },
];

export function TextTab() {
  const add = (make: (typeof PRESETS)[number]["make"], base = "text") =>
    addAt(base, (id, at, s) => make(id, at, s.scene.width, s.scene.height));
  return (
    <>
      <PanelHeader title="Text" subtitle="Styled titles, name bars and counters. Double-check the words, then animate." />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <GroupLabel>Styles</GroupLabel>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} className="tile h-20" onClick={() => add(p.make)}>
              <span className="text-[15px] font-semibold text-foreground" style={{ fontFamily: fontStack(p.label === "Outline" ? "bebas" : p.label === "Highlight" ? "marker" : "poppins") }}>
                {p.sample}
              </span>
              {p.label}
            </button>
          ))}
        </div>
        <GroupLabel>Numbers and quotes</GroupLabel>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="tile h-20"
            onClick={() => addAt("counter", (id, at, s) => ({ op: "counter", id, to: 95, suffix: "%", x: s.scene.width / 2, y: s.scene.height * 0.36, size: Math.round(s.scene.height * 0.2), color: "#4F7CFF", at, duration: 2 }))}
          >
            <Hash className="size-5 text-primary" /> Counting number
          </button>
          <button
            className="tile h-20"
            onClick={() => addAt("quote", (id, at, s) => ({ op: "heading", id, text: "“Say what you mean.”", x: s.scene.width / 2, y: s.scene.height * 0.42, size: Math.round(s.scene.height * 0.07), style: "plain", color: "#1a1a1a", font: "dmserif", at, enter: "fade" }))}
          >
            <Quote className="size-5 text-primary" /> Quote
          </button>
        </div>
        <GroupLabel>Fonts</GroupLabel>
        <div className="flex flex-col gap-1">
          {FONT_LIST.map((f) => (
            <button
              key={f.id}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-accent"
              onClick={() => {
                const s = useStore.getState();
                const sel = s.selectedId ? s.scene.objects.find((o) => o.id === s.selectedId) : undefined;
                if (sel?.type === "text") s.run([{ op: "edit", id: sel.id, set: { font: f.id } }]);
                else addAt("text", (id, at, st) => ({ op: "heading", id, text: f.label.split(" (")[0], x: st.scene.width / 2, y: st.scene.height * 0.42, size: Math.round(st.scene.height * 0.08), style: "plain", color: "#1a1a1a", font: f.id, at }));
              }}
              title={f.label}
            >
              <span className="text-lg text-foreground" style={{ fontFamily: fontStack(f.id) }}>
                {f.id === "naskh" ? "اردو عربي" : f.id === "nastaliq" ? "خوش آمدید" : "Aa Bb 123"}
              </span>
              <span className="text-[11px] text-muted-foreground">{f.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
