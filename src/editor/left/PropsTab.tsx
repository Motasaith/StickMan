import { PROP_KINDS } from "@/engine/props";
import { LIGHTING_PRESETS } from "@/engine/scene";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { PanelHeader, GroupLabel, addAt } from "./common";

const ICON: Record<string, string> = {
  house: "\u{1F3E0}", shop: "\u{1F3EA}", building: "\u{1F3E2}", tree: "\u{1F333}", pine: "\u{1F332}", bush: "\u{1F33F}", rock: "\u{26F0}\u{FE0F}", flowers: "\u{1F337}",
  table: "\u{1FA91}", chair: "\u{1FA91}", stool: "\u{1FA91}", bench: "\u{1FA91}", sofa: "\u{1F6CB}", bed: "\u{1F6CF}", desk: "\u{1F5A5}", bookshelf: "\u{1F4DA}", shelf: "\u{1F4E6}",
  counter: "\u{1F37D}", stove: "\u{1F373}", fridge: "\u{1F9CA}", lamp: "\u{1F4A1}", streetlight: "\u{1F6A6}", tv: "\u{1F4FA}", plant: "\u{1F331}", car: "\u{1F697}", fence: "\u{1F6A7}",
  wall: "\u{1F9F1}", door: "\u{1F6AA}", window: "\u{1F5BC}\u{FE0F}", rug: "\u{1F7EB}", road: "\u{1F6E3}", pond: "\u{1F4A7}", mailbox: "\u{1F4EB}", trashcan: "\u{1F5D1}", sign: "\u{1F4CB}",
  blackboard: "\u{1F9D1}‍\u{1F3EB}", cloud: "☁️", mountain: "⛰️", crate: "\u{1F4E6}", barrel: "\u{1F6E2}", tent: "⛺", campfire: "\u{1F525}",
};

export function PropsTab() {
  const is3d = useStore((s) => s.scene.mode === "3d");
  const lighting = useStore((s) => s.scene.lighting ?? "day");
  const look = useStore((s) => s.scene.look3d ?? "soft");
  return (
    <>
      <PanelHeader title="3D sets" subtitle="Real 3D props, lighting and camera shots. They also work in 2D, seen from the front.">
        {!is3d && (
          <button className="chip w-full justify-center" onClick={() => useStore.getState().run([{ op: "scene", mode: "3d" }])}>
            Switch this scene to 3D
          </button>
        )}
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {is3d && (
          <>
            <GroupLabel>Lighting</GroupLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {LIGHTING_PRESETS.map((l) => (
                <button key={l} onClick={() => useStore.getState().run([{ op: "scene", lighting: l }])} className={cn("chip justify-center capitalize", lighting === l && "border-primary text-primary")}>
                  {l}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(["soft", "toon"] as const).map((l) => (
                <button key={l} onClick={() => useStore.getState().run([{ op: "scene", look3d: l }])} className={cn("chip justify-center", look === l && "border-primary text-primary")}>
                  {l === "soft" ? "Soft render" : "Toon outlines"}
                </button>
              ))}
            </div>
            <GroupLabel>Camera</GroupLabel>
            <button className="chip w-full justify-center" onClick={() => useStore.getState().run([{ op: "direct" }])}>
              Plan cinematic shots for the whole film
            </button>
          </>
        )}
        <GroupLabel>Props</GroupLabel>
        <div className="grid grid-cols-3 gap-2">
          {PROP_KINDS.map((k) => (
            <button key={k} className="tile h-16 capitalize" onClick={() => addAt(k, (id, _at, s) => ({ op: "prop", id, kind: k, x: s.scene.width / 2, z: s.scene.mode === "3d" ? -250 : undefined }))}>
              <span className="text-xl">{ICON[k] ?? "\u{1F4E6}"}</span>
              {k}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
