/**
 * Global Jest setup for the unit suite: mute the Nest logger's console output.
 *
 * Why this exists: several specs exercise **error branches on purpose** — a
 * failing `sql.end()` in `DatabaseLifecycleService`, a 500 in
 * `ApiExceptionFilter`, a rejected webhook guard. The production code logs those
 * (correctly), and without this file every `pnpm test` run prints a wall of
 * `ERROR [ApiExceptionFilter] …` lines with full stack traces. Test output that
 * always contains "ERROR" trains people to ignore it, which is worse than having
 * no output at all.
 *
 * How it stays safe:
 *
 * - `Logger.overrideLogger(false)` installs Nest's `NoopLogger`, so the calls
 *   still travel through `Logger.prototype.*`; a spec that asserts logging with
 *   `jest.spyOn(Logger.prototype, 'error')` keeps working (the spy intercepts
 *   before the no-op logger) — only the console write is dropped.
 * - Only the **unit** config (`apps/api/package.json` → `jest.setupFiles`) loads
 *   this file. The e2e config (`test/jest-e2e.json`) is untouched, so a real
 *   bootstrap still shows its logs.
 * - A failing test still fails on its assertion, never on missing output: no test
 *   asserts console text.
 */

import { Logger } from '@nestjs/common';

Logger.overrideLogger(false);
