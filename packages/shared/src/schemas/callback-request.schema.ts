import { z } from 'zod';

/** Client + server side validation for the call-back form. */
export const createCallbackRequestSchema = z.object({
  name: z.string().trim().min(1, 'A név megadása kötelező').max(120),
  email: z
    .string()
    .trim()
    .email('Érvényes e-mail címet adj meg')
    .max(254),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s\-()]{6,20}$/, 'Érvényes telefonszámot adj meg'),
  reason: z.string().trim().min(10, 'Kérjük, írj legalább 10 karaktert').max(1000),
});

export type CreateCallbackRequestInput = z.infer<typeof createCallbackRequestSchema>;
