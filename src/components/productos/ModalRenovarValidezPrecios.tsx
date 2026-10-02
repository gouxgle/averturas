import { useMemo, useState } from 'react';
import { X, RefreshCw, Check, AlertTriangle, Loader2, Search, Layers, ListChecks } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import type { Producto } from '@/types';

function diasDesde(fechaIso: string): number {
  return Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86400000);
}

type Estado = 'vencido' | 'por_vencer' | 'al_dia';
/** Mismo semáforo que la tarjeta del producto: verde ≤7 días, amarillo 8-10, rojo >10. */
function estadoPrecio(p: Producto): Estado {
  if (!p.precio_actualizado_at) return 'vencido';
  const d = diasDesde(p.precio_actualizado_at);
  return d > 10 ? 'vencido' : d >= 8 ? 'por_vencer' : 'al_dia';
}
const ESTADO_UI: Record<Estado, { label: string; punto: string; texto: string }> = {
  vencido:    { label: 'Vencidos',   punto: 'bg-red-500',     texto: 'text-red-600' },
  por_vencer: { label: 'Por vencer', punto: 'bg-amber-500',   texto: 'text-amber-600' },
  al_dia:     { label: 'Al día',     punto: 'bg-emerald-500', texto: 'text-emerald-600' },
};
const fmtPrecio = (n: number) => `$ ${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

interface FamiliaResumen {
  id: string;
  nombre: string;
  total: number;
  vencidos: number;   // >10 días — rojo
  porVencer: number;  // 8-10 días — amarillo
}

// Renovar la fecha de "precio actualizado" sin tocar el precio en sí — para cuando el
// panorama económico no amerita cambios y no tiene sentido revisar producto por producto
// solo para resetear el semáforo (rojo >10 días, ver colorPorAntiguedadPrecio en
// TarjetaProductoMosaico.tsx). Dos formas: por familia completa, o eligiendo productos
// sueltos (con buscador y filtros por familia, proveedor y estado del precio).
export function ModalRenovarValidezPrecios({ productos, onClose, onRenovado }: {
  productos: Producto[];
  onClose: () => void;
  onRenovado: () => void;
}) {
  const [modo, setModo] = useState<'familias' | 'productos'>('familias');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [familiaFiltro, setFamiliaFiltro] = useState('');
  const [proveedorFiltro, setProveedorFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<Estado | ''>('');
  const [guardando, setGuardando] = useState(false);

  const activos = useMemo(() => productos.filter(p => p.activo), [productos]);
  const proveedores = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of activos) if (p.proveedor_id) m.set(p.proveedor_id, p.proveedor?.nombre ?? 'Proveedor');
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [activos]);
  const familiasFiltro = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of activos) if (p.tipo_abertura_id) m.set(p.tipo_abertura_id, p.tipo_abertura?.nombre ?? 'Familia');
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [activos]);

  // Productos que pasan los filtros; los vencidos primero, después los más viejos
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return activos
      .filter(p => !q || [p.nombre, p.codigo, p.color, p.proveedor?.nombre].some(v => v?.toLowerCase().includes(q)))
      .filter(p => !familiaFiltro || (familiaFiltro === 'sin' ? !p.tipo_abertura_id : p.tipo_abertura_id === familiaFiltro))
      .filter(p => !proveedorFiltro || p.proveedor_id === proveedorFiltro)
      .filter(p => !estadoFiltro || estadoPrecio(p) === estadoFiltro)
      .sort((a, b) => (a.precio_actualizado_at ?? '').localeCompare(b.precio_actualizado_at ?? '') || a.nombre.localeCompare(b.nombre));
  }, [activos, busqueda, familiaFiltro, proveedorFiltro, estadoFiltro]);

  const conteoEstados = useMemo(() => {
    const c: Record<Estado, number> = { vencido: 0, por_vencer: 0, al_dia: 0 };
    for (const p of activos) c[estadoPrecio(p)]++;
    return c;
  }, [activos]);

  const todosVisiblesElegidos = visibles.length > 0 && visibles.every(p => elegidos.has(p.id));
  function toggleProducto(id: string) {
    setElegidos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleVisibles() {
    setElegidos(prev => {
      const n = new Set(prev);
      if (todosVisiblesElegidos) visibles.forEach(p => n.delete(p.id)); else visibles.forEach(p => n.add(p.id));
      return n;
    });
  }

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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleTodas() {
    setSeleccion(prev => prev.size === familias.length ? new Set() : new Set(familias.map(f => f.id)));
  }

  async function confirmar() {
    if (cantidadARenovar === 0) return;
    setGuardando(true);
    try {
      const r = await api.patch<{ actualizados: number }>('/productos/renovar-validez-precios',
        modo === 'familias' ? { tipo_abertura_ids: [...seleccion] } : { producto_ids: [...elegidos] });
      toast.success(`Validez renovada en ${r.actualizados} producto${r.actualizados !== 1 ? 's' : ''}`);
      onRenovado();
      onClose();
    } catch (e) {
      toastApiError(e, { fallback: 'No se pudo renovar la validez' });
    } finally {
      setGuardando(false);
    }
  }

  const totalSeleccionado = familias.filter(f => seleccion.has(f.id)).reduce((s, f) => s + f.total, 0);
  const cantidadARenovar = modo === 'familias' ? totalSeleccionado : elegidos.size;
  const selectCls = 'h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-400 min-w-0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cn('bg-white rounded-2xl shadow-2xl w-full max-h-[88dvh] overflow-hidden flex flex-col', modo === 'productos' ? 'max-w-2xl' : 'max-w-md')}>
        <div className="px-6 py-4 bg-gradient-to-r from-sky-600 to-blue-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-white" />
            <h2 className="text-sm font-bold text-white">Renovar validez de precios</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} className="text-white" /></button>
        </div>

        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-gray-200 shrink-0 space-y-2.5">
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl" role="tablist">
            {([['familias', 'Por familia', Layers], ['productos', 'Elegir productos', ListChecks]] as const).map(([v, l, I]) => (
              <button key={v} type="button" role="tab" aria-selected={modo === v} onClick={() => setModo(v)}
                className={cn('h-9 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors',
                  modo === v ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-600 hover:text-gray-800')}>
                <I size={14} /> {l}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600">
            {modo === 'familias'
              ? 'Elegí las familias que revisaste y siguen vigentes.'
              : 'Buscá y marcá los productos que revisaste: podés filtrar por familia, proveedor o estado del precio.'}
            {' '}Los precios quedan igual: solo se renueva la fecha.
          </p>
          {modo === 'productos' && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, código, color o proveedor"
                  aria-label="Buscar productos"
                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={familiaFiltro} onChange={e => setFamiliaFiltro(e.target.value)} className={selectCls} aria-label="Familia">
                  <option value="">Todas las familias</option>
                  {familiasFiltro.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                  <option value="sin">Sin familia</option>
                </select>
                <select value={proveedorFiltro} onChange={e => setProveedorFiltro(e.target.value)} className={selectCls} aria-label="Proveedor">
                  <option value="">Todos los proveedores</option>
                  {proveedores.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                </select>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => setEstadoFiltro('')}
                  className={cn('h-8 px-2.5 rounded-full text-[11px] font-bold border', !estadoFiltro ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200')}>
                  Todos ({activos.length})
                </button>
                {(Object.keys(ESTADO_UI) as Estado[]).map(k => (
                  <button key={k} type="button" onClick={() => setEstadoFiltro(k)}
                    className={cn('h-8 px-2.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5',
                      estadoFiltro === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200')}>
                    <span className={cn('w-2 h-2 rounded-full', ESTADO_UI[k].punto)} /> {ESTADO_UI[k].label} ({conteoEstados[k]})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {modo === 'productos' && (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <button type="button" onClick={toggleVisibles} disabled={!visibles.length}
                className="text-xs font-semibold text-sky-600 hover:underline disabled:opacity-40">
                {todosVisiblesElegidos ? `Desmarcar los ${visibles.length} de la lista` : `Marcar los ${visibles.length} de la lista`}
              </button>
              {elegidos.size > 0 && (
                <button type="button" onClick={() => setElegidos(new Set())} className="text-xs text-gray-500 hover:underline">
                  Limpiar selección ({elegidos.size})
                </button>
              )}
            </div>
            {visibles.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-6">Ningún producto coincide con la búsqueda.</p>
            ) : (
              <div className="space-y-1">
                {visibles.map(p => {
                  const checked = elegidos.has(p.id);
                  const est = ESTADO_UI[estadoPrecio(p)];
                  const dias = p.precio_actualizado_at ? diasDesde(p.precio_actualizado_at) : null;
                  return (
                    <button key={p.id} type="button" onClick={() => toggleProducto(p.id)} aria-pressed={checked}
                      className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-colors',
                        checked ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:border-gray-400')}>
                      <div className={cn('w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0',
                        checked ? 'bg-sky-600 border-sky-600' : 'border-gray-400')}>
                        {checked && <Check size={11} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{p.nombre}</p>
                        <p className="text-[11px] text-gray-600 truncate">
                          {[p.codigo, p.tipo_abertura?.nombre ?? 'Sin familia', p.proveedor?.nombre].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {/* Costo (referencia contra el precio del proveedor) y última renovación */}
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-gray-800 tabular-nums" title="Precio de costo">costo {fmtPrecio(p.costo_base)}</p>
                        <p className={cn('text-[11px] font-semibold inline-flex items-center gap-1', est.texto)}
                          title={dias === null ? '' : `hace ${dias} día${dias !== 1 ? 's' : ''}`}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', est.punto)} />
                          {p.precio_actualizado_at
                            ? `renovado ${new Date(p.precio_actualizado_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`
                            : 'sin fecha'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {modo === 'familias' && <div className="flex-1 overflow-y-auto px-6 py-3">
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
                        'w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0',
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
        </div>}

        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={guardando || cantidadARenovar === 0}
            className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Renovar {cantidadARenovar > 0 ? `(${cantidadARenovar})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
