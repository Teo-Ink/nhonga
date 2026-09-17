# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Builder: install the whole workspace, build shared + api, then use
# `pnpm deploy` to produce a self-contained bundle for the api alone with its
# workspace dependency (@nhonga/shared) copied in and dev dependencies dropped.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Copy only what the install needs first, so a code change does not bust the
# dependency cache layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Now the sources.
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @nhonga/shared build \
 && pnpm --filter @nhonga/api build \
 && pnpm --filter @nhonga/api deploy --prod /out

# ─────────────────────────────────────────────────────────────────────────────
# Runtime: slim, non-root, only the bundle.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# node:*-slim ships a non-root `node` user (uid 1000). Run as it.
COPY --from=builder --chown=node:node /out/node_modules ./node_modules
COPY --from=builder --chown=node:node /out/dist ./dist
COPY --from=builder --chown=node:node /out/package.json ./package.json

USER node
EXPOSE 3000

# Liveness for orchestrators that read HEALTHCHECK. ECS uses its own container
# health check (see the ecs-service module), but this keeps `docker run` honest.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
