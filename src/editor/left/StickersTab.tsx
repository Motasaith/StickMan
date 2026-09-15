import { useMemo, useState } from "react";
import { STICKERS, type Sticker } from "@/engine/stickers";
import { LOOPS } from "@/engine/scene";
import { cn } from "@/lib/utils";
import { PanelHeader, SearchBox, GroupLabel, addAt } from "./common";

const GROUPS: Sticker["group"][] = ["faces", "gestures", "hearts", "symbols", "objects", "nature", "food", "travel"];

export function StickersTab() {
  const [q, setQ] = useState("");
  const [loop, setLoop] = useState<(typeof LOOPS)[number]>("float");
  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? STICKERS.filter((st) => st.name.includes(s) || st.char === q.trim()) : null;
  }, [q]);
  const add = (st: Sticker) =>
    addAt(st.name.split(" ")[0], (id, at, s) => {
      const size = Math.round(Math.min(s.scene.width, s.scene.height) * 0.22);
      return { op: "sticker", id, emoji: st.code, x: s.scene.width / 2 - size / 2, y: s.scene.height / 2 - size / 2, size, at, enter: "pop", loop };
    });
  const grid = (list: Sticker[]) => (
    <div className="grid grid-cols-5 gap-1">
      {list.map((st) => (
        <button key={st.code} title={st.name} onClick={() => add(st)} className="flex aspect-square items-center justify-center rounded-md p-1.5 transition hover:scale-110 hover:bg-accent">
          <img src={`/stickers/${st.code}.svg`} alt={st.char} className="size-full" loading="lazy" />
        </button>
      ))}
    </div>
  );
  return (
    <>
      <PanelHeader title="Stickers" subtitle="Emoji stickers that pop in and keep moving.">
        <SearchBox value={q} onChange={setQ} placeholder="Search: heart, fire, thumbs up…" />
        <div className="mt-2 flex flex-wrap gap-1">
          {(["none", "float", "pulse", "wiggle", "bounce", "spin", "heartbeat"] as const).map((l) => (
            <button key={l} onClick={() => setLoop(l)} className={cn("chip h-6 px-2 text-[11px]", loop === l && "border-primary text-primary")}>
              {l === "none" ? "still" : l}
            </button>
          ))}
        </div>
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {found ? (
          found.length ? grid(found) : <p className="text-sm text-muted-foreground">No sticker called that.</p>
        ) : (
          GROUPS.map((g) => (
            <div key={g}>
              <GroupLabel>{g}</GroupLabel>
              {grid(STICKERS.filter((s) => s.group === g))}
            </div>
          ))
        )}
        <p className="mt-4 text-[10px] text-muted-foreground">Emoji graphics by Twemoji, CC-BY 4.0</p>
      </div>
    </>
  );
}
