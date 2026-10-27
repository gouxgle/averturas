import { useEffect, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, fechaDiaAR } from '@/lib/utils';
import { TIPOS_ABERTURA, etiqueta } from '@/lib/configuradorAbertura';
import { fmtMoneda } from './tipos';
import { inpCls, lblCls } from './ui';

type Agrupar = 'sistema' | 'tipologia' | 'tipo' | 'vidrio' | 'color' | 'proveedor';
const AGRUPAR: { v: Agrupar; l: string }[] = [
  { v: 'sistema', l: 'Sistema' }, { v: 'tipologia', l: 'Tipología' }, { v: 'tipo', l: 'Tipo de abertura' },
  { v: 'vidrio', l: 'Vidrio' }, { v: 'color', l: 'Color' }, { v: 'proveedor', l: 'Proveedor' },
];
interface Fila { grupo: string; ordenes: number; unidades: string; m2: string | null; monto_neto: string | null; precio_m2: string | null; reclamos: number }

const num = (v: string | number | null) => (v == null ? '—' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: 2 }));
const haceUnAno = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return fechaDiaAR(d); };

// Qué aberturas se compran: órdenes de compra no canceladas agrupadas por una característica de la ficha técnica.
export function TabAnalisis() {
  const [agrupar, setAgrupar] = useState<Agrupar>('sistema');
  const [desde, setDesde] = useState(haceUnAno);
  const [hasta, setHasta] = useState(() => fechaDiaAR(new Date()));
  const [res, setRes] = useState<{ clave: string; filas: Fila[] } | null>(null);
  const [error, setError] = useState(false);
  const clave = `${agrupar}|${desde}|${hasta}`;

  useEffect(() => {
    let vivo = true;
    api.get<Fila[]>(`/compras/analisis/aberturas?${new URLSearchParams({ agrupar, desde, hasta })}`)
      .then(filas => { if (vivo) { setRes({ clave: `${agrupar}|${desde}|${hasta}`, filas }); setError(false); } })
      .catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [agrupar, desde, hasta]);

  const filas = res?.clave === clave ? res.filas : null;
  const nombre = (g: string) => (agrupar === 'tipo' && g !== 'Sin dato' ? etiqueta(TIPOS_ABERTURA, g) : g);
  const total = filas?.reduce((a, f) => a + Number(f.monto_neto ?? 0), 0) ?? 0;

  return (
    <div className="space-y-3" data-testid="tab-analisis">
      <div className="rounded-2xl border border-gray-300 bg-white p-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {AGRUPAR.map(a => (
            <button key={a.v} type="button" onClick={() => setAgrupar(a.v)} aria-pressed={agrupar === a.v}
              className={cn('h-9 px-3 rounded-lg border text-xs font-semibold',
                agrupar === a.v ? 'bg-lime-600 border-lime-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-lime-500')}>
              {a.l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 max-w-sm">
          <div><label className={lblCls}>Desde</label><input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inpCls} /></div>
          <div><label className={lblCls}>Hasta</label><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inpCls} /></div>
        </div>
        <p className="text-[11px] text-gray-600">Órdenes de compra no canceladas, por fecha de pedido. El m² y el precio por m² salen de las medidas de la ficha técnica.</p>
      </div>

      {error && !filas && <p className="text-sm text-red-700">No se pudo cargar el análisis.</p>}
      {!filas && !error && <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>}
      {filas && filas.length === 0 && (
        <div className="rounded-2xl border border-gray-300 bg-white py-10 text-center">
          <BarChart3 className="mx-auto text-gray-400" />
          <p className="text-sm text-gray-600 mt-2">No hay compras de aberturas en ese período.</p>
        </div>
      )}
      {filas && filas.length > 0 && (
        <div className="rounded-2xl border border-gray-300 bg-white overflow-hidden">
          {/* Desktop: tabla; mobile: tarjetas (mismo componente) */}
          <table className="hidden sm:table w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">{AGRUPAR.find(a => a.v === agrupar)?.l}</th>
                <th className="text-right px-3 py-2">Órdenes</th><th className="text-right px-3 py-2">Unidades</th>
                <th className="text-right px-3 py-2">m²</th><th className="text-right px-3 py-2">Monto neto</th>
                <th className="text-right px-3 py-2">$ / m²</th><th className="text-right px-3 py-2">Reclamos</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => (
                <tr key={f.grupo} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold text-gray-900">
                    {nombre(f.grupo)}
                    <div className="h-1 mt-1 rounded bg-lime-500" style={{ width: `${total ? Math.max(2, Number(f.monto_neto ?? 0) / total * 100) : 0}%` }} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.ordenes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(f.unidades)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(f.m2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{f.monto_neto ? fmtMoneda(f.monto_neto) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.precio_m2 ? fmtMoneda(f.precio_m2) : '—'}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', f.reclamos > 0 && 'text-red-700 font-semibold')}>{f.reclamos}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sm:hidden divide-y divide-gray-100">
            {filas.map(f => (
              <div key={f.grupo} className="p-3">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold text-gray-900 text-sm">{nombre(f.grupo)}</p>
                  <p className="font-semibold text-sm tabular-nums">{f.monto_neto ? fmtMoneda(f.monto_neto) : '—'}</p>
                </div>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  {f.ordenes} OC · {num(f.unidades)} u · {num(f.m2)} m² · {f.precio_m2 ? `${fmtMoneda(f.precio_m2)}/m²` : 'sin $/m²'}
                  {f.reclamos > 0 && <span className="text-red-700 font-semibold"> · {f.reclamos} reclamo{f.reclamos === 1 ? '' : 's'}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
