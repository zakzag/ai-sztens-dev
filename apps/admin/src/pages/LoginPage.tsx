import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, Card, Input } from '@callback/ui';
import { useAuth } from '../auth/AuthContext.js';

/*
 * Copy of the page (AIS-174).
 *
 * It lives **in this module**, not in a sibling `login-page.const.ts`: the layer
 * gate's `no-flat-page-to-page` rule forbids a flat page from importing anything
 * under `src/pages/`, and a flat file there *is* a page. `LoginPage.test.tsx`
 * imports these constants, so the copy still has exactly one home — the rule
 * "constant in `<name>.const.ts`" applies to page **folders**, which this page
 * is a documented exception to (`docs/Specs/New-Admin-Page.md`, *Do not*).
 */

/** Heading of the login card — the page's only `h1`. */
export const LOGIN_PAGE_TITLE = 'Bejelentkezés';

/** DOM id of the password input; also the `htmlFor` target of its label. */
export const LOGIN_PASSWORD_FIELD_ID = 'login-password';

/** Label of the password input. */
export const LOGIN_PASSWORD_LABEL = 'Jelszó (bármilyen nem üres érték)';

/** Label of the submit button. */
export const LOGIN_SUBMIT_LABEL = 'Login (Belépés)';

/**
 * Shown when the form is submitted with an empty password (AIS-174).
 *
 * Before this message the empty submit was a **silent** no-op: no token, no
 * navigation and no feedback, which a user cannot distinguish from a broken
 * button. The real credential check (`POST /api/auth/login`) is still an open
 * item, so this is the only failure the placeholder page can honestly report.
 */
export const LOGIN_EMPTY_PASSWORD_MESSAGE = 'Add meg a jelszót a belépéshez.';

/**
 * Placeholder login.
 *
 * Backend authentication (JWT) is an open item; this page just sets a session
 * marker so the guarded dashboard can be demonstrated. Because there is no
 * credential check yet, the only failure it can prove is an empty password — and
 * proving it is the point: a submit that does nothing is a defect, not a state.
 *
 * The page is a documented exception to the page-folder rule
 * (`docs/Specs/New-Admin-Page.md`, *Do not*): it renders outside `AdminLayout`,
 * so it has no `PageShell`, and its copy sits in this module.
 *
 * @returns the login card.
 */
export function LoginPage() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Mirror the typed value and drop a stale message: an error must never
   * survive the correction it asked for.
   *
   * @param event - the input change.
   */
  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value);
    setError(null);
  }

  /**
   * @param event - the form submit.
   */
  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (password.trim().length === 0) {
      setError(LOGIN_EMPTY_PASSWORD_MESSAGE);
      return;
    }

    setError(null);
    // NOTE: replace with a real POST /api/auth/login call once implemented.
    login(`placeholder-token-${Date.now()}`);
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-xl font-bold text-text-primary">
        {LOGIN_PAGE_TITLE}
      </h1>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          id={LOGIN_PASSWORD_FIELD_ID}
          type="password"
          label={LOGIN_PASSWORD_LABEL}
          value={password}
          error={error ?? undefined}
          onChange={handlePasswordChange}
        />
        <Button type="submit" size="lg" className="w-full">
          {LOGIN_SUBMIT_LABEL}
        </Button>
      </form>
    </Card>
  );
}
