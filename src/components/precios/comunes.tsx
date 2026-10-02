import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { type ProductoRevision, type Motivo, fmt$, fmtPct, fmtFecha, MOTIVO_CLS } from './tipos';
import type { Filtro } from './filtros';

// Piezas compartidas por las pestañas de la Revisión integral de precios.

function opciones(ps: ProductoRevision[], id: (p: ProductoRevision) => string | null, nombre: (p: ProductoRevision) => string | null) {
  const m = new Map<string, string>();
  for (const p of ps) { const k = id(p); if (k) m.set(k, nombre(p) ?? '—'); }
  return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

export function Filtros({ productos, filtro, onChange }: { productos: ProductoRevision[]; filtro: Filtro; onChange: (f: Filtro) => void }) {
  const familias = useMemo(() => opciones(productos, p => p.tipo_abertura_id, p => p.familia), [productos]);
  const proveedores = useMemo(() => opciones(productos, p => p.proveedor_id, p => p.proveedor), [productos]);
  const lineas = useMemo(() => opciones(productos, p => p.linea_id ?? p.sistema_id, p => p.linea ?? p.sistema), [productos]);
  const sel = 'h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 min-w-0';
  return (
    <div className="grid grid-cols-2 md:grid-cols-[minmax(12rem,2fr)_1fr_1fr_1fr] gap-2">
      <div className="relative col-span-2 md:col-span-1">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={filtro.q} onChange={e => onChange({ ...filtro, q: e.target.value })} placeholder="Buscar producto, código, color o proveedor"
          aria-label="Buscar" className="w-full h-9 pl-8 pr-3 rounded-lg border border-gray-300 text-sm" />
      </div>
      <select value={filtro.familia} onChange={e => onChange({ ...filtro, familia: e.target.value })} className={sel} aria-label="Familia">
        <option value="">Todas las familias</option>
        {familias.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        <option value="sin">Sin familia</option>
      </select>
      <select value={filtro.proveedor} onChange={e => onChange({ ...filtro, proveedor: e.target.value })} className={sel} aria-label="Proveedor">
        <option value="">Todos los proveedores</option>
        {proveedores.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        <option value="sin">Sin proveedor</option>
      </select>
      <select value={filtro.linea} onChange={e => onChange({ ...filtro, linea: e.target.value })} className={sel} aria-label="Línea o sistema">
        <option value="">Todas las líneas</option>
        {lineas.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
      </select>
    </div>
  );
}

/** Costo cargado y, debajo, el de la lista del proveedor y el de la última compra si difieren. */
export function CeldaCosto({ p }: { p: ProductoRevision }) {
  const difiere = (v: number | null) => v !== null && Math.abs(v - p.costo) >= 1;
  return (
    <div className="text-right leading-tight">
      <p className="text-sm font-bold text-gray-900 tabular-nums">{fmt$(p.costo)}</p>
      {difiere(p.costo_lista) && (
        <p className="text-[11px] text-amber-800 tabular-nums" title={`Lista del proveedor actualizada el ${fmtFecha(p.costo_lista_fecha)}`}>
          lista {fmt$(p.costo_lista)} ({fmtPct(p.analisis.var_lista)})
        </p>
      )}
      {difiere(p.costo_compra) && (
        <p className="text-[11px] text-gray-600 tabular-nums" title={`Última compra del ${fmtFecha(p.costo_compra_fecha)} (neto con descuento)`}>
          compra {fmt$(p.costo_compra)} · {fmtFecha(p.costo_compra_fecha)}
        </p>
      )}
    </div>
  );
}

export function Motivos({ motivos, vacio }: { motivos: Motivo[]; vacio?: string }) {
  if (!motivos.length) return vacio ? <span className="text-[11px] text-gray-600">{vacio}</span> : null;
  return (
    <div className="flex flex-wrap gap-1">
      {motivos.map((m, i) => (
        <span key={i} className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', MOTIVO_CLS[m.tipo])}>{m.texto}</span>
      ))}
    </div>
  );
}

interface FilaHistorial {
  id: string; tipo: string; precio_anterior: string | null; precio_nuevo: string | null; costo_anterior: string | null; costo_nuevo: string | null;
  dolar_blue: string | null; criterio: string | null; origen: string; detalle: string | null; usuario: string | null; created_at: string;
}
const TIPO_HIST: Record<string, string> = { renovacion: 'Renovó la validez', cambio_precio: 'Cambio de precio', cambio_costo: 'Cambio de costo' };

/** Historial de precios de un producto, con el dólar del día de cada cambio. */
export function HistorialPrecios({ productoId }: { productoId: string }) {
  const [filas, setFilas] = useState<FilaHistorial[] | null>(null);
  useEffect(() => {
    api.get<FilaHistorial[]>(`/productos/${productoId}/historial-precios`).then(setFilas).catch(() => setFilas([]));
  }, [productoId]);
  if (!filas) return <div className="py-3 flex justify-center"><Loader2 size={16} className="animate-spin text-gray-400" /></div>;
  if (!filas.length) return <p className="text-xs text-gray-600 py-2">Todavía no hay cambios registrados (el historial empieza a guardarse desde ahora).</p>;
  return (
    <ul className="divide-y divide-gray-100 text-xs">
      {filas.map(h => {
        const pa = Number(h.precio_anterior), pn = Number(h.precio_nuevo);
        return (
          <li key={h.id} className="py-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="text-gray-600 tabular-nums w-28 shrink-0">{new Date(h.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <span className="font-semibold text-gray-800">{TIPO_HIST[h.tipo] ?? h.tipo}</span>
            {h.tipo !== 'renovacion' && <span className="tabular-nums">precio {fmt$(pa)} → <b>{fmt$(pn)}</b>{pa > 0 && pn !== pa ? ` (${fmtPct((pn / pa - 1) * 100)})` : ''}</span>}
            {h.costo_anterior !== h.costo_nuevo && <span className="tabular-nums text-gray-700">costo {fmt$(Number(h.costo_anterior))} → {fmt$(Number(h.costo_nuevo))}</span>}
            {h.dolar_blue && <span className="text-gray-600">dólar {fmt$(Number(h.dolar_blue))}</span>}
            <span className="text-gray-600">{[h.criterio, h.detalle, h.usuario].filter(Boolean).join(' · ')}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Casilla({ checked }: { checked: boolean }) {
  return (
    <span className={cn('w-[18px] h-[18px] rounded-md border-2 inline-flex items-center justify-center shrink-0',
      checked ? 'bg-sky-600 border-sky-600' : 'border-gray-400 bg-white')}>
      {checked && <svg viewBox="0 0 12 12" className="w-3 h-3 text-white"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
    </span>
  );
}
