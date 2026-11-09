/**
 * Positive palette fixture — token classes and arbitrary **layout** values
 * must not be flagged. Guards against a blanket-fail gate.
 */
export function Card() {
  return (
    <div className="rounded-card border border-hairline border-border-hairline bg-surface-raised p-6 shadow-neu-raised">
      <h2 className="text-lg font-semibold text-text-primary">Title</h2>
      <p className="mt-1 text-sm text-text-muted">Body copy</p>
      <div className="grid grid-cols-[2fr_1fr] gap-4 rounded-control bg-surface-sunken shadow-neu-inset" />
      <button
        type="button"
        className="rounded-control bg-primary text-primary-foreground transition-shadow duration-fast hover:bg-primary-hover focus-visible:border-border-focus focus-visible:shadow-focus-ring"
      >
        Action
      </button>
    </div>
  );
}

/** A hash that is not a colour: `#` + non-hex characters must be ignored. */
export const HASH_LIKE_VALUES = ['#main', '#/legal', '#section-two'];
