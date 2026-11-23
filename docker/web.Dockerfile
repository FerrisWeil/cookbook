FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/mcp/package.json apps/mcp/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/test/package.json packages/test/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/ui packages/ui
COPY apps/web apps/web
RUN pnpm --filter @cookbook/web build

FROM nginx:1.31.9-alpine@sha256:fb4658584bd9a916ffb6f6e365f97c25cfdb2923801f551ea08356e695f14ff7
RUN apk add --no-cache wget
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=8 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
