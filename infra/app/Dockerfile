# ---------------------------------------------------------------------------
# Callback Assistant API image (NestJS + Fastify, pnpm monorepo).
#
# Build context MUST be the repository root:
#   docker build -f infra/app/Dockerfile .
#
# The image runs the package's own `start:prod` script so the entry point never
# drifts from what `apps/api/package.json` defines.
# ---------------------------------------------------------------------------

# --- Build stage: restore the whole workspace, compile shared + api ----------
FROM node:22-bookworm-slim AS build

# pnpm comes from Corepack (no global install needed). Pin pnpm 9 because the
# lockfile is v9; pnpm 12 would fail on unapproved dependency build scripts
# (ERR_PNPM_IGNORED_BUILDS) for the frontend tooling (esbuild, etc.).
RUN corepack enable \
 && corepack prepare pnpm@9.15.4 --activate

WORKDIR /workspace

# Copy workspace manifests first for dependency layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY apps/api/package.json apps/api/package.json
COPY apps/api/nest-cli.json apps/api/nest-cli.json
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/tsconfig.build.json apps/api/tsconfig.build.json
# The workspace glob (apps/*) also references these packages; their manifests
# must exist so `pnpm install --frozen-lockfile` can resolve the lockfile.
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json

RUN pnpm install --frozen-lockfile

# Copy sources and build in topological order (shared first, then api).
COPY packages/shared/src packages/shared/src
COPY apps/api/src apps/api/src

RUN pnpm --filter @callback/shared build \
 && pnpm --filter @callback/api build

# --- Runtime stage ----------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

RUN corepack enable \
 && corepack prepare pnpm@9.15.4 --activate

ENV NODE_ENV=production
WORKDIR /workspace

# Copy the built workspace: node_modules (with workspace symlinks resolved),
# manifests, the compiled shared package and the compiled api package.
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/package.json /workspace/pnpm-workspace.yaml /workspace/pnpm-lock.yaml ./
COPY --from=build /workspace/packages/shared ./packages/shared
COPY --from=build /workspace/apps/api ./apps/api

# The app binds to PORT (default 3000) and serves everything under /api.
EXPOSE 3000

# Non-root runtime user where possible; create a dedicated one.
RUN groupadd --system --gid 1001 nodeapp \
 && useradd --system --uid 1001 --gid nodeapp --home-dir /workspace nodeapp \
 && chown -R nodeapp:nodeapp /workspace
USER nodeapp

CMD ["pnpm", "--filter", "@callback/api", "start:prod"]
