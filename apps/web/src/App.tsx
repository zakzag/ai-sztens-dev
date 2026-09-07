import { Link, Route, Routes } from 'react-router-dom';
import { CallbackFormPage } from './pages/CallbackFormPage.js';
import { HomePage } from './pages/HomePage.js';
import { LegalPage } from './pages/LegalPage.js';
import { ThankYouPage } from './pages/ThankYouPage.js';

export function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-800 bg-slate-900">
        <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold text-white">
            Callback Assistant
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-slate-400 hover:text-white">
              Kezdőlap
            </Link>
            <Link
              to="/callback"
              className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500"
            >
              Visszahívást kérek
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/callback" element={<CallbackFormPage />} />
          <Route path="/thank-you" element={<ThankYouPage />} />
          <Route path="/legal" element={<LegalPage />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-3xl justify-between px-4 py-4 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Callback Assistant</span>
          <Link to="/legal" className="hover:text-slate-200">
            Adatkezelés
          </Link>
        </div>
      </footer>
    </div>
  );
}
