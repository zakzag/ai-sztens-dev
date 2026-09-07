import type { CallbackRequest } from '@callback/shared';
import { createCallbackRequestSchema, type CreateCallbackRequestInput } from '@callback/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * Submit a call-back request.
 * Returns the stored request when the API accepts it (202), otherwise throws.
 */
export async function submitCallbackRequest(
  input: CreateCallbackRequestInput,
): Promise<CallbackRequest> {
  const parsed = createCallbackRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error('Érvénytelen adatok a formon.');
  }

  const response = await fetch(`${API_BASE}/callback-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });

  if (response.status === 202) {
    return (await response.json()) as CallbackRequest;
  }

  let message = `Hiba történt (${response.status})`;
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (typeof body.message === 'string') {
      message = body.message;
    } else if (Array.isArray(body.message)) {
      message = body.message.join(', ');
    }
  } catch {
    // ignore non-JSON error bodies
  }
  throw new Error(message);
}
