import { zodResolver } from '@hookform/resolvers/zod';
import { createCallbackRequestSchema, type CreateCallbackRequestInput } from '@callback/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { submitCallbackRequest } from '../lib/api.js';

export function CallbackFormPage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCallbackRequestInput>({
    resolver: zodResolver(createCallbackRequestSchema),
    defaultValues: { name: '', email: '', phone: '', reason: '' },
  });

  async function onSubmit(values: CreateCallbackRequestInput) {
    setSubmitError(null);
    try {
      const request = await submitCallbackRequest(values);
      navigate('/thank-you', { state: { request } });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Ismeretlen hiba történt.');
    }
  }

  return (
    <div className="mx-auto max-w-xl rounded-xl bg-slate-900 p-8 shadow-sm ring-1 ring-slate-800">
      <h1 className="text-2xl font-bold text-white">Visszahívás kérése</h1>
      <p className="mt-2 text-sm text-slate-400">
        Töltse ki az űrlapot, és kollégánk hamarosan felhívja.
      </p>

      {submitError && (
        <div className="mt-4 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-900">
          {submitError}
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-300">
            Név
          </label>
          <input
            id="name"
            type="text"
            className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            {...register('name')}
          />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300">
            E-mail cím
          </label>
          <input
            id="email"
            type="email"
            className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-300">
            Telefonszám
          </label>
          <input
            id="phone"
            type="tel"
            className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="+36 30 123 4567"
            {...register('phone')}
          />
          {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone.message}</p>}
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-slate-300">
            Miért keres minket?
          </label>
          <textarea
            id="reason"
            rows={4}
            className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            {...register('reason')}
          />
          {errors.reason && <p className="mt-1 text-xs text-red-400">{errors.reason.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Küldés…' : 'Visszahívást kérek'}
        </button>
      </form>
    </div>
  );
}
