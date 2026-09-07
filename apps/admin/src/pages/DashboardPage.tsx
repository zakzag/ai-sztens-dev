import { useQuery } from '@tanstack/react-query';
import { fetchCallbackRequests } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.js';

function statusBadgeClass(status: string): string {
  if (status === 'queued') {
    return 'bg-amber-500/15 text-amber-300';
  }
  if (status === 'completed' || status === 'done') {
    return 'bg-green-500/15 text-green-300';
  }
  if (status === 'failed') {
    return 'bg-red-500/15 text-red-300';
  }
  return 'bg-slate-700/40 text-slate-300';
}

export function DashboardPage() {
  const { logout } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['callback-requests'],
    queryFn: fetchCallbackRequests,
  });

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Visszahívási kérések</h1>
        <button
          onClick={logout}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
        >
          Kijelentkezés
        </button>
      </div>

      {isError && (
        <div className="mt-4 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-900">
          {error instanceof Error ? error.message : 'Hiba történt.'}{' '}
          <button className="underline" onClick={() => void refetch()}>
            Újra
          </button>
        </div>
      )}

      {isLoading && <p className="mt-6 text-slate-400">Betöltés…</p>}

      {data && data.length === 0 && (
        <p className="mt-6 text-slate-400">Még nincs visszahívási kérés.</p>
      )}

      {data && data.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl bg-slate-900 shadow-sm ring-1 ring-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-800/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Név</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Telefon</th>
                <th className="px-4 py-3">Státusz</th>
                <th className="px-4 py-3">Létrehozva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.map((request) => (
                <tr key={request.id}>
                  <td className="px-4 py-3 font-medium text-slate-100">{request.name}</td>
                  <td className="px-4 py-3 text-slate-400">{request.email}</td>
                  <td className="px-4 py-3 text-slate-400">{request.phone}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(
                        request.status,
                      )}`}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(request.createdAt).toLocaleString('hu-HU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
