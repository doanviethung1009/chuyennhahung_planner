# syntax=docker/dockerfile:1
#
# Chuyện Nhà Hưng — production image. Usage: docs/usage.md → Deploy.
#
#   docker build --build-arg NEXT_PUBLIC_SITE_URL=https://chuyennhahung.vn -t chuyennhahung/app .
#   docker build --target tools -t chuyennhahung/app-tools .   # db:migrate, planner:import/export
#
# Stages: deps (all dependencies) → builder (`next build`, standalone output)
# → runner (the server only, non-root) · tools (scripts that need vite-node).

ARG NODE_VERSION=24.22.2

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
# sharp and other prebuilt binaries expect glibc symbols on Alpine.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# Inlined into the client bundle and baked into canonicals, hreflang and the
# sitemap at build time — a runtime value cannot change it. Required.
ARG NEXT_PUBLIC_SITE_URL
RUN test -n "$NEXT_PUBLIC_SITE_URL" || { echo "build arg NEXT_PUBLIC_SITE_URL is required" >&2; exit 1; }
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

# One-off scripts (`npm run db:migrate`, `planner:import`, `planner:export`)
# run through vite-node, a dev dependency, so they get the full tree.
FROM builder AS tools
ENV NODE_ENV=production
RUN rm -rf .data && mkdir -p .data && chown node:node .data
USER node
CMD ["npm", "run", "db:migrate"]

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Startup migrations read process.cwd()/db/migrations (ADR 0009). Output
# tracing usually carries them; copying states the dependency outright.
COPY --from=builder --chown=node:node /app/db/migrations ./db/migrations
# Story pages render per request (ADR 0012), so the build should leave no
# .data/; clearing it guards against a stray store being traced into the
# image. The runtime store belongs to the mounted volume alone.
RUN rm -rf .data && mkdir -p .data && chown node:node .data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
