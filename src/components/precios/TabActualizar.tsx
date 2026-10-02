import { useMemo, useState } from 'react';
import { TrendingUp, ChevronDown, ChevronRight, AlertTriangle, ShoppingBag, FileText, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ProductoRevision, type Revision, type AgruparPor, fmt$, fmtPct, fmtFecha, colorDias, grupoDe } from './tipos';
import { Filtros, CeldaCosto, Motivos, Casilla, HistorialPrecios } from './comunes';
import { aplicarFiltro, FILTRO_VACIO, type Filtro } from './filtros';
import { AsistenteActualizar } from './AsistenteActualizar';

type Orden = 'prioridad' | 'pct' | 'ventas' | 'recargo' | 'antiguedad';
const ORDENES: { v: Orden; l: string }[] = [
  { v: 'prioridad', l: 'Prioridad (lo que más pesa)' },
  { v: 'pct', l: 'Mayor aumento sugerido' },
  { v: 'ventas', l: 'Más vendidos (90 días)' },
  { v: 'recargo', l: 'Recargo más bajo' },
  { v: 'antiguedad', l: 'Precio más viejo' },
];

/** Prioridad: aumento sugerido pesado por lo que se vende y por la antigüedad del precio. */
const prioridad = (p: ProductoRevision) => p.analisis.pct_sugerido * (1 + Math.log1p(p.ventas_90d)) * (1 + Math.min(p.dias, 90) / 90);

/**
 * Recargos fuera de lo normal: lejos del promedio de su familia (más de 15 puntos y más de la
 * mitad del promedio). Suele ser un error de carga del costo o del precio.
 */
function recargosRaros(ps: ProductoRevision[]): Set<string> {
  const porFamilia = new Map<string, number[]>();
  for (const p of ps) if (p.analisis.recargo_actual !== null) porFamilia.set(p.tipo_abertura_id ?? 'sin', [...(porFamilia.get(p.tipo_abertura_id ?? 'sin') ?? []), p.analisis.recargo_actual]);
  const raros = new Set<string>();
  for (const p of ps) {
    const vals = porFamilia.get(p.tipo_abertura_id ?? 'sin') ?? [];
    if (vals.length < 3 || p.analisis.recargo_actual === null) continue;
    const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
    const dif = Math.abs(p.analisis.recargo_actual - prom);
    if (dif > 15 && dif > Math.abs(prom) / 2) raros.add(p.id);
  }
  return raros;
}

// Pestaña 2: lo que conviene actualizar, con herramientas para decidir (agrupar por familia /
// línea / proveedor / medida, prioridad, recargos raros, impacto) y un asistente aparte para
// aplicar el criterio elegido con vista previa.
export function TabActualizar({ revision, soloLectura, onCambio }: { revision: Revision; soloLectura: boolean; onCambio: () => void }) {
  const [verTodos, setVerTodos] = useState(false);
  const base = useMemo(() => revision.productos.filter(p => verTodos ? p.analisis.estado !== 'sin_datos' : p.analisis.estado === 'actualizar'), [revision, verTodos]);
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VACIO);
  const [agrupar, setAgrupar] = useState<AgruparPor | ''>('');
  const [orden, setOrden] = useState<Orden>('prioridad');
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const [asistente, setAsistente] = useState(false);
  const raros = useMemo(() => recargosRaros(revision.productos), [revision]);

  const visibles = useMemo(() => {
    const v = aplicarFiltro(base, filtro);
    const k: Record<Orden, (p: ProductoRevision) => number> = {
      prioridad: p => -prioridad(p), pct: p => -p.analisis.pct_sugerido, ventas: p => -p.ventas_90d,
      recargo: p => p.analisis.recargo_actual ?? 9999, antiguedad: p => -p.dias,
    };
    return [...v].sort((a, b) => k[orden](a) - k[orden](b) || a.nombre.localeCompare(b.nombre));
  }, [base, filtro, orden]);

  const grupos = useMemo(() => {
    if (!agrupar) return null;
    const m = new Map<string, { nombre: string; ps: ProductoRevision[] }>();
    for (const p of visibles) {
      const g = grupoDe(p, agrupar);
      m.set(g.clave, { nombre: g.nombre, ps: [...(m.get(g.clave)?.ps ?? []), p] });
    }
    return [...m.entries()].map(([clave, g]) => {
      const prom = (f: (p: ProductoRevision) => number | null) => {
        const vals = g.ps.map(f).filter((x): x is number => x !== null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      return {
        clave, nombre: g.nombre, ps: g.ps,
        recargo: prom(p => p.analisis.recargo_actual),
        varCosto: prom(p => p.costo > 0 ? (p.analisis.costo_reposicion / p.costo - 1) * 100 : null),
        sugerido: prom(p => p.analisis.pct_sugerido),
      };
    }).sort((a, b) => (b.sugerido ?? 0) - (a.sugerido ?? 0));
  }, [visibles, agrupar]);

  const toggle = (id: string) => setElegidos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleVarios = (ids: string[]) => setElegidos(prev => {
    const n = new Set(prev);
    const todos = ids.every(id => n.has(id));
    ids.forEach(id => (todos ? n.delete(id) : n.add(id)));
    return n;
  });
  const marcadosVisibles = visibles.filter(p => elegidos.has(p.id));

  const fila = (p: ProductoRevision) => (
    <div key={p.id} className={cn(elegidos.has(p.id) && 'bg-orange-50/50')}>
      <div className="px-4 py-2.5 grid grid-cols-[auto_1fr_auto] lg:grid-cols-[auto_minmax(0,1.7fr)_8rem_7rem_9.5rem_minmax(0,1.6fr)_auto] gap-x-3 gap-y-1 items-center">
        <button type="button" onClick={() => toggle(p.id)} aria-label={`Elegir ${p.nombre}`} aria-pressed={elegidos.has(p.id)}><Casilla checked={elegidos.has(p.id)} /></button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{p.nombre}
            {p.precio_manual && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">precio manual</span>}
          </p>
          <p className="text-[11px] text-gray-600 truncate">{[p.codigo, p.familia ?? 'Sin familia', p.linea ?? p.sistema, p.proveedor].filter(Boolean).join(' · ')}</p>
        </div>
        <CeldaCosto p={p} />
        <div className="col-start-2 lg:col-start-auto text-left lg:text-right leading-tight">
          <p className={cn('text-xs font-bold', raros.has(p.id) ? 'text-red-700' : 'text-gray-800')} title="Recargo sobre costo">
            {fmtPct(p.analisis.recargo_actual, false)}
            {raros.has(p.id) && <AlertTriangle size={11} className="inline ml-1 -mt-0.5" />}
          </p>
          <p className="text-[11px] text-gray-600">{p.recargo_objetivo ? `objetivo ${p.recargo_objetivo} %` : 'recargo'}</p>
        </div>
        <div className="col-start-2 lg:col-start-auto text-left lg:text-right leading-tight">
          <p className="text-xs text-gray-600 tabular-nums">{fmt$(p.precio)} →</p>
          <p className="text-sm font-extrabold text-orange-700 tabular-nums">{fmt$(p.analisis.precio_sugerido)} <span className="text-[11px]">({fmtPct(p.analisis.pct_sugerido)})</span></p>
        </div>
        <div className="col-start-2 col-span-2 lg:col-span-1 lg:col-start-auto min-w-0 space-y-1">
          <Motivos motivos={raros.has(p.id) ? [...p.analisis.motivos, { tipo: 'aviso', texto: 'Recargo muy distinto al de su familia' }] : p.analisis.motivos} />
          <p className="text-[11px] text-gray-600 flex flex-wrap gap-x-2.5">
            <span className={colorDias(p.dias, revision.config)}>Renovado {fmtFecha(p.precio_actualizado_at)}</span>
            {p.ventas_90d > 0 && <span className="inline-flex items-center gap-0.5"><ShoppingBag size={11} />{p.ventas_90d} vendidos</span>}
            {p.proformas_abiertas > 0 && <span className="inline-flex items-center gap-0.5" title="Proformas enviadas y vigentes con este producto: no cambian su precio"><FileText size={11} />{p.proformas_abiertas} proformas abiertas</span>}
            {p.en_salon && p.stock > 0 && <span className="inline-flex items-center gap-0.5" title="Stock comprado a costo anterior"><Store size={11} />{p.stock} en salón</span>}
          </p>
        </div>
        <button type="button" onClick={() => setAbierto(a => a === p.id ? null : p.id)}
          className="col-start-3 row-start-1 lg:col-start-auto lg:row-start-auto text-[11px] font-semibold text-gray-600 hover:text-orange-700 inline-flex items-center gap-0.5">
          {abierto === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Historial
        </button>
      </div>
      {abierto === p.id && <div className="px-4 pb-3 lg:pl-12"><HistorialPrecios productoId={p.id} /></div>}
    </div>
  );

  const sel = 'h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs text-gray-700';
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-900">
        <b>{revision.productos.filter(p => p.analisis.estado === 'actualizar').length} productos para actualizar</b>: subió la
        lista del proveedor, la última compra o el dólar más de {revision.config.umbral_pct} %, o el recargo quedó por debajo
        del objetivo. El precio sugerido mantiene el recargo sobre el costo de reposición, o sigue al dólar (el mayor de los dos).
      </div>

      <Filtros productos={base} filtro={filtro} onChange={setFiltro} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-700 inline-flex items-center gap-1.5">Agrupar por
          <select value={agrupar} onChange={e => setAgrupar(e.target.value as AgruparPor | '')} className={sel}>
            <option value="">Sin agrupar</option>
            <option value="familia">Familia</option>
            <option value="linea">Línea / sistema</option>
            <option value="proveedor">Proveedor</option>
            <option value="medida">A medida / por unidad</option>
          </select>
        </label>
        <label className="text-xs text-gray-700 inline-flex items-center gap-1.5">Ordenar por
          <select value={orden} onChange={e => setOrden(e.target.value as Orden)} className={sel}>
            {ORDENES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </label>
        <label className="ml-auto text-xs text-gray-700 inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={verTodos} onChange={e => setVerTodos(e.target.checked)} /> Ver también los que no necesitan cambio
        </label>
      </div>

      <div className="rounded-2xl border border-gray-300 bg-white overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
          <button type="button" onClick={() => toggleVarios(visibles.map(p => p.id))} disabled={!visibles.length}
            className="inline-flex items-center gap-2 text-xs font-semibold text-orange-700 disabled:opacity-40">
            <Casilla checked={visibles.length > 0 && marcadosVisibles.length === visibles.length} /> Marcar los {visibles.length} de la lista
          </button>
          {elegidos.size > 0 && <button type="button" onClick={() => setElegidos(new Set())} className="ml-auto text-xs text-gray-600 hover:underline">Limpiar ({elegidos.size})</button>}
        </div>
        {visibles.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-600">No hay productos para actualizar con estos filtros.</p>
        ) : grupos ? (
          grupos.map(g => (
            <section key={g.clave}>
              <div className="px-4 py-2 bg-orange-50 border-y border-orange-100 flex flex-wrap items-center gap-x-4 gap-y-1">
                <button type="button" onClick={() => toggleVarios(g.ps.map(p => p.id))} className="inline-flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Casilla checked={g.ps.every(p => elegidos.has(p.id))} /> {g.nombre} <span className="text-xs font-semibold text-gray-600">({g.ps.length})</span>
                </button>
                <span className="text-xs text-gray-700">recargo prom. <b>{fmtPct(g.recargo, false)}</b></span>
                <span className="text-xs text-gray-700">costo <b>{fmtPct(g.varCosto)}</b></span>
                <span className="text-xs text-orange-800">sugerido prom. <b>{fmtPct(g.sugerido)}</b></span>
              </div>
              <div className="divide-y divide-gray-100">{g.ps.map(fila)}</div>
            </section>
          ))
        ) : (
          <div className="divide-y divide-gray-100">{visibles.map(fila)}</div>
        )}
      </div>

      {!soloLectura && (
        <div className="sticky bottom-2 flex justify-end">
          <button type="button" onClick={() => setAsistente(true)} disabled={!elegidos.size}
            className="h-11 px-5 rounded-xl bg-orange-600 text-white text-sm font-bold shadow-lg hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2">
            <TrendingUp size={16} /> Actualizar precios ({elegidos.size})…
          </button>
        </div>
      )}

      {asistente && (
        <AsistenteActualizar
          productos={revision.productos.filter(p => elegidos.has(p.id))}
          onClose={() => setAsistente(false)}
          onAplicado={() => { setAsistente(false); setElegidos(new Set()); onCambio(); }}
        />
      )}
    </div>
  );
}
