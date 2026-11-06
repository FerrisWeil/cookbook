import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import {
  incomingRecipeApiPath,
  isRecipeReadMethod,
  loadWebToken,
  recipeAuthorization,
  shouldAttachWebToken,
} from "./dev-proxy.ts";

const root = dirname(fileURLToPath(import.meta.url));

function webTokenProxy(): Plugin {
  return {
    name: "cookbook-web-token-proxy",
    configureServer(server) {
      loadWebToken(process.env);
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        if (!incomingRecipeApiPath(path)) {
          next();
          return;
        }
        if (!isRecipeReadMethod(req.method ?? "GET")) {
          res.statusCode = 405;
          res.setHeader("allow", "GET, HEAD");
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), webTokenProxy()],
  resolve: {
    alias: {
      "@cookbook/shared": resolve(root, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq, req) => {
            proxyReq.removeHeader("authorization");
            const url = req.url ?? "";
            if (
              shouldAttachWebToken(url) &&
              isRecipeReadMethod(req.method ?? "GET")
            ) {
              proxyReq.setHeader(
                "authorization",
                recipeAuthorization(loadWebToken(process.env)),
              );
            }
          });
        },
      },
    },
  },
});
