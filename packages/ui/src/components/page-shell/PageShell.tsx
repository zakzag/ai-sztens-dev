import type { PageShellProps } from './page-shell.interface.js';

/**
 * The one page frame of the admin app (AIS-171).
 *
 * Before this primitive the same `<section className="space-y-6">` + `<h1>` +
 * subtitle block was hand-written on four surfaces, each with its own
 * wrapping. One primitive plus one call per page removes that copy — and a new
 * entity page has no fifth variant to invent.
 *
 * `back` and `actions` are rendered **only when supplied**: a `null`/empty
 * wrapper would add a flex child to the header row and silently change the
 * title's alignment on every page that has no back link.
 *
 * @param props - see {@link PageShellProps}.
 */
export function PageShell({
  title,
  subtitle,
  back,
  actions,
  children,
}: PageShellProps) {
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {back === undefined ? null : <div className="mb-2">{back}</div>}
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          {subtitle === undefined ? null : (
            <p className="mt-2 text-sm text-text-secondary">{subtitle}</p>
          )}
        </div>

        {actions === undefined ? null : (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </header>

      {children}
    </section>
  );
}
