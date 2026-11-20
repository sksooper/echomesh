import { useAuth } from './auth';
import Dashboard from './Dashboard';
import LoginView from './components/LoginView';

/** Bramka: bez zalogowanego użytkownika pokazujemy logowanie, z użytkownikiem — dashboard. */
export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Ładowanie…</div>;
  }
  return user ? <Dashboard /> : <LoginView />;
}
