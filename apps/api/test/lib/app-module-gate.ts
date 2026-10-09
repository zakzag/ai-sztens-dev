/**
 * Shared gate for the e2e suites that need the real `AppModule`.
 *
 * The problem
 * -----------
 * `AppModule` imports `@nestjs/config`, which is published as **CommonJS** and
 * internally `require()`s the **ESM-only** `@nestjs/common@12`. Plain Node
 * allows `require(esm)` from 22.12 (flagged) and from 24.9 (stable), but
 * Jest's ESM runner only supports it from Node 24.9 — on older runtimes the
 * `require()` throws
 *
 *   Must use import to load ES Module: .../@nestjs/common/index.js
 *
 * while the suite is still *loading*, so the failure cannot be caught inside a
 * test body. Every spec file that statically imports `AppModule` therefore
 * fails as "Test suite failed to run" on Node < 24.9, with no assertion
 * results at all.
 *
 * The workaround used here
 * ------------------------
 * Those specs load `AppModule` through a *dynamic* `import()` inside the test
 * body and self-skip (with a loud warning) when the runtime cannot do it. The
 * application-side regression that these tests guard against (a provider that
 * Nest cannot resolve at bootstrap) is additionally covered WITHOUT the
 * environment caveat by `src/vapi-webhooks/vapi-webhooks.module.spec.ts`.
 *
 * On Node >= 24.9 — or in CI once the runner uses a modern Node — the tests
 * execute for real; nothing else needs to change.
 */

const [NODE_MAJOR, NODE_MINOR] = process.versions.node
  .split('.')
  .map((part) => Number(part));

/** True when Jest can `require()` the CommonJS wrapper around ESM deps. */
export const JEST_CAN_REQUIRE_ESM =
  NODE_MAJOR > 24 || (NODE_MAJOR === 24 && NODE_MINOR >= 9);

/** Warning text printed instead of a silent skip. */
export const APP_MODULE_SKIP_REASON =
  `skipped: Jest's ESM runner needs Node >= 24.9 to load the ` +
  `CommonJS-only @nestjs/config (running on ${process.versions.node})`;

/**
 * Dynamically imports `AppModule`, or returns `null` when the current runtime
 * cannot load it under Jest (see the file docblock).
 */
export async function loadAppModuleOrSkip(): Promise<
  typeof import('../../src/app.module.js').AppModule | null
> {
  if (!JEST_CAN_REQUIRE_ESM) {
    console.warn(`[app-module-gate] ${APP_MODULE_SKIP_REASON}`);
    return null;
  }
  const { AppModule } = await import('../../src/app.module.js');
  return AppModule;
}
