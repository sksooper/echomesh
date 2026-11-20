import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from './api';
import type { User } from './api';

type AuthState = {
  user: User | null;
  /** true, dopóki sprawdzamy zapisany token (żeby nie mignął ekran logowania). */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Bez zapisanego tokenu od razu wiemy, że nikt nie jest zalogowany
  const [loading, setLoading] = useState(() => api.tokenStore.get() !== null);

  useEffect(() => {
    // Gdy serwer odrzuci token (np. wygasł), api.ts wywoła ten handler
    api.setUnauthorizedHandler(() => setUser(null));

    // Przywracanie sesji po odświeżeniu: zapytaj serwer, kim jest właściciel tokenu
    if (api.tokenStore.get()) {
      api
        .getMe()
        .then(setUser)
        .catch(() => {
          /* 401 obsłuży handler; przy błędzie sieci zostajemy wylogowani */
        })
        .finally(() => setLoading(false));
    }
    return () => api.setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    api.tokenStore.set(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await api.register(name, email, password);
    api.tokenStore.set(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    api.tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth musi być użyty wewnątrz <AuthProvider>');
  return ctx;
}
