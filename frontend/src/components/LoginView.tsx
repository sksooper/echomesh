import { FormEvent, useState } from 'react';
import { ApiError } from '../api';
import { useAuth } from '../auth';

type Mode = 'login' | 'register';

// Konta demonstracyjne (tworzone przy SEED_DEMO_USERS=true) — pokazane jako tekst do przepisania
const DEMO_ACCOUNTS = [
  { role: 'Mieszkaniec', email: 'mieszkaniec@echomesh.test', password: 'Mieszkaniec123!' },
  { role: 'Analityk', email: 'analityk@echomesh.test', password: 'Analityk123!' },
  { role: 'Administrator', email: 'admin@echomesh.test', password: 'Admin123!' },
];

/** Komunikat dla użytkownika wybrany po kodzie odpowiedzi — bez technicznych szczegółów. */
function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Nieprawidłowy e-mail lub hasło.';
    if (error.status === 409) return 'Konto z tym adresem e-mail już istnieje.';
    if (error.status === 400) return 'Sprawdź dane: poprawny e-mail i hasło (min. 8 znaków).';
  }
  return 'Nie udało się połączyć z serwerem. Spróbuj ponownie.';
}

export default function LoginView() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); // bez tego przeglądarka przeładowałaby stronę
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      // po sukcesie AuthProvider ustawia użytkownika, a App pokazuje dashboard
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(value);
        setError(null);
      }}
      className={`flex-1 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
        mode === value ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  );

  const input = 'w-full rounded border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
        <h1 className="mb-1 whitespace-nowrap text-2xl font-semibold">EchoMesh</h1>
        <p className="mb-4 text-sm text-slate-500">Monitoring hałasu miejskiego</p>

        <div className="mb-4 flex border-b">
          {tab('login', 'Logowanie')}
          {tab('register', 'Rejestracja')}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Imię i nazwisko</span>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">E-mail</span>
            <input
              className={input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Hasło</span>
            <input
              className={input}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 8 : undefined}
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full whitespace-nowrap rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? 'Chwileczkę…' : mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-5 space-y-1 border-t pt-4 text-xs text-slate-500">
            <div className="font-medium text-slate-600">Konta demonstracyjne</div>
            {DEMO_ACCOUNTS.map((a) => (
              <div key={a.email} className="font-mono">
                {a.role}: {a.email} / {a.password}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
