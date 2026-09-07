export type CallStatus =
  | 'queued'
  | 'dialing'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy'
  | 'actions-executing'
  | 'done';

/** Payload accepted by POST /api/callback-requests. */
export interface CreateCallbackRequestDto {
  name: string;
  email: string;
  phone: string;
  reason: string;
}

/** Stored callback request returned by the API. */
export interface CallbackRequest extends CreateCallbackRequestDto {
  id: string;
  status: CallStatus;
  createdAt: string;
}
