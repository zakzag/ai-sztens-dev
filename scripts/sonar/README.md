# `scripts/sonar/` — local SonarQube analysis

Tooling behind the `pnpm sonar*` scripts. It analyses the **whole monorepo** against a
SonarQube server the developer already runs (default `http://localhost:9000`) and feeds the
unit-test coverage back into the report.

Everything is plain Node (`.mjs`), no build step, no extra CLI. The scanner itself is the
`@sonar/scan` dev dependency.

| File               | Responsibility                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `sonar.const.mjs`  | Defaults: server URL, `sonar.env` name, merged LCOV path, the list of packages that emit coverage.                    |
| `sonar.errors.mjs` | `SonarConfigError`, `SonarServerError`, `LcovMergeError`.                                                             |
| `scan-config.mjs`  | Pure config helpers: env-file parsing, env merge, URL normalisation, token validation.                                |
| `scan.mjs`         | Orchestration: preflight (`/api/system/status`) → `@sonar/scan`. CLI entry point.                                     |
| `lcov-merge.mjs`   | Merges `coverage/<pkg>/lcov.info` into `coverage/lcov.info` with **repo-root relative** `SF:` paths. CLI entry point. |
| `*.test.mjs`       | `node:test` suites (`pnpm sonar:test`). No network, no real filesystem (temp dirs only).                              |

## Usage

```bash
pnpm sonar          # coverage + merge + scan (the everyday command)
pnpm sonar:coverage # only the tests + the LCOV merge
pnpm sonar:scan     # only the scan (uses an existing coverage/lcov.info)
pnpm sonar:test     # unit tests of the tooling itself
```

Credentials come from `SONAR_TOKEN` (required) and `SONAR_HOST_URL` (optional), either from the
real environment or from the git-ignored `sonar.env` file. Copy
[`sonar.env.example`](../../sonar.env.example) to get started. The token is never logged.

## Why the merge exists

SonarQube resolves the `SF:` paths of an LCOV file relative to the analysed project root. Jest
(writing paths relative to its `rootDir`, for `apps/api` that is `src`) and Vitest (relative to
the package root) both produce per-package paths such as `SF:src/foo.ts`. `lcov-merge.mjs`
rewrites each entry to `apps/api/src/foo.ts` / `packages/ui/src/foo.ts`-style repo-root relative
paths, deduplicates identical files across packages and warns about entries it cannot find on
disk. Without it the coverage section of the SonarQube report stays empty.

Full operator documentation: [`docs/Specs/SonarQube.md`](../../docs/Specs/SonarQube.md).
