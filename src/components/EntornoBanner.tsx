import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Entorno = 'test' | 'produccion' | 'local';

// Franja + badge que identifican a simple vista si se está en test o producción.
// Se detecta solo (GET /pub/entorno, deriva de APP_URL) — nada que cambiar a mano
// al deployar. En local no se muestra nada.
const ESTILOS: Record<Entorno, { franja: string; badge: string; label: string } | null> = {
  test:       { franja: 'bg-amber-500',   badge: 'bg-amber-500 text-white',   label: '🧪 TEST' },
  produccion: { franja: 'bg-emerald-600', badge: 'bg-emerald-600 text-white', label: '🟢 PRODUCCIÓN' },
  local:      null,
};

export function EntornoBanner() {
  const [entorno, setEntorno] = useState<Entorno | null>(null);

  useEffect(() => {
    api.get<{ entorno: Entorno }>('/pub/entorno')
      .then(d => setEntorno(d.entorno))
      .catch(() => {});
  }, []);

  if (!entorno) return null;
  const s = ESTILOS[entorno];
  if (!s) return null;

  return (
    <>
      <div className={`fixed top-0 left-0 right-0 h-1.5 z-[9999] print:hidden ${s.franja}`} />
      <div className={`fixed top-2 right-2 z-[9999] px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg pointer-events-none select-none print:hidden ${s.badge}`}>
        {s.label}
      </div>
    </>
  );
}
