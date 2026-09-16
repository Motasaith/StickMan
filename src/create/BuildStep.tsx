import { useEffect, useState } from "react";
import { Check, CircleDashed, Loader2, MinusCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, type JobView } from "@/lib/api";
import type { Patch, WizardState } from "@/pages/Create";

type Result = { projectId: string; seconds: number; scenes: number; clips: number };

const elapsed = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

export function BuildStep({ state, patch, onOpen }: { state: WizardState; patch: Patch; onOpen: (projectId: string) => void }) {
  const [job, setJob] = useState<JobView<Result> | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!state.job) return;
    let stop = false;
    const tick = async () => {
      try {
        const j = await api.job<Result>(state.job!);
        if (stop) return;
        setJob(j);
        setNow(Date.now());
        if (j.status === "running") setTimeout(tick, 1200);
      } catch (err) {
        if (stop) return;
        toast.error("Lost track of the build", { description: (err as Error).message });
        patch({ job: null, step: 4 });
      }
    };
    void tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.job]);

  // Open the editor a moment after it's done, unless there's something to read first.
  useEffect(() => {
    if (job?.status === "done" && job.result && !job.notes.length) {
      const t = setTimeout(() => onOpen(job.result!.projectId), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  const running = !job || job.status === "running";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="border border-line bg-panel p-6 shadow-[6px_6px_0_0_hsl(var(--line))]">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="eyebrow mb-2">Building</p>
            <h2 className="font-display text-2xl font-semibold">{state.script?.title}</h2>
          </div>
          {job && <span className="font-mono text-xs text-muted-foreground">{elapsed((job.finished ?? now) - job.started)}</span>}
        </div>

        <ol className="space-y-3">
          {(job?.steps ?? []).map((s) => (
            <li key={s.key} className="flex items-start gap-3">
              <span className="mt-0.5">
                {s.state === "done" ? (
                  <Check className="size-4 text-good" />
                ) : s.state === "running" ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : s.state === "failed" ? (
                  <XCircle className="size-4 text-destructive" />
                ) : s.state === "skipped" ? (
                  <MinusCircle className="size-4 text-muted-foreground" />
                ) : (
                  <CircleDashed className="size-4 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className={cn("text-sm", s.state === "waiting" && "text-muted-foreground")}>{s.label}</p>
                  {s.total > 0 && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {s.done}/{s.total}
                    </span>
                  )}
                </div>
                {s.state === "running" && s.total > 0 && (
                  <div className="mt-1.5 h-1 overflow-hidden bg-line">
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((s.done / s.total) * 100)}%` }} />
                  </div>
                )}
                {s.detail && <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>}
              </div>
            </li>
          ))}
          {!job && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
        </ol>

        {job && job.notes.length > 0 && (
          <ul className="mt-5 space-y-1 border border-warn/50 bg-warn/10 p-3 text-xs">
            {job.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        {job?.status === "failed" && <p className="mt-5 border border-destructive/50 bg-destructive/10 p-3 text-sm">{job.error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
          {running ? (
            <>
              <p className="text-xs text-muted-foreground">You can leave this page open; the build keeps going on this computer.</p>
              <Button variant="outline" className="rounded-none" onClick={() => state.job && api.cancelJob(state.job)}>
                Cancel
              </Button>
            </>
          ) : job?.status === "done" && job.result ? (
            <>
              <p className="text-sm">
                {job.result.scenes} scenes, {Math.round(job.result.seconds)}s, {job.result.clips} clips. Edit it by hand or ask the AI Director, then export.
              </p>
              <Button className="rounded-none" onClick={() => onOpen(job.result!.projectId)}>
                Open in the editor
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Your script is kept.</p>
              <Button className="rounded-none" onClick={() => patch({ job: null, step: 4 })}>
                Back to the voice
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
