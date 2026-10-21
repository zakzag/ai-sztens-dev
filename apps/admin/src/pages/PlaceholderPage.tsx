import { BuildInfoFooter } from '../components/BuildInfoFooter.js';

/**
 * Landing page while the admin app has no feature pages.
 *
 * AIS-64 removed the callback-request dashboard together with the whole
 * callback feature. The first real page is the API-key manager (AIS-41), built
 * on the `packages/api-client` foundation (AIS-57), so this placeholder only
 * has to keep the shell usable and the deploy metadata visible.
 */
export function PlaceholderPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold text-white">AIsztens — Admin</h1>
      <p className="mt-3 text-slate-400">
        Az admin felület fejlesztés alatt áll. Az első elérhető oldal az API kulcsok kezelése lesz.
      </p>

      {/* Which revision is actually being served? Baked in at image build time. */}
      <BuildInfoFooter />
    </section>
  );
}
