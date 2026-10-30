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
 */
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
