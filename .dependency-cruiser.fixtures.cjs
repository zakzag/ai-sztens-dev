/**
 * Layer gate for the **fixture trees** — the negative/positive proof of the
 * gate (`scripts/quality/layers.test.mjs`).
 *
 * Same rules as `.dependency-cruiser.cjs` (both import
 * `.dependency-cruiser.rules.cjs`), only without the real tree's tsconfig: the
 * fixtures are self-contained and the `extensionAlias` in the shared options is
 * what resolves their `.js`-suffixed imports to the `.ts`/`.tsx` sources.
 *
 * Run:
 *   depcruise scripts/quality/fixtures/layers/negative \
 *     --config .dependency-cruiser.fixtures.cjs --output-type err
 */

const { buildConfig } = require('./.dependency-cruiser.rules.cjs');

module.exports = buildConfig();
