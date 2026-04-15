import { useState, useEffect, createContext, useContext } from 'react';
import { api, tokenStorage } from '@/lib/api';

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar token guardado al arrancar
    const token = tokenStorage.get();
    if (!token) { setLoading(false); return; }

    api.get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  async function signIn(email: string, password: string) {
    try {
      const { token, user } = await api.post<{ token: string; user: AuthUser }>(
        '/auth/login', { email, password }
      );
      tokenStorage.set(token);
      setUser(user);
      return { error: null };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  function signOut() {
    tokenStorage.clear();
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
