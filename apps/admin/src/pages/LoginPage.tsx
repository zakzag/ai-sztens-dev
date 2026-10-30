import { useState, type FormEvent } from 'react';
import { Button, Card, Input } from '@callback/ui';
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
    <Card className="w-full max-w-sm">
      <h1 className="text-xl font-bold text-text-primary">Bejelentkezés</h1>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          id="password"
          type="password"
          label="Jelszó (bármilyen nem üres érték)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" size="lg" className="w-full">
          Login (Belépés)
        </Button>
      </form>
    </Card>
  );
}
