import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type Entorno = 'test' | 'produccion' | 'local';

// Entorno donde corre la app (GET /pub/entorno, deriva de APP_URL). Una sola consulta para toda la app.
let cache: Entorno | null = null;
let pendiente: Promise<Entorno | null> | null = null;

function cargar(): Promise<Entorno | null> {
  if (cache) return Promise.resolve(cache);
  pendiente ??= api.get<{ entorno: Entorno }>('/pub/entorno')
    .then(d => (cache = d.entorno))
    .catch(() => null)
    .finally(() => { pendiente = null; });
  return pendiente;
}

/** null mientras se consulta (o si falla): quien lo use tiene que decidir qué mostrar sin saber el entorno. */
export function useEntorno(): Entorno | null {
  const [entorno, setEntorno] = useState<Entorno | null>(cache);
  useEffect(() => {
    let vivo = true;
    cargar().then(e => { if (vivo) setEntorno(e); });
    return () => { vivo = false; };
  }, []);
  return entorno;
}
