import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageCheck, Search, X, ChevronRight, RefreshCw, Truck, Package, AlertTriangle, Plus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AbrirDetalle } from './Compras';
import { ESTADO_LOGISTICA, fmtFecha, fmtMoneda, fmtCantidad, nombreCliente, type OrdenRow, type TableroCompras } from './tipos';
import { Badge, Paginacion } from './ui';

type Filtro = 'activas' | 'borrador' | 'en_curso' | 'demoradas' | 'recibidas' | 'canceladas' | 'todas';
const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'activas',    label: 'Activas' },
  { value: 'borrador',   label: 'Borrador' },
  { value: 'en_curso',   label: 'En curso' },
  { value: 'demoradas',  label: 'Demoradas' },
  { value: 'recibidas',  label: 'Recibidas' },
  { value: 'canceladas', label: 'Canceladas' },
  { value: 'todas',      label: 'Todas' },
];
const PER_PAGE = 12;

function entregaBadge(oc: OrdenRow) {
  const f = oc.fecha_prometida ?? oc.fecha_entrega_est;
  if (!f) return <span className="text-[11px] text-gray-500">Sin fecha</span>;
  if (['recibida', 'cerrada', 'cancelada', 'borrador'].includes(oc.estado_logistica)) return <span className="text-sm text-gray-700">{fmtFecha(f)}</span>;
  if (oc.demorada) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
      <AlertTriangle size={9} /> Demorada {oc.dias_demora}d
    </span>
  );
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(f.slice(0, 10) + 'T12:00:00').getTime() - hoy.getTime()) / 86_400_000);
  if (diff === 0) return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Llega hoy</span>;
  if (diff === 1) return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">Mañana</span>;
  return <span className="text-sm text-gray-700">{fmtFecha(f)}</span>;
}

export function TabOrdenes({ abrir, refresh, tablero }: { abrir: AbrirDetalle; refresh: number; tablero: TableroCompras | null }) {
  const navigate = useNavigate();
  const [filas, setFilas] = useState<OrdenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let vivo = true;
    api.get<OrdenRow[]>(`/compras/ordenes?estado=${filtro}`)
      .then(d => { if (vivo) setFilas(d); })
      .catch(() => toast.error('Error al cargar órdenes'))
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [filtro, refresh]);

  const q = search.trim().toLowerCase();
  const visibles = filas.filter(oc => !q || [oc.numero, oc.proveedor.nombre, oc.operacion?.numero, nombreCliente(oc.operacion?.cliente), oc.solicitud?.numero,
    ...oc.origenes.map(o => nombreCliente(o.cliente))].some(v => v?.toLowerCase().includes(q)));
  const pagina = visibles.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="flex flex-col xl:flex-row gap-4 xl:items-start">
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-400 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-3 p-3 border-b border-gray-200">
          <div className="flex gap-1 flex-wrap">
            {FILTROS.map(f => (
              <button key={f.value} onClick={() => { setFiltro(f.value); setPage(1); setLoading(true); }}
                className={cn('text-xs font-semibold px-3 h-9 rounded-lg transition-colors', filtro === f.value ? 'bg-lime-600 text-white' : 'text-gray-600 hover:bg-gray-100',
                  f.value === 'demoradas' && filtro !== 'demoradas' && (tablero?.stats.oc_demoradas ?? 0) > 0 && 'text-red-600')}>
                {f.label}{f.value === 'demoradas' && (tablero?.stats.oc_demoradas ?? 0) > 0 ? ` (${tablero!.stats.oc_demoradas})` : ''}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-0 sm:max-w-xs sm:ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar OC, proveedor, cliente…"
              className="w-full pl-8 pr-8 h-9 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-300" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={12} className="text-gray-500" /></button>}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><RefreshCw className="animate-spin text-lime-600" /></div>
        ) : pagina.length === 0 ? (
          <div className="py-12 text-center text-gray-600 text-sm">
            <PackageCheck size={32} className="mx-auto mb-2 opacity-30" />
            No hay órdenes en este filtro
          </div>
        ) : (
          <div className="p-3 space-y-1.5">
            {pagina.map(oc => {
              const est = ESTADO_LOGISTICA[oc.estado_logistica];
              const primer = oc.items_resumen?.[0];
              const mas = (oc.items_resumen?.length ?? 0) - 1;
              const clientes = oc.es_consolidada ? [...new Set(oc.origenes.map(o => nombreCliente(o.cliente)).filter(n => n !== '—'))] : [];
              const parcial = oc.operacion && oc.items_total_op !== null && oc.items_cubiertos !== null && oc.items_cubiertos < oc.items_total_op;
              return (
                <div key={oc.id} onClick={() => abrir('oc', oc.id)}
                  className={cn('rounded-xl border border-gray-200 border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all', oc.demorada ? 'border-l-red-500' : est.border)}>
                  <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                    <div className="sm:shrink-0 sm:w-[110px] flex items-baseline gap-2 sm:block">
                      <p className="text-[11px] font-mono text-gray-700">{oc.numero}</p>
                      <p className="text-[10px] text-gray-500 sm:mt-0.5">{fmtFecha(oc.fecha_pedido)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 truncate">{oc.proveedor.nombre}</span>
                        {oc.es_stock_propio && <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-1.5 py-0.5 shrink-0">Stock propio</span>}
                        {oc.es_consolidada && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-1.5 py-0.5 shrink-0">
                            <Users size={9} /> {clientes.length} cliente{clientes.length === 1 ? '' : 's'}
                          </span>
                        )}
                        {!oc.es_stock_propio && oc.operacion && (
                          <>
                            <span className="text-[10px] font-mono text-blue-600 shrink-0">{oc.operacion.numero.replace(/^OP-/, 'PRO-')}</span>
                            <span className="text-[10px] text-gray-600 truncate max-w-[140px]">{nombreCliente(oc.operacion.cliente)}</span>
                          </>
                        )}
                        {oc.es_consolidada && clientes.length > 0 && <span className="text-[10px] text-gray-600 truncate">{clientes.join(' · ')}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge label={est.label} cls={est.cls} />
                        {parcial && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                            <AlertTriangle size={9} />Parcial · {oc.items_total_op! - oc.items_cubiertos!} pend.
                          </span>
                        )}
                        {primer && <span className="text-[10px] text-gray-600 truncate">{primer.descripcion} ×{fmtCantidad(primer.cantidad)}{mas > 0 ? ` +${mas}` : ''}</span>}
                      </div>
                      {(oc.solicitud || oc.cotizacion) && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                          {oc.solicitud && <button onClick={() => abrir('sc', oc.solicitud!.id)} className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100">{oc.solicitud.numero}</button>}
                          {oc.cotizacion && <button onClick={() => abrir('pc', oc.cotizacion!.id)} className="text-[10px] font-mono text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5 hover:bg-sky-100">{oc.cotizacion.numero}</button>}
                        </div>
                      )}
                    </div>
                    <div className="sm:shrink-0 text-left sm:text-right sm:min-w-[100px]">
                      <div>{entregaBadge(oc)}</div>
                      {Number(oc.total) > 0 && <p className="text-[12px] font-bold text-gray-800 tabular-nums mt-0.5">{fmtMoneda(oc.total)}</p>}
                      {Number(oc.costo_envio) > 0 && <p className="text-[10px] text-amber-600">flete: {fmtMoneda(oc.costo_envio)}</p>}
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

      {/* Sidebar: mismos paneles que tenía "Pedidos al proveedor" */}
      <div className="w-full xl:w-[260px] xl:shrink-0 space-y-4">
        {(tablero?.esperando_recepcion?.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl border border-sky-200 shadow-md overflow-hidden">
            <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
              <Truck size={14} className="text-sky-600" />
              <p className="text-xs font-semibold text-sky-700">Esperando recepción</p>
            </div>
            <div className="p-2 space-y-1">
              {tablero!.esperando_recepcion.map(p => (
                <button key={p.id} onClick={() => abrir('oc', p.id)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-sky-50 transition-colors min-h-11">
                  <p className="text-xs font-semibold text-gray-800">{p.numero}</p>
                  <p className="text-[11px] text-gray-600 truncate">{p.proveedor.nombre}</p>
                  {(p.fecha_prometida ?? p.fecha_entrega_est) && <p className="text-[11px] text-sky-600 mt-0.5">Est. {fmtFecha(p.fecha_prometida ?? p.fecha_entrega_est)}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {(tablero?.para_preparar?.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl border border-emerald-200 shadow-md overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
              <Package size={14} className="text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-700">Para preparar y entregar</p>
            </div>
            <div className="p-2 space-y-1">
              {tablero!.para_preparar.map(p => (
                <button key={p.id} onClick={() => abrir('oc', p.id)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 transition-colors min-h-11">
                  <p className="text-xs font-semibold text-gray-800">{p.numero}</p>
                  <p className="text-[11px] text-gray-600 truncate">{p.proveedor.nombre}</p>
                  {p.operacion && <p className="text-[11px] text-emerald-700 truncate">{nombreCliente(p.operacion.cliente)}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-400 shadow-lg p-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Accesos</p>
          <div className="space-y-1">
            <button onClick={() => navigate('/compras/nueva-solicitud')} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-lime-50 text-sm text-gray-700 hover:text-lime-700 transition-colors min-h-11">
              <Plus size={14} /> Nueva solicitud
            </button>
            <button onClick={() => navigate('/proveedores')} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors min-h-11">
              <Truck size={14} /> Ver proveedores
            </button>
            <button onClick={() => navigate('/stock')} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors min-h-11">
              <Package size={14} /> Ver existencias
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
