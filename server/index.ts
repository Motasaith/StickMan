// Stickman Studio, an AI video studio that runs on your computer.
// Copyright (c) 2026 Abdul Rauf Azhar <https://github.com/Motasaith>
// Source: https://github.com/Motasaith/StickMan
// SPDX-License-Identifier: AGPL-3.0-or-later
// Keep this notice: AGPL-3.0 sections 5(d) and 7(b), see ATTRIBUTION.md.

// Production server: the built editor plus the AI endpoints. `npm run build && npm start`.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { app as api } from "./app";

const port = Number(process.env.PORT) || 5178;
const root = new Hono();
root.route("/", api);
root.use("/*", serveStatic({ root: "./dist" }));
root.get("*", serveStatic({ path: "./dist/index.html" }));

serve({ fetch: root.fetch, port }, () => console.log(`Stickman Studio on http://localhost:${port}`));
