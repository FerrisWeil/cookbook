import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ProxyOptions } from "vite";

import {
  browserProxyDecision,
  incomingRecipeApiPath,
  isRecipeFactsPath,
  isSessionApiPath,
  loadWebToken,
  recipeAuthorization,
} from "./dev-proxy.ts";

const root = dirname(fileURLToPath(import.meta.url));

const attachWebToken: NonNullable<ProxyOptions["configure"]> = (proxy) => {
  proxy.on("proxyReq", (proxyReq, req) => {
    proxyReq.removeHeader("authorization");
    const url = req.url ?? "";
    const decision = browserProxyDecision(req.method ?? "GET", url, {
      origin: req.headers.origin,
      host: req.headers.host,
      "content-type": req.headers["content-type"],
      "sec-fetch-site": req.headers["sec-fetch-site"],
    });
    if (decision.allow && decision.attachToken) {
      proxyReq.setHeader(
        "authorization",
        recipeAuthorization(loadWebToken(process.env)),
      );
    }
  });
};

function webTokenProxy(): Plugin {
  return {
    name: "cookbook-web-token-proxy",
    configureServer(server) {
      loadWebToken(process.env);
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        if (
          !incomingRecipeApiPath(path) &&
          !isRecipeFactsPath(path) &&
          !isSessionApiPath(path)
        ) {
          next();
          return;
        }
        const decision = browserProxyDecision(req.method ?? "GET", path, {
          origin: req.headers.origin,
          host: req.headers.host,
          "content-type": req.headers["content-type"],
          "sec-fetch-site": req.headers["sec-fetch-site"],
        });
        if (!decision.allow) {
          res.statusCode = decision.status;
          if (decision.allowHeader) {
            res.setHeader("allow", decision.allowHeader);
          }
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: decision.error }));
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
      "/api/recipes/events": {
        target: "http://127.0.0.1:3000",
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure: attachWebToken,
      },
      "/api": {
        target: "http://127.0.0.1:3000",
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure: attachWebToken,
      },
    },
  },
});
