# Local SonarQube analysis for the monorepo (`pnpm sonar`)

**Date:** 2026-10-22
**Ticket:** AIS-78 · **Plan:** [`docs/plans/2026-10-21--23-55-00-pnpm-sonarqube-scan-plan.md`](../plans/2026-10-21--23-55-00-pnpm-sonarqube-scan-plan.md)
**Spec (living):** [`docs/Specs/SonarQube.md`](../Specs/SonarQube.md)

## 1. Problem / feature

A SonarQube server was already running on the developer machine (`http://localhost:9000`,
version 10.2.1), but the repo had no integration at all: no `sonar-project.properties`, no scanner
invocation, and none of the test suites produced coverage output. Code quality, duplication and
test coverage were unmeasurable, and every review had to guess the coverage of a refactor.

Requirement: one `pnpm` command that analyses the **whole monorepo** and uploads unit-test
coverage, without installing a separate scanner CLI.

## 2. Evidence collected while building it

| Observation                                                                                                                                                                    | Consequence                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm add -Dw` failed with `ERR_PNPM_VIRTUAL_STORE_DIR_MAX_LENGTH_DIFF` then `ERR_PNPM_UNEXPECTED_STORE` (store `E:\.pnpm-store\v11`, local pnpm 9.15.4, default node 20.19.2) | `node_modules` was created by pnpm 11; installs must run with `npx pnpm@11` under Node 26 (`C:\Progs\nodejs`).                                                              |
| `pnpm sonar:coverage` reported `4 package` while five packages emit reports                                                                                                    | Jest resolves `coverageDirectory` relative to `rootDir`, and for `apps/api` that is `src`, so the report landed in `apps/coverage/api`. Fixed with `../../../coverage/api`. |
| A `node:test` case failed for absolute `SF:` entries on Windows                                                                                                                | LCOV values must be normalised to POSIX separators before resolution.                                                                                                       |
| SonarQube 10.2.1 logs `JRE provisioning is NOT supported → Falling back on using sonar-scanner-cli`                                                                            | A local Java 17 is required with a 10.2 server; `@sonar/scan` requests JRE provisioning only on newer servers.                                                              |
| Dummy-token scan reached `Load global settings` and then `401 Not authorized`                                                                                                  | The whole chain (preflight → scanner download → properties → server) is proven; only a real token is missing.                                                               |

## 3. Design rationale

| Decision                                                                          | Why                                                                                                                      | Rejected alternative                                                                                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `@sonar/scan` npm dev dependency, invoked from `scripts/sonar/scan.mjs`           | No container start, no separate CLI install, same invocation locally and in CI                                           | `sonarsource/sonar-scanner-cli` Docker image (extra container, slower); native `sonar-scanner` (machine-specific install) |
| **One** Sonar project (`aisztens`) for the entire monorepo                        | Cross-package duplication and dependency analysis stay visible on a single dashboard                                     | One project per workspace package (hides duplication, N dashboards)                                                       |
| A merge step that rewrites `SF:` paths to repo-root relative before the scan      | SonarQube resolves LCOV paths against the project root; per-package `SF:src/...` entries would never match               | Pointing `sonar.javascript.lcov.reportPaths` at five files (the path base is still global, so 4 of 5 would miss)          |
| Token from `SONAR_TOKEN` / git-ignored `sonar.env`, real env wins                 | No secret in git, but no export needed for daily runs                                                                    | Token in `sonar-project.properties` (leak), prompting on every run (not scriptable)                                       |
| Pre-flight `/api/system/status` before invoking the scanner                       | A stopped or still-starting server fails in milliseconds with an actionable message instead of a 30-second scanner trace | Rely on the scanner's own error output                                                                                    |
| `sonar.qualitygate.wait` off by default, opt-in via `SONAR_QUALITYGATE_WAIT=true` | Local runs should not fail on a red gate; CI can turn it on                                                              | Always waiting (slow local loop)                                                                                          |

## 4. Implementation

| File                                                               | Change                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sonar-project.properties`                                         | New. Project key `aisztens`, sources (`apps/*/src`, `packages/*/src`, `scripts`), test dirs, exclusions (`node_modules`, `dist`, `build`, `coverage`, `*.d.ts`, drizzle meta), CPD + coverage exclusions, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`. |
| `sonar.env.example`                                                | New. Documented template for `SONAR_HOST_URL`, `SONAR_TOKEN`, `SONAR_QUALITYGATE_WAIT`.                                                                                                                                                                           |
| `scripts/sonar/sonar.const.mjs`                                    | New. Defaults: server URL, env-file name, merged LCOV path, coverage targets, `SF:` prefix candidates.                                                                                                                                                            |
| `scripts/sonar/sonar.errors.mjs`                                   | New. `SonarConfigError`, `SonarServerError`, `LcovMergeError`.                                                                                                                                                                                                    |
| `scripts/sonar/scan-config.mjs`                                    | New. Pure helpers: dotenv parsing, env merge (process env wins), URL normalisation, token validation, truthy parsing.                                                                                                                                             |
| `scripts/sonar/scan.mjs`                                           | New. Orchestration: env file → `resolveConfig` → `checkServerStatus` → `@sonar/scan`; CLI entry with non-zero exit on failure; token never logged.                                                                                                                |
| `scripts/sonar/lcov-merge.mjs`                                     | New. Parses LCOV records, resolves each `SF:` to a repo-root relative path (package dir, package `src`, repo root candidates), dedupes, writes `coverage/lcov.info`, warns on unresolvable paths.                                                                 |
| `scripts/sonar/{lcov-merge,scan-config,scan}.test.mjs`             | New. 43 `node:test` cases: path rewriting (relative/backslash/absolute/missing), LCOV parsing, dedupe, merge, env parsing, config validation, server states, scan orchestration.                                                                                  |
| `scripts/sonar/README.md`, `scripts/README.md`                     | New folder doc + index entry.                                                                                                                                                                                                                                     |
| `package.json` (root)                                              | `sonar`, `sonar:coverage`, `sonar:scan`, `sonar:test` scripts; `@sonar/scan` devDependency.                                                                                                                                                                       |
| `packages/shared/package.json`, `packages/api-client/package.json` | `test:cov` (jest, LCOV to `coverage/<pkg>`).                                                                                                                                                                                                                      |
| `apps/api/package.json`                                            | `test:cov` writes `coverage/api` (path relative to `rootDir`), `coveragePathIgnorePatterns` for `/test/`.                                                                                                                                                         |
| `packages/ui/package.json`, `apps/admin/package.json`              | `test:cov` (`vitest run --coverage`) + `@vitest/coverage-v8`.                                                                                                                                                                                                     |
| `packages/ui/vitest.config.ts`, `apps/admin/vitest.config.ts`      | `coverage` block: v8 provider, `lcov` reporter, `reportsDirectory: '../../coverage/<pkg>'`.                                                                                                                                                                       |
| `.gitignore`                                                       | `.scannerwork/`, `sonar.env`.                                                                                                                                                                                                                                     |
| `docs/Specs/SonarQube.md`                                          | New living spec: flow diagram, prerequisites, token generation, commands, troubleshooting table, known limits.                                                                                                                                                    |
| `docs/Specs/UI-Architecture.md`                                    | Dependency table (`@vitest/coverage-v8`) + `test:cov` verification commands; header date bumped.                                                                                                                                                                  |

## 5. Outcome and how to verify

```bash
cp sonar.env.example sonar.env   # fill in SONAR_TOKEN (My Account → Security)
pnpm sonar                       # tests + coverage + merge + analysis
```

Expected: `LCOV merge: 5 package, <n> fájl → coverage/lcov.info`, then a scanner run ending with
the analysis URL; the `aisztens` project appears on `http://localhost:9000` with code and
coverage.

Verification steps executed for this change:

1. `pnpm sonar:test` → 43/43 pass.
2. `pnpm sonar:coverage` → 5 packages, 91 `SF:` entries, all of them existing files.
3. `node scripts/sonar/scan.mjs` without a token → Hungarian config error, exit 1.
4. Dummy-token scan → preflight `UP`, scanner CLI 6.2.1 downloaded, properties loaded, `401 Not
authorized` (expected).
5. `pnpm build` → green. `pnpm lint` → red **only** on pre-existing `apps/api` spec files
   (`vapi-signature.guard.spec.ts`, `vapi-webhooks.e2e-spec.ts`), unrelated to this change.

## 6. Follow-ups

- Run one real analysis with a valid token and confirm coverage on the dashboard.
- CI: `SONAR_TOKEN` secret + `sonar.qualitygate.wait=true` in `.github/workflows/ci.yml`.
- Fix the pre-existing `apps/api` `@typescript-eslint/no-unsafe-*` lint errors.
- `apps/web` has no unit tests yet, so it contributes analysis but no coverage.
- Consider `@sonar/scan` v5 (no JRE needed at all) once Node ≥ 22.12 is the default runtime.
