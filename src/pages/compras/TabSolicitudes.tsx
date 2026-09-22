import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Search, X, ChevronRight, RefreshCw, Calendar, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AbrirDetalle } from './Compras';
import { ESTADO_SC, ORIGEN_LABEL, fmtFecha, fmtCantidad, nombreCliente, type SolicitudRow, type EstadoSolicitud } from './tipos';
import { Badge, Paginacion } from './ui';

type Filtro = 'activas' | 'abierta' | 'en_cotizacion' | 'con_oc' | 'cerrada' | 'cancelada' | 'todas';
const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'activas',       label: 'Activas' },
  { value: 'abierta',       label: 'Abiertas' },
  { value: 'en_cotizacion', label: 'En cotización' },
  { value: 'con_oc',        label: 'Con orden' },
  { value: 'cerrada',       label: 'Cerradas' },
  { value: 'cancelada',     label: 'Canceladas' },
  { value: 'todas',         label: 'Todas' },
];
const PER_PAGE = 12;

export function TabSolicitudes({ abrir, refresh }: { abrir: AbrirDetalle; refresh: number }) {
  const navigate = useNavigate();
  const [filas, setFilas] = useState<SolicitudRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let vivo = true;
    api.get<SolicitudRow[]>(`/compras/solicitudes?estado=${filtro}`)
      .then(d => { if (vivo) setFilas(d); })
      .catch(() => toast.error('Error al cargar solicitudes'))
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [filtro, refresh]);

  const q = search.trim().toLowerCase();
  const visibles = filas.filter(s => !q || [s.numero, s.obra, nombreCliente(s.cliente), s.operacion?.numero, ORIGEN_LABEL[s.origen]]
    .some(v => v?.toLowerCase().includes(q)));
  const pagina = visibles.slice((page - 1) * PER_PAGE, page * PER_PAGE);

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
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar SC, cliente, obra…"
            className="w-full pl-8 pr-8 h-9 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-300" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={12} className="text-gray-500" /></button>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><RefreshCw className="animate-spin text-lime-600" /></div>
      ) : pagina.length === 0 ? (
        <div className="py-12 text-center text-gray-600 text-sm">
          <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
          No hay solicitudes en este filtro
          <div className="mt-3">
            <button onClick={() => navigate('/compras/nueva-solicitud')} className="inline-flex items-center gap-1.5 text-lime-700 font-semibold hover:underline">
              <Plus size={14} /> Crear una solicitud
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 space-y-1.5">
          {pagina.map(s => {
            const est = ESTADO_SC[s.estado as EstadoSolicitud];
            const primer = s.items_resumen?.[0];
            const mas = (s.items_resumen?.length ?? 0) - 1;
            const lBorder = { abierta: 'border-l-amber-400', en_cotizacion: 'border-l-sky-400', con_oc: 'border-l-emerald-500', cerrada: 'border-l-gray-400', cancelada: 'border-l-gray-300' }[s.estado];
            return (
              <div key={s.id} onClick={() => abrir('sc', s.id)}
                className={cn('rounded-xl border border-gray-200 border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all', lBorder)}>
                <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  <div className="sm:shrink-0 sm:w-[110px] flex items-baseline gap-2 sm:block">
                    <p className="text-[11px] font-mono text-gray-700">{s.numero}</p>
                    <p className="text-[10px] text-gray-500 sm:mt-0.5">{fmtFecha(s.created_at)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {s.cliente ? nombreCliente(s.cliente) : (s.origen === 'reposicion_stock' || s.origen === 'faltante' ? 'Stock propio' : ORIGEN_LABEL[s.origen])}
                      </span>
                      {s.obra && <span className="text-[11px] text-gray-600 truncate">· {s.obra}</span>}
                      {s.operacion && <span className="text-[10px] font-mono text-blue-600 shrink-0">{s.operacion.numero.replace(/^OP-/, 'PRO-')}</span>}
                      {s.visita_tecnica && <span className="text-[10px] font-mono text-blue-600 shrink-0">{s.visita_tecnica.numero}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge label={est.label} cls={est.cls} />
                      <span className="text-[10px] text-gray-500">{ORIGEN_LABEL[s.origen]}</span>
                      <span className="text-[10px] text-gray-600">
                        · {s.items_count} ítem{s.items_count === 1 ? '' : 's'}{s.items_pendientes > 0 && s.items_pendientes < s.items_count ? ` (${s.items_pendientes} pend.)` : ''}
                      </span>
                      {primer && <span className="text-[10px] text-gray-600 truncate">· {primer.descripcion} ×{fmtCantidad(primer.cantidad)}{mas > 0 ? ` +${mas}` : ''}</span>}
                    </div>
                    {(s.cotizaciones.length > 0 || s.ordenes.length > 0) && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                        {s.cotizaciones.map(pc => (
                          <button key={pc.id} onClick={() => abrir('pc', pc.id)} className="text-[10px] font-mono text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5 hover:bg-sky-100">{pc.numero}</button>
                        ))}
                        {s.ordenes.map(oc => (
                          <button key={oc.id} onClick={() => abrir('oc', oc.id)} className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100">{oc.numero}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="sm:shrink-0 text-left sm:text-right sm:min-w-[110px]">
                    {s.fecha_necesaria && (
                      <p className="text-[11px] text-gray-700 flex items-center sm:justify-end gap-1"><Calendar size={10} /> {fmtFecha(s.fecha_necesaria)}</p>
                    )}
                    {s.proveedor_sugerido && <p className="text-[10px] text-gray-500 truncate">Sug.: {s.proveedor_sugerido.nombre}</p>}
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
