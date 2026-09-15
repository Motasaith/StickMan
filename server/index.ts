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
