# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Builder: install the workspace, build @nhonga/shared, then build the web app
# as a Next.js standalone bundle (next.config.mjs, NEXT_OUTPUT=standalone).
#
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so
# they are build arguments, and an image is built per environment (the deploy
# workflow tags it <sha>-<environment>).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:25-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @nhonga/web...

COPY packages/shared packages/shared
COPY apps/web apps/web

ARG NEXT_PUBLIC_DEMO_MODE=0
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
ARG NEXT_PUBLIC_ADS_EMAIL=
ARG IMAGE_HOSTS=
ENV NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_ADS_EMAIL=$NEXT_PUBLIC_ADS_EMAIL \
    IMAGE_HOSTS=$IMAGE_HOSTS

RUN pnpm --filter @nhonga/shared build \
 && pnpm --filter @nhonga/web build

# ─────────────────────────────────────────────────────────────────────────────
# Runtime: slim, non-root, only the standalone server plus static assets.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:25-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
