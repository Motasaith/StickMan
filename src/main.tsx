import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Projects from "@/pages/Projects";
import "./index.css";
import { installDebugHandle } from "./debug";
import { loadFonts } from "./fonts";

const Editor = lazy(() => import("@/pages/Editor"));

if (import.meta.env.DEV) installDebugHandle();
void loadFonts();

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Projects />} />
            <Route
              path="/editor/:projectId"
              element={
                <ErrorBoundary>
                  <Editor />
                </ErrorBoundary>
              }
            />
            <Route path="*" element={<Projects />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  </StrictMode>
);
