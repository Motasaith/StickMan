// Long work (building a whole video, installing voice models) runs in the background; the page
// polls the job for its steps and result.

import { randomBytes } from "node:crypto";

export type StepState = "waiting" | "running" | "done" | "failed" | "skipped";

export interface JobStep {
  key: string;
  label: string;
  state: StepState;
  done: number;
  total: number;
  detail?: string;
}

export interface Job<T = unknown> {
  id: string;
  kind: string;
  status: "running" | "done" | "failed" | "cancelled";
  steps: JobStep[];
  notes: string[];
  result?: T;
  error?: string;
  started: number;
  finished?: number;
  cancelled: boolean;
}

export interface JobControl {
  step(key: string, patch: Partial<Omit<JobStep, "key">>): void;
  note(text: string): void;
  /** Throws when the user cancelled, so long loops stop between items. */
  check(): void;
}

// Kept on globalThis: the dev server reloads server modules on every request.
const g = globalThis as unknown as { __stickmanJobs?: Map<string, Job> };
const jobs: Map<string, Job> = (g.__stickmanJobs ??= new Map());

export function startJob<T>(kind: string, steps: Array<{ key: string; label: string }>, run: (ctl: JobControl) => Promise<T>): Job<T> {
  const job: Job<T> = {
    id: `job_${randomBytes(6).toString("hex")}`,
    kind,
    status: "running",
    steps: steps.map((s) => ({ ...s, state: "waiting", done: 0, total: 0 })),
    notes: [],
    started: Date.now(),
    cancelled: false,
  };
  jobs.set(job.id, job as Job);
  const ctl: JobControl = {
    step(key, patch) {
      const s = job.steps.find((x) => x.key === key);
      if (s) Object.assign(s, patch);
    },
    note(text) {
      if (!job.notes.includes(text)) job.notes.push(text);
    },
    check() {
      if (job.cancelled) throw new Error("Cancelled");
    },
  };
  run(ctl)
    .then((result) => {
      job.result = result;
      job.status = "done";
    })
    .catch((err: unknown) => {
      job.status = job.cancelled ? "cancelled" : "failed";
      job.error = err instanceof Error ? err.message : String(err);
      for (const s of job.steps) if (s.state === "running") s.state = "failed";
    })
    .finally(() => {
      job.finished = Date.now();
      // Finished jobs are kept for an hour.
      const old = Date.now() - 3_600_000;
      for (const [id, j] of jobs) if (j.finished && j.finished < old) jobs.delete(id);
    });
  return job;
}

export const getJob = (id: string) => jobs.get(id);

export function cancelJob(id: string) {
  const job = jobs.get(id);
  if (job && job.status === "running") job.cancelled = true;
  return job;
}
