import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, TrendingUp, ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { type ProductoRevision, type AgruparPor, fmt$, fmtPct, grupoDe } from './tipos';
import { Casilla } from './comunes';

type TipoCriterio = 'sugerido' | 'porcentaje' | 'dolar' | 'costo' | 'grupos';

interface ItemPrevia {
  id: string; nombre: string; codigo: string | null; familia: string | null; linea: string | null; proveedor: string | null;
  precio_manual: boolean; precio_por_m2: boolean;
  precio_actual: number; precio_nuevo: number; pct: number;
  costo_actual: number; costo_nuevo: number | null; recargo_nuevo: number | null; recargo_objetivo: number | null;
}

const CRITERIOS: { v: TipoCriterio; titulo: string; texto: string }[] = [
  { v: 'sugerido', titulo: 'Sugerido', texto: 'El precio que propone el análisis para cada producto (costo de reposición con su recargo, o el dólar, el mayor).' },
  { v: 'porcentaje', titulo: 'Porcentaje fijo', texto: 'El mismo aumento para todos los elegidos.' },
  { v: 'dolar', titulo: 'Según el dólar blue', texto: 'Cada producto sube lo que subió el dólar desde su última actualización.' },
  { v: 'costo', titulo: 'Costo de reposición + recargo', texto: 'Precio = costo actualizado × (1 + recargo): el que ya tiene, o el objetivo si estaba por debajo.' },
  { v: 'grupos', titulo: 'Porcentaje por grupo', texto: 'Un aumento distinto por familia, línea, proveedor o por m² (por ejemplo +8 % Módena, +5 % Herrero).' },
];
const REDONDEOS = [0, 10, 100, 1000];

// Ventana aparte para aplicar la actualización de precios: criterio → redondeo → vista previa
// editable → confirmar (todo o nada, con historial). Los de "precio manual" quedan afuera
// salvo que se marquen a propósito.
export function AsistenteActualizar({ productos, onClose, onAplicado }: { productos: ProductoRevision[]; onClose: () => void; onAplicado: () => void }) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [tipo, setTipo] = useState<TipoCriterio>('sugerido');
  const [pct, setPct] = useState(5);
  const [actualizarCosto, setActualizarCosto] = useState(true);
  const [por, setPor] = useState<AgruparPor>('familia');
  const [pctsGrupo, setPctsGrupo] = useState<Record<string, number>>({});
  const [redondeo, setRedondeo] = useState(100);
  const [items, setItems] = useState<ItemPrevia[]>([]);
  const [incluir, setIncluir] = useState<Set<string>>(new Set());
  const [editados, setEditados] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const grupos = useMemo(() => {
    const m = new Map<string, { nombre: string; n: number }>();
    for (const p of productos) { const g = grupoDe(p, por); m.set(g.clave, { nombre: g.nombre, n: (m.get(g.clave)?.n ?? 0) + 1 }); }
    return [...m.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  }, [productos, por]);

  const criterio = () => {
    if (tipo === 'porcentaje') return { tipo, pct };
    if (tipo === 'costo') return { tipo, actualizar_costo: actualizarCosto };
    if (tipo === 'grupos') return { tipo, por, pcts: pctsGrupo };
    return { tipo };
  };
  const etiquetaCriterio = () => {
    const r = redondeo ? `, redondeo $ ${redondeo.toLocaleString('es-AR')}` : '';
    if (tipo === 'porcentaje') return `porcentaje ${fmtPct(pct)}${r}`;
    if (tipo === 'grupos') return `por ${por}: ${grupos.filter(([k]) => pctsGrupo[k] !== undefined).map(([k, g]) => `${g.nombre} ${fmtPct(pctsGrupo[k])}`).join(', ')}${r}`;
    return `${CRITERIOS.find(c => c.v === tipo)!.titulo.toLowerCase()}${r}`;
  };

  async function verPrevia() {
    setCargando(true);
    try {
      const r = await api.post<{ items: ItemPrevia[] }>('/productos/revision-precios/previsualizar', { ids: productos.map(p => p.id), criterio: criterio(), redondeo });
      setItems(r.items);
      setIncluir(new Set(r.items.filter(i => !i.precio_manual && Math.abs(i.precio_nuevo - i.precio_actual) >= 0.01).map(i => i.id)));
      setEditados({});
      setPaso(2);
    } catch (e) {
      toast.error('No se pudo calcular', { description: (e as Error).message });
    } finally {
      setCargando(false);
    }
  }

  const precioFinal = (i: ItemPrevia) => editados[i.id] ?? i.precio_nuevo;
  const incluidos = items.filter(i => incluir.has(i.id));
  const ventas = useMemo(() => new Map(productos.map(p => [p.id, p.ventas_90d])), [productos]);
  const resumen = useMemo(() => {
    const prom = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    const antes = prom(incluidos.filter(i => i.costo_actual > 0).map(i => (i.precio_actual / i.costo_actual - 1) * 100));
    const despues = prom(incluidos.filter(i => (i.costo_nuevo ?? i.costo_actual) > 0).map(i => (precioFinal(i) / (i.costo_nuevo ?? i.costo_actual) - 1) * 100));
    const impacto = incluidos.reduce((a, i) => a + (ventas.get(i.id) ?? 0) * (precioFinal(i) - i.precio_actual), 0);
    const aumentoProm = prom(incluidos.map(i => (precioFinal(i) / i.precio_actual - 1) * 100));
    return { antes, despues, impacto, aumentoProm };
  }, [incluidos, editados, ventas]); // eslint-disable-line react-hooks/exhaustive-deps

  async function aplicar() {
    if (!incluidos.length || cargando) return;
    setCargando(true);
    try {
      const r = await api.post<{ actualizados: number }>('/productos/revision-precios/aplicar', {
        criterio: etiquetaCriterio(),
        items: incluidos.map(i => ({ id: i.id, precio_nuevo: precioFinal(i), costo_nuevo: i.costo_nuevo })),
      });
      toast.success(`Precios actualizados en ${r.actualizados} producto${r.actualizados !== 1 ? 's' : ''}`);
      onAplicado();
    } catch (e) {
      toast.error('No se pudo aplicar', { description: (e as Error).message });
    } finally {
      setCargando(false);
    }
  }

  const input = 'h-9 px-2 rounded-lg border border-gray-300 text-sm tabular-nums';
  return createPortal(
    <div className="fixed inset-0 z-[9100] flex items-stretch sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Actualizar precios" onClick={e => e.stopPropagation()}
        className={cn('bg-white w-full sm:rounded-2xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[90dvh]', paso === 2 ? 'sm:max-w-5xl' : 'sm:max-w-2xl')}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2 shrink-0">
          <TrendingUp size={18} className="text-orange-600" />
          <h2 className="text-base font-bold text-gray-900">Actualizar precios · {productos.length} producto{productos.length !== 1 ? 's' : ''}</h2>
          <span className="text-xs text-gray-600 ml-2">Paso {paso} de 2</span>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {paso === 1 ? (
          <div className="p-5 space-y-4 overflow-y-auto">
            <div>
              <p className="text-xs font-bold text-gray-800 mb-2">1. Criterio</p>
              <div className="space-y-1.5">
                {CRITERIOS.map(c => (
                  <label key={c.v} className={cn('flex gap-3 p-3 rounded-xl border cursor-pointer', tipo === c.v ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-400')}>
                    <input type="radio" name="criterio" checked={tipo === c.v} onChange={() => setTipo(c.v)} className="mt-1" />
                    <span className="flex-1">
                      <span className="block text-sm font-bold text-gray-900">{c.titulo}</span>
                      <span className="block text-xs text-gray-600">{c.texto}</span>
                      {tipo === 'porcentaje' && c.v === 'porcentaje' && (
                        <span className="mt-2 inline-flex items-center gap-2 text-sm">Aumento
                          <input type="number" step="0.5" value={pct} onChange={e => setPct(Number(e.target.value))} className={cn(input, 'w-24')} aria-label="Porcentaje" /> %
                        </span>
                      )}
                      {tipo === 'costo' && c.v === 'costo' && (
                        <span className="mt-2 flex items-center gap-2 text-xs text-gray-800">
                          <input type="checkbox" checked={actualizarCosto} onChange={e => setActualizarCosto(e.target.checked)} />
                          Actualizar también el costo cargado al de reposición
                        </span>
                      )}
                      {tipo === 'grupos' && c.v === 'grupos' && (
                        <span className="mt-2 block space-y-2">
                          <select value={por} onChange={e => { setPor(e.target.value as AgruparPor); setPctsGrupo({}); }} className={cn(input, 'text-xs')} aria-label="Agrupar por">
                            <option value="familia">Por familia</option>
                            <option value="linea">Por línea / sistema</option>
                            <option value="proveedor">Por proveedor</option>
                            <option value="medida">A medida / por unidad</option>
                          </select>
                          {grupos.map(([k, g]) => (
                            <span key={k} className="flex items-center gap-2 text-sm">
                              <span className="flex-1 min-w-0 truncate">{g.nombre} <span className="text-xs text-gray-600">({g.n})</span></span>
                              <input type="number" step="0.5" value={pctsGrupo[k] ?? ''} placeholder="sin cambio" aria-label={`Porcentaje ${g.nombre}`}
                                onChange={e => setPctsGrupo(prev => { const n = { ...prev }; if (e.target.value === '') delete n[k]; else n[k] = Number(e.target.value); return n; })}
                                className={cn(input, 'w-28')} /> %
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800 mb-2">2. Redondeo (hacia arriba)</p>
              <div className="flex gap-1.5 flex-wrap">
                {REDONDEOS.map(r => (
                  <button key={r} type="button" onClick={() => setRedondeo(r)}
                    className={cn('h-9 px-3 rounded-lg border text-xs font-semibold', redondeo === r ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300 text-gray-700')}>
                    {r ? `a $ ${r.toLocaleString('es-AR')}` : 'Sin redondeo'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs sticky top-0 z-10">
              <div><p className="text-gray-600">Productos que cambian</p><p className="text-base font-extrabold text-gray-900">{incluidos.length} de {items.length}</p></div>
              <div><p className="text-gray-600">Aumento promedio</p><p className="text-base font-extrabold text-orange-700">{fmtPct(resumen.aumentoProm)}</p></div>
              <div><p className="text-gray-600">Recargo promedio</p><p className="text-base font-extrabold text-gray-900">{fmtPct(resumen.antes, false)} → {fmtPct(resumen.despues, false)}</p></div>
              <div title="Si se hubiera vendido lo mismo que en los últimos 90 días a los precios nuevos"><p className="text-gray-600">Sobre lo vendido en 90 días</p><p className="text-base font-extrabold text-emerald-700">{resumen.impacto >= 0 ? '+' : ''}{fmt$(resumen.impacto)}</p></div>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map(i => {
                const nuevo = precioFinal(i);
                const pctFinal = (nuevo / i.precio_actual - 1) * 100;
                const costoRef = i.costo_nuevo ?? i.costo_actual;
                const recargo = costoRef > 0 ? (nuevo / costoRef - 1) * 100 : null;
                const baja = nuevo < i.precio_actual - 0.009;
                const bajoObjetivo = i.recargo_objetivo !== null && recargo !== null && recargo < i.recargo_objetivo - 0.5;
                const on = incluir.has(i.id);
                return (
                  <div key={i.id} className={cn('px-5 py-2.5 grid grid-cols-[auto_1fr] md:grid-cols-[auto_minmax(0,2fr)_7rem_9rem_6rem_minmax(0,1fr)] gap-x-3 gap-y-1 items-center', !on && 'opacity-60')}>
                    <button type="button" aria-pressed={on} aria-label={`Incluir ${i.nombre}`}
                      onClick={() => setIncluir(prev => { const n = new Set(prev); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })}>
                      <Casilla checked={on} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{i.nombre}{i.precio_por_m2 && <span className="text-[11px] text-gray-600"> (por m²)</span>}</p>
                      <p className="text-[11px] text-gray-600 truncate">{[i.codigo, i.familia, i.linea, i.proveedor].filter(Boolean).join(' · ')}</p>
                    </div>
                    <p className="col-start-2 md:col-start-auto text-xs text-gray-600 md:text-right tabular-nums">
                      {fmt$(i.precio_actual)}{i.costo_nuevo !== null && <span className="block">costo {fmt$(i.costo_actual)} → {fmt$(i.costo_nuevo)}</span>}
                    </p>
                    <input type="number" step="1" min="1" value={Math.round(nuevo * 100) / 100} aria-label={`Precio nuevo de ${i.nombre}`}
                      onChange={e => setEditados(prev => ({ ...prev, [i.id]: Number(e.target.value) }))}
                      className={cn(input, 'col-start-2 md:col-start-auto w-full font-bold', baja ? 'border-red-400 text-red-700' : 'text-orange-800')} />
                    <p className={cn('col-start-2 md:col-start-auto text-sm font-bold md:text-right tabular-nums', pctFinal < 0 ? 'text-red-700' : 'text-gray-900')}>{fmtPct(pctFinal)}</p>
                    <div className="col-start-2 md:col-start-auto text-[11px] space-y-0.5">
                      <p className="text-gray-700">recargo {fmtPct(recargo, false)}</p>
                      {i.precio_manual && <p className="text-gray-700 font-semibold">Precio manual: excluido salvo que lo marques</p>}
                      {baja && <p className="text-red-700 font-semibold inline-flex items-center gap-1"><AlertTriangle size={11} /> El precio baja</p>}
                      {bajoObjetivo && <p className="text-red-700">Queda bajo el objetivo ({i.recargo_objetivo} %)</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-200 flex items-center gap-2 shrink-0">
          {paso === 2 && (
            <button onClick={() => setPaso(1)} className="h-10 px-3 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1">
              <ArrowLeft size={15} /> Cambiar criterio
            </button>
          )}
          <p className="hidden md:block text-[11px] text-gray-600">Las proformas ya enviadas no cambian: guardan su propio precio.</p>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
            {paso === 1 ? (
              <button onClick={verPrevia} disabled={cargando || (tipo === 'grupos' && !Object.keys(pctsGrupo).length)}
                className="h-10 px-5 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2">
                {cargando && <Loader2 size={15} className="animate-spin" />} Ver vista previa
              </button>
            ) : (
              <button onClick={aplicar} disabled={cargando || !incluidos.length}
                className="h-10 px-5 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2">
                {cargando && <Loader2 size={15} className="animate-spin" />} Aplicar a {incluidos.length}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
