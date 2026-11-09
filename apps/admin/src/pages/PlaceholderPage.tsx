import { PageShell } from '@callback/ui';
import { BuildInfoFooter } from '../components/BuildInfoFooter.js';

/*
 * Copy of the page (AIS-174), kept in this module on purpose: the layer gate's
 * `no-flat-page-to-page` rule forbids a flat page from importing anything under
 * `src/pages/`, so a sibling `placeholder-page.const.ts` is not available to a
 * page that is itself a flat file. `PlaceholderPage.test.tsx` imports these two
 * constants, so the strings still have one home.
 */

/**
 * Title of the landing page — the page's single `h1`.
 *
 * It repeats `APP_BRAND_LABEL` from `app/app.const.ts` deliberately: a page may
 * not import `app/` (layer gate), so the brand string has one owner per layer —
 * the header label the router reads, and this page title.
 */
export const PLACEHOLDER_PAGE_TITLE = 'AIsztens — Admin';

/** Subtitle under the title, saying what already works. */
export const PLACEHOLDER_PAGE_SUBTITLE =
  'Az admin felület folyamatosan épül. Az API kulcsok kezelése már elérhető.';

/**
 * Landing page of the authenticated shell (`/`).
 *
 * AIS-64 removed the callback-request dashboard together with the whole
 * callback feature. The first real page is the API-key manager (AIS-41), built
 * on the `packages/api-client` foundation (AIS-57), so this placeholder only
 * has to keep the shell usable and the deploy metadata visible.
 *
 * Since AIS-171 the frame is the shared `PageShell`: the title and the subtitle
 * are props and the deploy footer is an ordinary child, so this file carries no
 * `<section>`/`<h1>` markup of its own. Since AIS-174 the copy is exported from
 * here, so `PlaceholderPage.test.tsx` asserts the very strings the page renders
 * instead of a copy of them.
 *
 * @returns the landing page content.
 */
export function PlaceholderPage() {
  return (
    <PageShell
      title={PLACEHOLDER_PAGE_TITLE}
      subtitle={PLACEHOLDER_PAGE_SUBTITLE}
    >
      {/* Which revision is actually being served? Baked in at image build time. */}
      <BuildInfoFooter />
    </PageShell>
  );
}
