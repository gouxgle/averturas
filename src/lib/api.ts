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

interface RequestOpts {
  // Llamadas "de fondo" (polling, chequeos automáticos) — un 401 acá NUNCA debe
  // expulsar al usuario de la página. Antes, CUALQUIER 401 (incluido el poll de
  // NotificationBell cada 10s) hacía window.location.href='/login' sin avisar,
  // borrando de golpe todo lo que hubiera sin guardar en un formulario largo
  // (bug real reportado — carga de varios ítems, la sesión vencía en medio de la
  // carga y el usuario perdía todo el trabajo). Ahora solo una llamada explícita
  // del usuario (silent=false, el default) puede disparar esa redirección.
  silent?: boolean;
}

async function request<T>(method: string, path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
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
    if (!opts?.silent) {
      tokenStorage.clear();
      window.location.href = '/login';
    }
    throw new Error('No autorizado');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; detalle?: { campo: string; mensaje: string }[] };
    const e = new Error(err.error ?? `Error ${res.status}`) as Error & { detalle?: typeof err.detalle };
    e.detalle = err.detalle;
    throw e;
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string, opts?: RequestOpts)              => request<T>('GET',    path, undefined, opts),
  post:   <T>(path: string, body: unknown, opts?: RequestOpts) => request<T>('POST',   path, body, opts),
  put:    <T>(path: string, body: unknown, opts?: RequestOpts) => request<T>('PUT',    path, body, opts),
  patch:  <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('PATCH',  path, body, opts),
  delete: <T>(path: string, opts?: RequestOpts)              => request<T>('DELETE', path, undefined, opts),
};
