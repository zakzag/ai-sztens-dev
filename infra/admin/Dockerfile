# ---------------------------------------------------------------------------
# AIsztens — admin dashboard SPA (Vite + React).
#
# Mirror of infra/web/Dockerfile: same workspace layout, same build chain,
# same runtime image. The only difference is the filter target
# (@callback/admin instead of @callback/web). The two files are intentionally
# separate so a regression in one does not block the other.
#
# Build context MUST be the repository root:
#   docker build -f infra/admin/Dockerfile .
#
# Required build args:
#   APP_ENV            — dev | prod; selects the `build:${APP_ENV}` Vite mode
#                        and the apps/admin/.env.${APP_ENV} per-env file.
#   VITE_API_BASE_URL  — the public URL the SPA calls. Injected as
#                        `import.meta.env.VITE_API_BASE_URL`; Vite gives
#                        process environment precedence over .env files.
# ---------------------------------------------------------------------------

# --- Build stage -----------------------------------------------------------
FROM node:22-bookworm-slim AS build

RUN corepack enable \
 && corepack prepare pnpm@9.15.4 --activate

WORKDIR /workspace

# Copy workspace manifests first for dependency layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/tsconfig.json apps/admin/tsconfig.json

RUN pnpm install --frozen-lockfile

# Copy sources and build in topological order (shared first, then admin).
COPY packages/shared/src packages/shared/src
COPY apps/admin apps/admin

ARG APP_ENV=dev
ARG VITE_API_BASE_URL

ENV APP_ENV=${APP_ENV} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm --filter @callback/shared build \
 && pnpm --filter @callback/admin "build:${APP_ENV}"

# --- Runtime stage ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY infra/admin/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /workspace/apps/admin/dist /usr/share/nginx/html

EXPOSE 80
