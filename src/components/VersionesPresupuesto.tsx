import { useState } from 'react';
import { History, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ItemSnapshot {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  precio_instalacion: number;
  incluye_instalacion: boolean;
}

interface Version {
  id: string;
  version: number;
  created_at: string;
  creado_por_nombre: string | null;
  snapshot: {
    operacion: { precio_total: number; forma_pago: string | null; notas: string | null };
    items: ItemSnapshot[];
  };
}

function totalItem(it: ItemSnapshot): number {
  return (Number(it.precio_unitario) + (it.incluye_instalacion ? Number(it.precio_instalacion) : 0)) * it.cantidad;
}

// Historial de ediciones de un presupuesto — cada vez que se guarda un cambio
// (PUT /operaciones/:id) el backend guarda el estado ANTERIOR como v1, v2, v3...
// para poder ver qué fue cambiando sin tener que recordarlo de memoria.
export function VersionesPresupuesto({ operacionId }: { operacionId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [versiones, setVersiones] = useState<Version[]>([]);
  const [expandida, setExpandida] = useState<string | null>(null);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !cargado) {
      setLoading(true);
      api.get<Version[]>(`/operaciones/${operacionId}/versiones`)
        .then(setVersiones)
        .catch(() => setVersiones([]))
        .finally(() => { setLoading(false); setCargado(true); });
    }
  }

  return (
    <div className="px-5 pb-4">
      <button type="button" onClick={toggleOpen}
        className="w-full flex items-center gap-2 py-2 text-left">
        <History size={13} className="text-gray-600" />
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider flex-1">
          Historial de versiones{cargado && versiones.length > 0 ? ` (${versiones.length})` : ''}
        </p>
        {open ? <ChevronDown size={14} className="text-gray-600" /> : <ChevronRight size={14} className="text-gray-600" />}
      </button>

      {open && (
        loading ? (
          <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-gray-600" /></div>
        ) : versiones.length === 0 ? (
          <p className="text-xs text-gray-600 py-2">Sin ediciones anteriores — este es el único estado que tuvo el presupuesto.</p>
        ) : (
          <div className="space-y-1.5 mt-1">
            {versiones.map(v => {
              const isOpen = expandida === v.id;
              return (
                <div key={v.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button type="button" onClick={() => setExpandida(isOpen ? null : v.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-gray-800 shrink-0">v{v.version}</span>
                      <span className="text-[11px] text-gray-600 truncate">
                        {formatDate(v.created_at)} · {v.creado_por_nombre ?? 'Usuario'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-gray-700">{formatCurrency(Number(v.snapshot.operacion.precio_total))}</span>
                      {isOpen ? <ChevronDown size={12} className="text-gray-600" /> : <ChevronRight size={12} className="text-gray-600" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-3 py-2 bg-white space-y-1.5">
                      {v.snapshot.operacion.forma_pago && (
                        <p className="text-[11px] text-gray-600">Forma de pago: <span className="font-medium">{v.snapshot.operacion.forma_pago}</span></p>
                      )}
                      {v.snapshot.items.map((it, i) => (
                        <div key={it.id ?? i} className="flex items-start justify-between gap-3 py-1 border-b border-gray-200 last:border-0">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs text-gray-700">
                              {i + 1}. {it.descripcion}{it.cantidad > 1 ? ` × ${it.cantidad}` : ''}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-gray-700 shrink-0">{formatCurrency(totalItem(it))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
