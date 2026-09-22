import { useEffect, useState } from 'react';
import { Scale, Search, X, ChevronRight, RefreshCw, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AbrirDetalle } from './Compras';
import { ESTADO_PC, ESTADO_PC_PROV, fmtFecha, fmtMoneda, nombreCliente, type CotizacionRow } from './tipos';
import { Badge, Paginacion } from './ui';

type Filtro = 'abierta' | 'adjudicada' | 'no_concretada' | 'todas';
const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'abierta',       label: 'Abiertas' },
  { value: 'adjudicada',    label: 'Adjudicadas' },
  { value: 'no_concretada', label: 'No concretadas' },
  { value: 'todas',         label: 'Todas' },
];
const PER_PAGE = 12;

export function TabCotizaciones({ abrir, refresh }: { abrir: AbrirDetalle; refresh: number }) {
  const [filas, setFilas] = useState<CotizacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('abierta');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let vivo = true;
    api.get<CotizacionRow[]>(`/compras/cotizaciones?estado=${filtro}`)
      .then(d => { if (vivo) setFilas(d); })
      .catch(() => toast.error('Error al cargar cotizaciones'))
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [filtro, refresh]);

  const q = search.trim().toLowerCase();
  const visibles = filas.filter(pc => !q || [pc.numero, pc.solicitud.numero, pc.solicitud.obra, nombreCliente(pc.solicitud.cliente),
    ...(pc.proveedores_resumen ?? []).map(p => p.nombre)].some(v => v?.toLowerCase().includes(q)));
  const pagina = visibles.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-400 shadow-lg">
      <div className="flex flex-col sm:flex-row gap-3 p-3 border-b border-gray-200">
        <div className="flex gap-1 flex-wrap">
          {FILTROS.map(f => (
            <button key={f.value} onClick={() => { setFiltro(f.value); setPage(1); setLoading(true); }}
              className={cn('text-xs font-semibold px-3 h-9 rounded-lg transition-colors', filtro === f.value ? 'bg-lime-600 text-white' : 'text-gray-600 hover:bg-gray-100')}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0 sm:max-w-xs sm:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar PC, proveedor, cliente…"
            className="w-full pl-8 pr-8 h-9 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-300" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={12} className="text-gray-500" /></button>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><RefreshCw className="animate-spin text-lime-600" /></div>
      ) : pagina.length === 0 ? (
        <div className="py-12 text-center text-gray-600 text-sm">
          <Scale size={32} className="mx-auto mb-2 opacity-30" />
          No hay cotizaciones en este filtro
          <p className="text-xs text-gray-500 mt-1">Las cotizaciones se piden desde una solicitud abierta.</p>
        </div>
      ) : (
        <div className="p-3 space-y-1.5">
          {pagina.map(pc => {
            const est = ESTADO_PC[pc.estado];
            const vencida = pc.estado === 'abierta' && pc.fecha_limite && new Date(pc.fecha_limite.slice(0, 10) + 'T12:00:00') < hoy;
            const lBorder = { abierta: 'border-l-sky-400', adjudicada: 'border-l-emerald-500', no_concretada: 'border-l-gray-400', cancelada: 'border-l-gray-300' }[pc.estado];
            return (
              <div key={pc.id} onClick={() => abrir('pc', pc.id)}
                className={cn('rounded-xl border border-gray-200 border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all', lBorder)}>
                <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  <div className="sm:shrink-0 sm:w-[110px] flex items-baseline gap-2 sm:block">
                    <p className="text-[11px] font-mono text-gray-700">{pc.numero}</p>
                    <p className="text-[10px] text-gray-500 sm:mt-0.5">{fmtFecha(pc.created_at)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 truncate">{pc.solicitud.cliente ? nombreCliente(pc.solicitud.cliente) : 'Stock propio'}</span>
                      {pc.solicitud.obra && <span className="text-[11px] text-gray-600 truncate">· {pc.solicitud.obra}</span>}
                      <button onClick={e => { e.stopPropagation(); abrir('sc', pc.solicitud.id); }}
                        className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100">{pc.solicitud.numero}</button>
                      {pc.orden_compra && (
                        <button onClick={e => { e.stopPropagation(); abrir('oc', pc.orden_compra!.id); }}
                          className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100">{pc.orden_compra.numero}</button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge label={est.label} cls={est.cls} />
                      <span className="text-[10px] text-gray-600">{pc.items_count} ítem{pc.items_count === 1 ? '' : 's'} · {pc.respondidas_count}/{pc.proveedores_count} respondieron</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {(pc.proveedores_resumen ?? []).map(p => {
                        const pe = ESTADO_PC_PROV[p.estado];
                        return (
                          <span key={p.id} className={cn('inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5', pe.cls)}>
                            <span className="font-semibold truncate max-w-[120px]">{p.nombre}</span>
                            {['respondida', 'seleccionada'].includes(p.estado) ? <span className="tabular-nums">{fmtMoneda(p.total)}</span> : <span className="opacity-80">{pe.label}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="sm:shrink-0 text-left sm:text-right sm:min-w-[110px]">
                    {pc.fecha_limite && (
                      <p className={cn('text-[11px] flex items-center sm:justify-end gap-1', vencida ? 'text-red-600 font-semibold' : 'text-gray-700')}>
                        <Calendar size={10} /> {vencida ? 'Venció ' : 'Límite '}{fmtFecha(pc.fecha_limite)}
                      </p>
                    )}
                  </div>
                  <div className="sm:shrink-0 hidden sm:flex items-center">
                    <span className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center"><ChevronRight size={13} className="text-gray-600" /></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Paginacion page={page} total={visibles.length} perPage={PER_PAGE} onPage={setPage} />
    </div>
  );
}
