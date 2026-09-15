import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { flushSave } from "@/store";

/** Shows what broke instead of a blank page, with the work saved first. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Editor crashed:", error);
    void flushSave().catch(() => undefined);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center text-foreground">
        <AlertTriangle className="size-8 text-warn" />
        <p className="text-lg font-medium">Something went wrong in the editor.</p>
        <p className="max-w-md font-mono text-xs text-muted-foreground">{this.state.error.message}</p>
        <p className="text-sm text-muted-foreground">Your project was saved. Reloading usually fixes it.</p>
        <button className="rounded-md border border-line px-4 py-2 text-sm hover:bg-accent" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
