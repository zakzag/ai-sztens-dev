import {
  formatCommitHash,
  formatDeployDate,
  normalizeBuildValue,
} from '@callback/shared';

/**
 * Small footer line that shows which revision the running bundle was built
 * from: the immutable image build timestamp plus the full commit SHA.
 *
 * Both values come from build-time env injected by
 * [`.github/workflows/images.yml`](../../../../.github/workflows/images.yml).
 * They are `undefined` on a developer machine, so the component renders the
 * `—` placeholder instead of disappearing (a missing footer would be
 * indistinguishable from a broken build).
 *
 * The formatting/normalisation logic lives in
 * [`@callback/shared`](../../../../packages/shared/src/lib/build-info.ts) so
 * the `web` and `admin` footers cannot drift apart.
 */
export function BuildInfoFooter() {
  const deployDate = normalizeBuildValue(import.meta.env.VITE_DEPLOY_DATE);
  const commitHash = normalizeBuildValue(import.meta.env.VITE_COMMIT_HASH);

  return (
    <p
      className="pt-2 text-center text-xs text-slate-500"
      data-testid="build-info"
    >
      <span title={deployDate ?? 'Build idő nem elérhető'}>
        Telepítve: {formatDeployDate(deployDate)}
      </span>
      <span className="mx-2" aria-hidden="true">
        ·
      </span>
      <span title={commitHash ?? 'Commit hash nem elérhető'}>
        Verzió: {formatCommitHash(commitHash)}
      </span>
    </p>
  );
}
