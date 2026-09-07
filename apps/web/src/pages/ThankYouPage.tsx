import { Link, useLocation } from 'react-router-dom';

interface ThankYouState {
  request?: { email?: string };
}

export function ThankYouPage() {
  const location = useLocation();
  const state = (location.state ?? {}) as ThankYouState;

  return (
    <div className="mx-auto max-w-xl rounded-xl bg-slate-900 p-8 text-center shadow-sm ring-1 ring-slate-800">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-2xl text-green-400">
        ✓
      </div>
      <h1 className="mt-4 text-2xl font-bold text-white">Köszönjük a megkeresést!</h1>
      <p className="mt-3 text-slate-400">
        Kérését rögzítettük{state.request?.email ? ` (${state.request.email})` : ''}, kollégánk
        hamarosan visszahívja Önt munkaidőben.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500"
      >
        Vissza a kezdőlapra
      </Link>
    </div>
  );
}
