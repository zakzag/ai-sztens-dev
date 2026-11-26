/**
 * Layer gate for the real tree — `pnpm quality:layers`.
 *
 * The rules live in `.dependency-cruiser.rules.cjs` and are shared with
 * `.dependency-cruiser.fixtures.cjs`, so "the gate" and "the proof of the gate"
 * can never drift apart (decision D2 of the AIS-122 plan).
 *
 * `apps/web` is not part of this gate: it has no layers yet (it is a flat
 * `App.tsx` + `pages/*`), so there is nothing to enforce there — see
 * `docs/Specs/UI-Architecture.md` §2.
 *
 * Run: `depcruise apps/admin/src --config .dependency-cruiser.cjs --output-type err`
 */

const { buildConfig } = require('./.dependency-cruiser.rules.cjs');

module.exports = buildConfig();
