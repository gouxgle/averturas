import { useMemo, useState } from 'react';
import { X, RefreshCw, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Producto } from '@/types';

function diasDesde(fechaIso: string): number {
  return Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86400000);
}

interface FamiliaResumen {
  id: string;
  nombre: string;
  total: number;
  vencidos: number;   // >10 días — rojo
  porVencer: number;  // 8-10 días — amarillo
}

// Renovar la fecha de "precio actualizado" por familia de abertura, sin tocar el
// precio en sí — para cuando el panorama económico no amerita cambios y no tiene
// sentido revisar producto por producto solo para resetear el semáforo (rojo >10
// días, ver colorPorAntiguedadPrecio en TarjetaProductoMosaico.tsx).
export function ModalRenovarValidezPrecios({ productos, onClose, onRenovado }: {
  productos: Producto[];
  onClose: () => void;
  onRenovado: () => void;
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);

  const familias = useMemo<FamiliaResumen[]>(() => {
    const mapa = new Map<string, FamiliaResumen>();
    for (const p of productos) {
      if (!p.tipo_abertura_id || !p.activo) continue;
      const nombre = p.tipo_abertura?.nombre ?? 'Sin familia';
      const f = mapa.get(p.tipo_abertura_id) ?? { id: p.tipo_abertura_id, nombre, total: 0, vencidos: 0, porVencer: 0 };
      f.total += 1;
      if (p.precio_actualizado_at) {
        const dias = diasDesde(p.precio_actualizado_at);
        if (dias > 10) f.vencidos += 1;
        else if (dias >= 8) f.porVencer += 1;
      }
      mapa.set(p.tipo_abertura_id, f);
    }
    return [...mapa.values()].sort((a, b) => (b.vencidos + b.porVencer) - (a.vencidos + a.porVencer));
  }, [productos]);

  function toggle(id: string) {
    setSeleccion(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodas() {
    setSeleccion(prev => prev.size === familias.length ? new Set() : new Set(familias.map(f => f.id)));
  }

  async function confirmar() {
    if (seleccion.size === 0) return;
    setGuardando(true);
    try {
      const r = await api.patch<{ actualizados: number }>('/productos/renovar-validez-precios', {
        tipo_abertura_ids: [...seleccion],
      });
      toast.success(`Validez renovada en ${r.actualizados} producto${r.actualizados !== 1 ? 's' : ''}`);
      onRenovado();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo renovar la validez');
    } finally {
      setGuardando(false);
    }
  }

  const totalSeleccionado = familias.filter(f => seleccion.has(f.id)).reduce((s, f) => s + f.total, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-gradient-to-r from-sky-600 to-blue-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-white" />
            <h2 className="text-sm font-bold text-white">Renovar validez de precios</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} className="text-white" /></button>
        </div>

        <div className="px-6 py-3 border-b border-gray-200 shrink-0">
          <p className="text-xs text-gray-600">
            Elegí las familias que revisaste y siguen vigentes — se les marca el precio como recién actualizado
            sin cambiar ningún valor. Los precios quedan igual, solo se renueva la fecha.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {familias.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-6">No hay productos con familia asignada.</p>
          ) : (
            <>
              <button type="button" onClick={toggleTodas}
                className="text-xs font-semibold text-sky-600 hover:underline mb-2">
                {seleccion.size === familias.length ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
              <div className="space-y-1.5">
                {familias.map(f => {
                  const checked = seleccion.has(f.id);
                  return (
                    <button key={f.id} type="button" onClick={() => toggle(f.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors',
                        checked ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:border-gray-400'
                      )}>
                      <div className={cn(
                        'w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center shrink-0',
                        checked ? 'bg-sky-600 border-sky-600' : 'border-gray-400'
                      )}>
                        {checked && <Check size={11} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{f.nombre}</p>
                        <p className="text-[11px] text-gray-600">{f.total} producto{f.total !== 1 ? 's' : ''}</p>
                      </div>
                      {(f.vencidos > 0 || f.porVencer > 0) && (
                        <div className="flex items-center gap-1 shrink-0">
                          <AlertTriangle size={11} className={f.vencidos > 0 ? 'text-red-500' : 'text-amber-500'} />
                          <span className={cn('text-[11px] font-bold', f.vencidos > 0 ? 'text-red-600' : 'text-amber-600')}>
                            {f.vencidos + f.porVencer}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={guardando || seleccion.size === 0}
            className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Renovar {totalSeleccionado > 0 ? `(${totalSeleccionado})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
