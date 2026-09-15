import { cn } from "@/lib/utils";

/** A little stick figure mid-wave. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="14" cy="7" r="4.5" />
      <path d="M14 11.5v9M14 14.5l-6 3.5M14 14.5l6-5M14 20.5l-4.5 8M14 20.5l4.5 8" />
      <path d="M24 5.5l3-2.5M25.5 9l3.5-.5" stroke="hsl(var(--primary))" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-7 text-foreground" />
      <span className="font-display text-[26px] font-bold leading-none">
        stickman<span className="text-primary">.</span>
      </span>
    </span>
  );
}
