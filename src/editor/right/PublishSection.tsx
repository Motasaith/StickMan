// What to paste into YouTube for an AI video, and what to check before publishing.

import { AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import type { PublishKit } from "@/engine/scene";
import { Section } from "../fields";

function copy(text: string, what: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`Copied the ${what}`),
    () => toast.error("Couldn't copy")
  );
}

function Field({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-md border border-line bg-panel-sunken p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <button className="rounded p-0.5 text-muted-foreground hover:text-foreground" title={`Copy the ${label.toLowerCase()}`} onClick={() => copy(text, label.toLowerCase())}>
          <Copy className="size-3.5" />
        </button>
      </div>
      <p className="whitespace-pre-wrap text-xs leading-5">{text}</p>
    </div>
  );
}

export function PublishSection({ kit }: { kit: PublishKit }) {
  return (
    <Section title="YouTube details">
      {kit.checks.length > 0 && (
        <div className="rounded-md border border-warn/40 bg-warn/10 p-2 text-xs">
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-3.5 text-warn" /> Check before publishing
          </p>
          <ul className="list-disc space-y-0.5 pl-4 leading-5">
            {kit.checks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <Field label="Title" text={kit.title} />
      <Field label="Thumbnail text" text={kit.thumbnailText} />
      <Field label="Description" text={kit.description} />
      <Field label="Tags" text={kit.tags.join(", ")} />
      {kit.credits.length > 0 && <p className="text-[11px] leading-4 text-muted-foreground">Credits: {kit.credits.join("; ")}</p>}
    </Section>
  );
}
