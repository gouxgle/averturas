import { useEffect, useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface RemitoDevolvible {
  id: string; numero: string; estado: string; fecha_emision: string; cliente_id: string; cliente_nombre: string | null;
  operacion_numero: string | null; items_resumen: { descripcion: string; cantidad: number }[] | null;
}

const fmtFecha = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

// ¿De qué remito se devuelve? Lista los remitos emitidos o entregados que todavía tienen algo para devolver;
// busca en el servidor (por número, cliente, presupuesto o producto) y, desde la ficha de un cliente,
// se acota a los suyos con `clienteId`.
export function ElegirRemito({ clienteId, clienteNombre, onElegir, onClose }: {
  clienteId?: string; clienteNombre?: string; onElegir: (remitoId: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  // El resultado lleva la búsqueda que lo originó: mientras no coincida con la actual, se muestra "cargando"
  const busqueda = `${clienteId ?? ''}|${q.trim()}`;
  const [res, setRes] = useState<{ busqueda: string; remitos: RemitoDevolvible[] } | null>(null);
  const remitos = res?.busqueda === busqueda ? res.remitos : null;

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (clienteId) p.set('cliente_id', clienteId);
      if (q.trim()) p.set('q', q.trim());
      api.get<RemitoDevolvible[]>(`/devoluciones/remitos-devolvibles?${p}`)
        .then(remitos => setRes({ busqueda, remitos })).catch(() => setRes({ busqueda, remitos: [] }));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, clienteId, busqueda]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }} data-testid="elegir-remito">
      <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[85dvh] sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">¿De qué remito se devuelve?</p>
            {clienteNombre && <p className="text-xs text-gray-600 truncate">Remitos de {clienteNombre}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-3 border-b border-gray-200 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder={clienteId ? 'Remito, presupuesto o producto' : 'Remito, cliente o producto'}
              className="w-full h-11 pl-9 pr-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {remitos === null ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>
            : remitos.length === 0 ? <p className="p-6 text-sm text-gray-600 text-center">No hay remitos entregados con algo para devolver{q ? ' que coincidan' : ''}.</p>
            : remitos.map(r => (
              <button key={r.id} onClick={() => onElegir(r.id)} className="w-full text-left px-4 py-3 hover:bg-amber-50 min-h-[56px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-gray-900 truncate">{clienteId ? (r.items_resumen?.[0]?.descripcion ?? r.numero) : (r.cliente_nombre ?? '—')}</span>
                  <span className="text-[11px] font-mono text-gray-600 shrink-0">{r.numero}</span>
                </div>
                <p className="text-[11px] text-gray-600 truncate">
                  {fmtFecha(r.fecha_emision)}{r.operacion_numero ? ` · ${r.operacion_numero}` : ''}
                  {r.estado === 'emitido' ? ' · sin entregar' : ''}
                  {r.items_resumen?.[0] && !clienteId ? ` · ${r.items_resumen[0].cantidad} ${r.items_resumen[0].descripcion}${r.items_resumen.length > 1 ? ` +${r.items_resumen.length - 1}` : ''}` : ''}
                  {clienteId && r.items_resumen && r.items_resumen.length > 1 ? ` · +${r.items_resumen.length - 1} ítem(s)` : ''}
                </p>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
