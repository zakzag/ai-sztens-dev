# ---------------------------------------------------------------------------
# AIsztens — public website SPA (Vite + React).
#
# Multi-stage build:
#   build   — pnpm workspace build of @callback/web with the production API
#             base URL injected through a build ARG.
#   runtime — nginx:1.27-alpine serving the static dist/ output.
#
# Build context MUST be the repository root (the pnpm workspace spans
# apps/* and packages/shared):
#   docker build -f infra/web/Dockerfile .
#
# Required build args:
#   APP_ENV            — dev | prod; selects the `build:${APP_ENV}` Vite mode
#                        and the apps/web/.env.${APP_ENV} per-env file.
#   VITE_API_BASE_URL  — the public URL the SPA calls. Injected as
#                        `import.meta.env.VITE_API_BASE_URL`; Vite gives
#                        process environment precedence over .env files, so
#                        the value passed here wins without baking a .env
#                        into the image.
# ---------------------------------------------------------------------------

# --- Build stage -----------------------------------------------------------
FROM node:22-bookworm-slim AS build

# pnpm 9 matches the lockfile (pnpm 10+ would reject some workspace tooling
# build scripts with ERR_PNPM_IGNORED_BUILDS). Corepack avoids a global
# install and pins the exact version.
RUN corepack enable \
 && corepack prepare pnpm@9.15.4 --activate

WORKDIR /workspace

# Copy workspace manifests first for dependency layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
# The workspace glob (apps/*) resolves all package.json files, so every
# manifest that pnpm can ever need must exist before `pnpm install`.
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/tsconfig.json apps/web/tsconfig.json

RUN pnpm install --frozen-lockfile

# Copy sources and build in topological order (shared first, then web).
COPY packages/shared/src packages/shared/src
COPY apps/web apps/web

ARG APP_ENV=dev
ARG VITE_API_BASE_URL

# Export the build-time env so Vite resolves it. Vite's loadEnv gives
# pre-existing process variables precedence over .env files, which is
# exactly what we want for an image-based deploy: no per-env .env is
# required inside the image.
ENV APP_ENV=${APP_ENV} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm --filter @callback/shared build \
 && pnpm --filter @callback/web "build:${APP_ENV}"

# --- Runtime stage ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Default config + ours (we replace only the default site to keep nginx
# startup behaviour intact: CMD ["nginx", "-g", "daemon off;"]).
COPY infra/web/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 80
