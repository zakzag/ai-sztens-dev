/**
 * The layer rules — **one module, two configs** (decision D2 of the AIS-122
 * plan).
 *
 * `.dependency-cruiser.cjs` (the real tree) and `.dependency-cruiser.fixtures.cjs`
 * (the negative/positive proof trees) both import `buildConfig` from here, so
 * the rule list can never drift between "the gate" and "the proof of the gate".
 *
 * Layer map (`.roo/rules/react.coding-standards.md` §0.6, §1, §2):
 *
 *   app → pages → features → entities → services → lib
 *
 * Imports flow downwards only; no page → page, no feature → feature.
 *
 * Element patterns are expressed **location-agnostically** (`(?:^|/)src/app/`)
 * rather than with a `baseDir`, so the same rules match
 * `apps/admin/src/app/…` in the real tree and
 * `scripts/quality/fixtures/layers/positive/src/app/…` in a fixture tree.
 *
 * Documented grandfathers (D4) — both are visible below, each with the ticket
 * that removes it:
 *
 * 1. `components → features/error-surface` (`AppErrorBanner`, AIS-96 thin
 *    container; removed when the banner gets its own hook).
 * 2. `auth` exists as its own element at the same rank as `services` because
 *    three files import it; AIS-74 moves it into `app/session`.
 */

/** Page folders: `src/pages/<name>/…` (capture group 1 = page name). */
const PAGE_FOLDER = '(?:^|/)src/pages/([^/]+)/';

/** Flat page files: `src/pages/XPage.tsx` (capture group 1 = page name). */
const PAGE_FLAT = '(?:^|/)src/pages/([^/]+)\\.tsx?$';

/** Feature folders: `src/features/<name>/…` (capture group 1 = feature name). */
const FEATURE_FOLDER = '(?:^|/)src/features/([^/]+)/';

/**
 * Features any page or feature may import: shared infrastructure, not a page's
 * own use case.
 *
 * - `api` — query/mutation plumbing and the list-params hook.
 * - `error-surface` — the error → surface decision (AIS-96 / AIS-111).
 * - `forms` — `useAppForm`, the single form pattern every page composes
 *   (AIS-115). It is a hook, so it cannot live in `lib` (React + RHF), and
 *   re-implementing it per page is exactly what AIS-115 removed. AIS-131 was the
 *   first cross-page consumer and tripped `no-page-to-foreign-feature` until the
 *   allow-list named it.
 * - `entity-dialog` — the close navigation of a route-mounted entity overlay
 *   (AIS-155): `useEntityDialog(listPath)` is the one "close → back to the list
 *   with `replace`" rule, so every entity page uses it instead of calling
 *   `useNavigate` itself. Same reasoning as `forms`: a hook, shared by every
 *   entity page, not one page's use case.
 */
const SHARED_FEATURES = '(?:api|error-surface|forms|entity-dialog)';

/**
 * The element model of `apps/admin/src`, exported for documentation and tests.
 *
 * @type {Readonly<Record<string, string>>}
 */
const LAYER_ELEMENT_PATTERNS = Object.freeze({
  app: '(?:^|/)src/app/',
  'page-<name>': PAGE_FOLDER,
  'flat-page': PAGE_FLAT,
  'feature-<name>': FEATURE_FOLDER,
  entity: '(?:^|/)src/entities/',
  service: '(?:^|/)src/services/',
  auth: '(?:^|/)src/auth/',
  components: '(?:^|/)src/components/',
  lib: '(?:^|/)src/lib/',
});

/**
 * Builds the `forbidden` rule list.
 *
 * Each "no upward" rule names the **forbidden targets** instead of an allowed
 * list, because dependencies to npm packages must stay legal in every layer.
 *
 * @returns {Array<object>} dependency-cruiser `forbidden` rules.
 */
function buildLayerRules() {
  return [
    {
      name: 'no-lib-to-higher-layer',
      severity: 'error',
      comment:
        '`lib` is the leaf of the layer map: pure helpers may only depend on `lib`.',
      from: { path: '(?:^|/)src/lib/' },
      to: {
        path: '(?:^|/)src/(?:app|pages|features|entities|services|auth|components)/',
      },
    },
    {
      name: 'no-entity-to-higher-layer',
      severity: 'error',
      comment: '`entities` may depend on `entities` and `lib` only.',
      from: { path: '(?:^|/)src/entities/' },
      to: {
        path: '(?:^|/)src/(?:app|pages|features|services|auth|components)/',
      },
    },
    {
      name: 'no-service-to-higher-layer',
      severity: 'error',
      comment: '`services` may depend on `services`, `auth` and `lib` only.',
      from: { path: '(?:^|/)src/services/' },
      to: { path: '(?:^|/)src/(?:app|pages|features|entities|components)/' },
    },
    {
      name: 'no-auth-to-higher-layer',
      severity: 'error',
      comment:
        '`auth` is shared infrastructure (AIS-74 moves it into `app/session`): `auth` and `lib` only.',
      from: { path: '(?:^|/)src/auth/' },
      to: {
        path: '(?:^|/)src/(?:app|pages|features|entities|services|components)/',
      },
    },
    {
      name: 'no-feature-to-higher-layer',
      severity: 'error',
      comment:
        '`features` may depend on `features`, `entities`, `services`, `auth` and `lib` — never on `app`, `pages` or `components`.',
      from: { path: FEATURE_FOLDER },
      to: { path: '(?:^|/)src/(?:app|pages|components)/' },
    },
    {
      name: 'no-page-to-higher-layer',
      severity: 'error',
      comment: '`pages` may depend on everything below them, never on `app`.',
      from: { path: '(?:^|/)src/pages/' },
      to: { path: '(?:^|/)src/app/' },
    },
    {
      name: 'no-component-to-feature',
      severity: 'error',
      comment:
        '`components` are presentational shells: `components`, `entities`, `lib` only. Grandfather (D4): `components → features/error-surface` for the AIS-96 thin container.',
      from: { path: '(?:^|/)src/components/' },
      to: {
        path: '(?:^|/)src/(?:app|pages|features)/',
        pathNot: '(?:^|/)src/features/error-surface/',
      },
    },
    {
      name: 'no-page-to-page',
      severity: 'error',
      comment: 'A page never imports another page.',
      from: { path: PAGE_FOLDER },
      to: { path: PAGE_FOLDER, pathNot: '(?:^|/)src/pages/$1/' },
    },
    {
      name: 'no-flat-page-to-page',
      severity: 'error',
      comment: 'A page in `pages/` (flat file) never imports another page.',
      from: { path: PAGE_FLAT },
      to: { path: '(?:^|/)src/pages/' },
    },
    {
      name: 'no-page-to-foreign-feature',
      severity: 'error',
      comment: `A page may import its own feature plus the shared infra features (${SHARED_FEATURES}).`,
      from: { path: PAGE_FOLDER },
      to: {
        path: FEATURE_FOLDER,
        pathNot: `(?:^|/)src/features/(?:$1|${SHARED_FEATURES})/`,
      },
    },
    {
      name: 'no-flat-page-to-feature',
      severity: 'error',
      comment: `A flat page may import the shared infra features (${SHARED_FEATURES}) only.`,
      from: { path: PAGE_FLAT },
      to: {
        path: '(?:^|/)src/features/',
        pathNot: `(?:^|/)src/features/${SHARED_FEATURES}/`,
      },
    },
    {
      name: 'no-feature-to-feature',
      severity: 'error',
      comment: `A feature never imports another feature (except the shared infrastructure features, ${SHARED_FEATURES}).`,
      from: { path: FEATURE_FOLDER },
      to: {
        path: FEATURE_FOLDER,
        pathNot: `(?:^|/)src/features/(?:$1|${SHARED_FEATURES})/`,
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'A cycle means two layers disagree about who owns the concept — always a defect, never a style choice.',
      from: {},
      to: { circular: true },
    },
  ];
}

/**
 * Builds the `options` block.
 *
 * The repo imports its own modules with **explicit `.js` specifiers**
 * (`../../pages/api-keys/ApiKeysPage.js` while the file on disk is `.tsx`).
 * dependency-cruiser resolves those natively: enabled `ts`/`tsx` parsing plus
 * `.ts`/`.tsx` in `extensions` makes it retry a `.js` specifier as `.ts`/`.tsx`
 * — verified by the **positive** layer fixture, whose every import is
 * `.js`-suffixed (AIS-122 W3 spike).
 *
 * Two options are deliberately **absent**:
 *
 * - `enhancedResolveOptions.extensionAlias` — not part of dependency-cruiser's
 *   configuration schema (`additionalProperties: false`), so the config is
 *   rejected with "data/options/enhancedResolveOptions must NOT have additional
 *   properties".
 * - `tsConfig` — neither `apps/admin/tsconfig.json` nor its base declares
 *   `paths`/`baseUrl`, so it adds nothing to resolution; worse, pointing it at
 *   an `extends`-ing config makes dependency-cruiser resolve that `extends`
 *   from the **cwd** instead of from the config's own directory (observed:
 *   `Cannot read file apps/admin/tsconfig.base.json`, TS18003).
 *
 * @returns {object} dependency-cruiser `options`.
 */
function buildOptions() {
  return {
    doNotFollow: { path: 'node_modules|dist|coverage' },
    exclude: {
      // Tests carry deliberate cross-layer doubles; workspace packages are
      // outside the app's layer map (they are published libraries).
      path: '(?:\\.test\\.tsx?$)|(?:(?:^|/)src/test/)|(?:^packages/)',
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js'],
    },
  };
}

/**
 * Builds a complete dependency-cruiser configuration.
 *
 * @returns {{ forbidden: Array<object>, options: object }} the configuration.
 */
function buildConfig() {
  return {
    forbidden: buildLayerRules(),
    options: buildOptions(),
  };
}

module.exports = { LAYER_ELEMENT_PATTERNS, buildConfig, buildLayerRules };
