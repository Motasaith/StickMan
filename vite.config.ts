import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { getRequestListener } from "@hono/node-server";

/** Serve the AI endpoints from the dev server, reloading server code on each request. */
function apiPlugin(): Plugin {
  return {
    name: "stickman-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          const mod = (await server.ssrLoadModule("/server/app.ts")) as typeof import("./server/app");
          await getRequestListener(mod.app.fetch)(req, res);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: { port: 5178 },
});
