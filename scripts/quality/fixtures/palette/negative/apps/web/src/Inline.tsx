/**
 * Negative palette fixture — every one of the three rules must fire here.
 *
 * Lives under `apps/web/src` so the gate's default roots apply unchanged.
 */
export function Inline() {
  return (
    <div className="bg-slate-800 p-4 text-white">
      <span className="bg-[#101010]">arbitrary colour value</span>
      <span style={{ color: '#ff0000' }}>colour literal</span>
      <a className="hover:text-white/80" href="/legal">
        opacity modifier on a palette utility
      </a>
    </div>
  );
}
