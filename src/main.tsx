// Stickman Studio, an AI video studio that runs on your computer.
// Copyright (c) 2026 Abdul Rauf Azhar <https://github.com/Motasaith>
// Source: https://github.com/Motasaith/StickMan
// SPDX-License-Identifier: AGPL-3.0-or-later
// Keep this notice: AGPL-3.0 sections 5(d) and 7(b), see ATTRIBUTION.md.

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
const Create = lazy(() => import("@/pages/Create"));
const Voices = lazy(() => import("@/pages/Voices"));
const Settings = lazy(() => import("@/pages/Settings"));
const Legal = lazy(() => import("@/pages/Legal"));

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
            <Route path="/settings" element={<Settings />} />
            <Route path="/create" element={<Create />} />
            <Route path="/voices" element={<Voices />} />
            <Route path="/legal/:page" element={<Legal />} />
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
