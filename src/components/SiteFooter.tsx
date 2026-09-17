// The footer on every page outside the editor: what the studio is, where things are, the legal
// pages, and who built it.

import { Link } from "react-router";
import { Logo } from "@/editor/Logo";

export const AUTHOR = { name: "Abdul Rauf Azhar", github: "https://github.com/Motasaith" };

export function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Create",
    links: [
      { label: "AI video maker", to: "/create" },
      { label: "Voice studio", to: "/voices" },
      { label: "Live editor demo", to: "/#demo" },
      { label: "Templates", to: "/#templates" },
    ],
  },
  {
    title: "AI tools",
    links: [
      { label: "AI Director", to: "/#ai" },
      { label: "Thumbnails and Shorts", to: "/#ai" },
      { label: "AI pictures and drawings", to: "/#ai" },
      { label: "Animated intros", to: "/#ai" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", to: "/legal/privacy" },
      { label: "Terms of use", to: "/legal/terms" },
      { label: "Credits and licenses", to: "/legal/credits" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Logo className="h-7" />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            An AI video studio that runs on your computer. Turn an idea, a script or your own recording into an edited video, then change anything on a real timeline.
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Your projects, media and voices stay in a folder on this machine. No account needed.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="eyebrow mb-3">{c.title}</p>
            <ul className="space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.to.includes("#") ? (
                    <a href={l.to} className="text-muted-foreground transition hover:text-foreground">
                      {l.label}
                    </a>
                  ) : (
                    <Link to={l.to} className="text-muted-foreground transition hover:text-foreground">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-6 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} Stickman Studio. Open source under the{" "}
            <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
              GNU AGPL v3
            </a>
            .
          </p>
          <a href={AUTHOR.github} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 text-sm text-foreground">
            <span>
              Built by <span className="font-semibold group-hover:text-primary">{AUTHOR.name}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs transition group-hover:border-foreground">
              <GithubMark className="size-3.5" /> Motasaith
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
