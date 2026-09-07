import { Link, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LoginPage } from './pages/LoginPage.js';

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
      <header className="border-b border-slate-800 bg-slate-900">
        <nav className="flex items-center justify-between px-6 py-3">
          <Link to="/" className="text-lg font-semibold text-white">
            Callback Assistant — Admin
          </Link>
          <Routes>
            <Route
              path="*"
              element={
                <span className="text-sm text-slate-400">
                  <Link className="mr-4 hover:text-white" to="/">
                    Kérések
                  </Link>
                  <Link className="mr-4 hover:text-white" to="/calls">
                    Hívások
                  </Link>
                </span>
              }
            />
          </Routes>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calls" element={<div className="text-slate-400">Hívások — hamarosan</div>} />
          <Route path="*" element={<div className="text-slate-400">Nem található</div>} />
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
