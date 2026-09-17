// Creative Commons music from Openverse: hear it, then add it under the whole video.

import { useRef, useState } from "react";
import { Loader2, Pause, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, assetFromUpload, type MusicItem } from "@/lib/api";
import { useStore } from "@/store";
import { uniqueId } from "@/engine/scene";
import { SearchBox } from "./common";

const MOODS = ["cinematic ambient", "upbeat corporate", "calm piano", "lofi chill", "dark suspense", "epic orchestral", "acoustic happy"];

export function MusicSearch() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MusicItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const search = async (query = q) => {
    if (!query.trim()) return;
    setQ(query);
    setBusy(true);
    try {
      setItems((await api.musicSearch(query.trim())).items);
    } catch (err) {
      toast.error("Music search failed", { description: (err as Error).message });
      setItems([]);
    } finally {
      setBusy(false);
    }
  };

  const hear = (it: MusicItem) => {
    audio.current?.pause();
    if (playing === it.id) {
      setPlaying(null);
      return;
    }
    const el = new Audio(it.src);
    el.volume = 0.7;
    el.onended = () => setPlaying(null);
    void el.play().catch(() => toast.error("Couldn't play that preview"));
    audio.current = el;
    setPlaying(it.id);
  };

  const add = async (it: MusicItem) => {
    setAdding(it.id);
    try {
      const up = await api.mediaImport({ src: it.src, credit: it.credit, kind: "audio" }, it.title.slice(0, 40), "music");
      const asset = assetFromUpload(up, it.title);
      const s = useStore.getState();
      s.addAsset(asset);
      const id = uniqueId(s.scene, "music");
      const length = Math.min(asset.duration ?? it.duration, Math.max(1, s.scene.duration));
      s.run([{ op: "audio", id, asset: asset.id, role: "music", start: 0, duration: length, volume: 0.15, fadeIn: 1.5, fadeOut: 2.5 }]);
      toast.success("Music added under the video", { description: `${it.credit}. The credit is kept with the file.` });
    } catch (err) {
      toast.error("Couldn't add that track", { description: (err as Error).message });
    } finally {
      setAdding(null);
    }
  };

  return (
    <div>
      <SearchBox value={q} onChange={setQ} placeholder="Search music: calm piano, epic…" onEnter={() => search()} />
      <div className="mt-2 flex flex-wrap gap-1">
        {MOODS.map((m) => (
          <button key={m} className="chip" onClick={() => search(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {busy && <Loader2 className="mx-auto my-3 size-4 animate-spin text-muted-foreground" />}
        {!busy && items?.length === 0 && <p className="text-xs text-muted-foreground">No tracks found.</p>}
        {!busy &&
          items?.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded-md border border-line bg-panel-sunken px-2 py-1.5" title={it.credit}>
              <button className="rounded-full bg-panel-raised p-1.5 hover:bg-primary hover:text-primary-foreground" onClick={() => hear(it)}>
                {playing === it.id ? <Pause className="size-3" /> : <Play className="size-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px]">{it.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {Math.round(it.duration)}s · {it.license}
                </p>
              </div>
              <button className="rounded p-1 hover:bg-accent" title="Add under the video" disabled={!!adding} onClick={() => add(it)}>
                {adding === it.id ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
