import { useEffect, useState } from "react";
import { Bookmark, Clock, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { flushSave, useStore } from "@/store";
import type { Scene } from "@/engine/scene";

export function VersionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const projectId = useStore((s) => s.projectId);
  const [versions, setVersions] = useState<{ id: string; at: number; label: string | null; auto: boolean }[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!projectId) return;
    await api.listVersions(projectId).then(setVersions).catch(() => setVersions([]));
  };
  useEffect(() => {
    if (open) {
      setVersions(null);
      void flushSave().then(load);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    if (!projectId || !label.trim()) return;
    setBusy("save");
    try {
      await flushSave();
      await api.addVersion(projectId, label.trim());
      setLabel("");
      await load();
      toast.success("Version saved");
    } catch (err) {
      toast.error("Couldn't save the version", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const restore = async (vid: string) => {
    if (!projectId) return;
    setBusy(vid);
    try {
      const v = await api.getVersion(projectId, vid);
      const s = useStore.getState();
      s.addAssets(v.assets ?? []);
      // Restoring is one undo step, so it can be taken back.
      s.commit(v.scene as Scene);
      toast.success("Version restored", { description: "Undo takes you back to where you were." });
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't restore it", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Version history</DialogTitle>
          <DialogDescription>Saved automatically every ten minutes while you work, plus the ones you name.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <input className="text-input" placeholder="Name this version…" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} />
          <Button size="sm" onClick={save} disabled={!label.trim() || busy === "save"}>
            {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Bookmark className="size-4" />} Save
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {versions === null ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 border-b border-line py-2 text-sm last:border-0">
                {v.auto ? <Clock className="size-4 text-muted-foreground" /> : <Bookmark className="size-4 text-primary" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate">{v.label ?? "Automatic save"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(v.at).toLocaleString()}</p>
                </div>
                <Button variant="outline" size="sm" disabled={!!busy} onClick={() => restore(v.id)}>
                  {busy === v.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
