// Small controls the editor panels are built from.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";

export const run = (ops: unknown[]) => useStore.getState().run(ops);

/** A titled, collapsible block of controls. */
export function Section({ title, children, defaultOpen = true, actions }: { title: string; children: ReactNode; defaultOpen?: boolean; actions?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line px-4 py-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2 text-left">
          <span className="eyebrow">{title}</span>
          <ChevronDown className={cn("size-3.5 text-muted-foreground transition", !open && "-rotate-90")} />
        </button>
        {actions}
      </div>
      {open && <div className="mt-2.5 flex flex-col gap-1.5">{children}</div>}
    </section>
  );
}

export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="prop-row" title={hint}>
      <span>{label}</span>
      <div className="flex min-w-0 items-center justify-end gap-1.5">{children}</div>
    </label>
  );
}

/** A number box that commits on Enter or blur, and can be dragged left and right to change. */
export function NumField({ value, onCommit, step = 1, min, max, suffix, width = 72 }: { value: number; onCommit: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; width?: number }) {
  const fmt = (v: number) => String(Math.round(v / step) * step === Math.round(v) ? Math.round(v) : Math.round(v * 100) / 100);
  const [draft, setDraft] = useState(fmt(value));
  useEffect(() => setDraft(fmt(value)), [value]);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = () => {
    const v = Number(draft);
    if (Number.isFinite(v) && clamp(v) !== value) onCommit(clamp(v));
    else setDraft(fmt(value));
  };
  const drag = useRef<{ x: number; v: number } | null>(null);
  return (
    <span className="relative inline-flex items-center">
      <input
        className="num-input cursor-ew-resize focus:cursor-text"
        style={{ width }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onCommit(clamp(value + (e.key === "ArrowUp" ? step : -step) * (e.shiftKey ? 10 : 1)));
          }
        }}
        onPointerDown={(e) => {
          if (document.activeElement === e.target) return;
          drag.current = { x: e.clientX, v: value };
          const move = (ev: PointerEvent) => {
            if (!drag.current) return;
            const dx = ev.clientX - drag.current.x;
            if (Math.abs(dx) < 3) return;
            setDraft(fmt(clamp(drag.current.v + Math.round(dx / 2) * step)));
          };
          const up = (ev: PointerEvent) => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            const d = drag.current;
            drag.current = null;
            if (!d) return;
            const dx = ev.clientX - d.x;
            if (Math.abs(dx) >= 3) {
              onCommit(clamp(d.v + Math.round(dx / 2) * step));
              (e.target as HTMLInputElement).blur();
            }
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-2 text-[10px] text-muted-foreground">{suffix}</span>}
    </span>
  );
}

export function TextField({ value, onCommit, placeholder, multiline, rows = 3 }: { value: string; onCommit: (v: string) => void; placeholder?: string; multiline?: boolean; rows?: number }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onCommit(draft);
  if (multiline)
    return (
      <textarea
        className="w-full resize-y rounded-md border border-input bg-panel-sunken px-2.5 py-2 text-[13px] leading-relaxed text-foreground outline-none focus:border-ring"
        rows={rows}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    );
  return <input className="field-text" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />;
}

export function toHex(color: string | null | undefined): string {
  if (!color) return "#000000";
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${[...color.slice(1)].map((c) => c + c).join("")}`;
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  return /^#[0-9a-f]{6}$/i.test(ctx.fillStyle) ? ctx.fillStyle : "#000000";
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Color pickers fire on every movement; commit when the pointer settles.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [local, setLocal] = useState(toHex(value));
  useEffect(() => setLocal(toHex(value)), [value]);
  return (
    <span className="flex items-center gap-1.5">
      <input
        type="color"
        className="h-7 w-9"
        value={local}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(v), 150);
        }}
      />
      <span className="w-[60px] font-mono text-[11px] uppercase text-muted-foreground">{local}</span>
    </span>
  );
}

export function SelectField<T extends string>({ value, options, onChange, width }: { value: T; options: readonly (T | { value: T; label: string })[]; onChange: (v: T) => void; width?: number }) {
  return (
    <select className="select-native" style={width ? { width } : undefined} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

export function SliderRow({ label, value, min, max, step = 1, onCommit, format }: { label: string; value: number; min: number; max: number; step?: number; onCommit: (v: number) => void; format?: (v: number) => string }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <label className="prop-row">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="range"
          className="h-1 w-28 cursor-pointer accent-[hsl(var(--primary))]"
          min={min}
          max={max}
          step={step}
          value={local}
          onChange={(e) => setLocal(Number(e.target.value))}
          onPointerUp={() => local !== value && onCommit(local)}
          onKeyUp={() => local !== value && onCommit(local)}
        />
        <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">{format ? format(local) : Math.round(local * 100) / 100}</span>
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-line bg-panel-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn("rounded px-2.5 py-1 text-xs transition", value === o.value ? "bg-panel-raised text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="prop-row cursor-pointer" title={hint}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 rounded-full transition", checked ? "bg-primary" : "bg-panel-raised border border-line")}
      >
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-background shadow transition", checked ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-[12px] leading-relaxed text-muted-foreground">{children}</p>;
}
