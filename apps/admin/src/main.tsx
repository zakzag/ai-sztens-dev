import { configureValidationLocale } from '@callback/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { createAppQueryClient } from './app/notifications/app-query-client.js';
import { createHttpEventEmitter } from './app/notifications/notification-capture.js';
import { notificationStore } from './app/notifications/notification.store.js';
import { setHttpEventListener } from './services/http-events.js';
import './index.css';

/**
 * The entry point of the admin SPA.
 *
 * The boot sequence is a fixed order of four steps, and the order is the
 * contract (AIS-84):
 *
 * 1. `configureValidationLocale('hu')` — the **only** place that decides the
 *    language of validation copy (AIS-112 plan `D8`): the shared schemas keep a
 *    single rule set, and this one call makes them speak Hungarian in the
 *    browser while the API keeps the default English
 *    ([`docs/Specs/API-Convention.md`](../../../docs/Specs/API-Convention.md:83)).
 * 2. the HTTP listener is registered, so every request sent **after** this line
 *    reaches the log — no request is ever sent before React Mounts. It receives
 *    the route reader as well, because only the composition root may look at
 *    `location` (AIS-152).
 * 3. the query client is built **with** the notification cache callbacks, which
 *    is why it is created here and handed to `<App>` as a prop instead of being
 *    instantiated inside the provider chain.
 * 4. the app is mounted inside the router. `BrowserRouter` stays here: it is the
 *    navigation context, and the `app/` layer consumes it rather than owning it.
 */
configureValidationLocale('hu');

/**
 * Operation label of a HTTP attempt: the route the user is on.
 *
 * The transport only ever sees a URL, so the domain operation cannot come from
 * there. It is supplied here — in the composition root, the one place allowed to
 * read `window.location` — and injected into the capture adapter (AIS-152 `D-E`),
 * which keeps the adapter free of DOM access.
 */
const readRouteOperation = (): string => window.location.pathname;

setHttpEventListener(
  createHttpEventEmitter(notificationStore, readRouteOperation),
);

const queryClient = createAppQueryClient(notificationStore);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App queryClient={queryClient} />
    </BrowserRouter>
  </StrictMode>,
);
