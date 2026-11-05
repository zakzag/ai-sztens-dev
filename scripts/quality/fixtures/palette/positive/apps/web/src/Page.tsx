/**
 * Positive palette fixture — a page built from tokens only. Also covers the
 * `apps/web/src` root so the gate's default root list applies unchanged.
 */
export function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-text-primary">Headline</h1>
      <p className="mt-3 text-sm text-text-secondary">Body copy</p>
    </main>
  );
}
