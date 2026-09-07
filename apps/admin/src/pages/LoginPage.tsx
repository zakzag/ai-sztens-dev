import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext.js';

/**
 * Placeholder login. Backend authentication (JWT) is an open item; this page
 * just sets a session marker so the guarded dashboard can be demonstrated.
 */
export function LoginPage() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.trim().length === 0) {
      return;
    }
    // NOTE: replace with a real POST /api/auth/login call once implemented.
    login(`placeholder-token-${Date.now()}`);
  }

  return (
    <div className="w-full max-w-sm rounded-xl bg-slate-900 p-8 shadow-sm ring-1 ring-slate-800">
      <h1 className="text-xl font-bold text-white">Bejelentkezés</h1>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300">
            Jelszó (bármilyen nem üres érték)
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500"
        >
          Belépés
        </button>
      </form>
    </div>
  );
}
