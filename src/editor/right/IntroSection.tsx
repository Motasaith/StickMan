// Add, swap or remove the animated intro and outro of the open video.

import { useState } from "react";
import { useStore } from "@/store";
import { IntroPicker } from "@/create/IntroPicker";
import { Row, Section, TextField, run } from "../fields";

export function IntroSection() {
  const scene = useStore((s) => s.scene);
  const hasIntro = !!scene.slides?.some((s) => s.id === "intro");
  const hasOutro = !!scene.slides?.some((s) => s.id === "outro");
  const [title, setTitle] = useState(scene.publish?.thumbnailText || scene.title || "My video");
  const [channel, setChannel] = useState("");
  const [picked, setPicked] = useState<{ intro: string | null; outro: string | null }>({ intro: null, outro: null });
  const vertical = scene.height > scene.width;
  const card = { title, channel: channel || undefined, accent: "#F59E0B" };

  if (scene.mode === "3d") return null;
  return (
    <Section title="Intro and outro" id="intro" highlight defaultOpen={!!scene.publish}>
      <Row label="Title">
        <TextField value={title} onCommit={setTitle} />
      </Row>
      <Row label="Channel">
        <TextField value={channel} placeholder="Your channel" onCommit={setChannel} />
      </Row>
      <p className="text-[11px] text-muted-foreground">Intro{hasIntro ? " (click another to swap, or No intro to remove)" : ""}</p>
      <IntroPicker
        kind="intro"
        value={picked.intro}
        vertical={vertical}
        title={title}
        channel={channel}
        accent={card.accent}
        onChange={(id) => {
          setPicked((p) => ({ ...p, intro: id }));
          if (id) run([{ op: "intro", template: id, ...card }]);
          else if (hasIntro) run([{ op: "removeSlide", id: "intro" }]);
        }}
      />
      <p className="mt-2 text-[11px] text-muted-foreground">Outro</p>
      <IntroPicker
        kind="outro"
        value={picked.outro}
        vertical={vertical}
        title={title}
        channel={channel}
        accent={card.accent}
        onChange={(id) => {
          setPicked((p) => ({ ...p, outro: id }));
          if (id) run([{ op: "outro", template: id, ...card }]);
          else if (hasOutro) run([{ op: "removeSlide", id: "outro" }]);
        }}
      />
    </Section>
  );
}
