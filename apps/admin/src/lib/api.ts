import type { CallbackRequest } from '@callback/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** List all stored callback requests (admin). */
export async function fetchCallbackRequests(): Promise<CallbackRequest[]> {
  const response = await fetch(`${API_BASE}/callback-requests`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Hiba a kérések lekérésekor (${response.status})`);
  }

  return (await response.json()) as CallbackRequest[];
}
