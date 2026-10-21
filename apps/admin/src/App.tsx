import { Link, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.js';
import { ApiKeysPage } from './pages/api-keys/ApiKeysPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { PlaceholderPage } from './pages/PlaceholderPage.js';

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <LoginPage />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border-hairline bg-surface-raised">
        <nav className="flex items-center justify-between px-6 py-3">
          <Link to="/" className="text-lg font-semibold text-text-primary">
            AIsztens — Admin
          </Link>
          <span className="text-sm text-text-secondary">
            <Link
              className="mr-4 transition-colors duration-fast hover:text-text-primary"
              to="/api-keys"
            >
              API kulcsok
            </Link>
            <Link className="mr-4 transition-colors duration-fast hover:text-text-primary" to="/calls">
              Hívások
            </Link>
          </span>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <Routes>
          <Route path="/" element={<PlaceholderPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="/calls" element={<p className="text-text-secondary">Hívások — hamarosan</p>} />
          <Route path="*" element={<p className="text-text-secondary">Nem található</p>} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </AuthProvider>
  );
}
