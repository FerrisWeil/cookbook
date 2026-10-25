FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/mcp/package.json apps/mcp/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/mcp apps/mcp
RUN npm run build -w @cookbook/shared && npm run build -w @cookbook/mcp

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/mcp/package.json apps/mcp/
RUN npm ci --omit=dev
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/mcp/dist apps/mcp/dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=8 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/mcp/dist/index.js"]
