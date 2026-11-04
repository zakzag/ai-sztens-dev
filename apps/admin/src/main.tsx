import { configureValidationLocale } from '@callback/shared';
import { QueryClient } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import './index.css';

/**
 * The entry point of the admin SPA.
 *
 * It creates the query client — the server-state bucket — and mounts the app
 * inside the router. The client is handed to the app as a prop instead of
 * being instantiated inside the provider chain, because the notification
 * store (AIS-84) has to bind its cache callbacks to this very instance.
 *
 * The `BrowserRouter` stays here: it is the navigation context, and the `app/`
 * layer consumes it rather than owning it.
 *
 * `configureValidationLocale('hu')` is the **only** place that decides the
 * language of validation copy (AIS-112 plan `D8`): the shared schemas keep a
 * single rule set, and this one call makes them speak Hungarian in the browser
 * while the API keeps the default English
 * ([`docs/Specs/API-Convention.md`](../../../docs/Specs/API-Convention.md:83)).
 */
configureValidationLocale('hu');
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App queryClient={queryClient} />
    </BrowserRouter>
  </StrictMode>,
);
