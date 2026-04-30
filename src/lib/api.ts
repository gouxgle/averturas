const TOKEN_KEY = 'aberturas_token';

// sessionStorage: se borra al cerrar la ventana/pestaña (no persiste entre sesiones)
export const tokenStorage = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string) => {
    sessionStorage.setItem(TOKEN_KEY, t);
    // Limpiar cualquier token viejo en localStorage
    localStorage.removeItem(TOKEN_KEY);
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStorage.get();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    tokenStorage.clear();
    window.location.href = '/login';
    throw new Error('No autorizado');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Error ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string)              => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body?: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)              => request<T>('DELETE', path),
};
