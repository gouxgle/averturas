import { useEffect, useState } from 'react';
import { PackageCheck, Search, X, RefreshCw, Check, AlertTriangle, XCircle, Truck, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AbrirDetalle } from './Compras';
import { ESTADO_LOGISTICA, fmtCantidad, fmtFecha, fmtMoneda, nombreCliente, type Recepcion, type OrdenRow, type ProveedorMin, type ClienteMin, type EstadoLogistica } from './tipos';
import { Badge, Paginacion, AdjuntosGrid } from './ui';

interface RecepcionRow extends Recepcion {
  orden: { id: string; numero: string; estado_logistica: EstadoLogistica };
  proveedor: ProveedorMin;
  operacion: { id: string; numero: string; cliente: ClienteMin } | null;
}

const PER_PAGE = 10;

export function TabRecepciones({ abrir, refresh }: { abrir: AbrirDetalle; refresh: number; ordenes?: OrdenRow[] }) {
  const [filas, setFilas] = useState<RecepcionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [soloParciales, setSoloParciales] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let vivo = true;
    api.get<RecepcionRow[]>(`/compras/recepciones${soloParciales ? '?parciales=true' : ''}`)
      .then(d => { if (vivo) setFilas(d); })
      .catch(() => toast.error('Error al cargar recepciones'))
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [soloParciales, refresh]);

  const q = search.trim().toLowerCase();
  const visibles = filas.filter(r => !q || [r.orden.numero, r.proveedor.nombre, r.remito_proveedor_nro,
    r.operacion?.numero, nombreCliente(r.operacion?.cliente)].some(v => v?.toLowerCase().includes(q)));
  const pagina = visibles.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="bg-white rounded-2xl border border-gray-400 shadow-lg">
      <div className="flex flex-col sm:flex-row gap-3 p-3 border-b border-gray-200">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => { setSoloParciales(false); setPage(1); setLoading(true); }}
            className={cn('text-xs font-semibold px-3 h-9 rounded-lg transition-colors', !soloParciales ? 'bg-lime-600 text-white' : 'text-gray-600 hover:bg-gray-100')}>
            Todas
          </button>
          <button onClick={() => { setSoloParciales(true); setPage(1); setLoading(true); }}
            className={cn('text-xs font-semibold px-3 h-9 rounded-lg transition-colors', soloParciales ? 'bg-lime-600 text-white' : 'text-gray-600 hover:bg-gray-100')}>
            De órdenes incompletas
          </button>
        </div>
        <div className="relative flex-1 min-w-0 sm:max-w-xs sm:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar orden, remito, proveedor…"
            className="w-full pl-8 pr-8 h-9 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-300" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={12} className="text-gray-500" /></button>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><RefreshCw className="animate-spin text-lime-600" /></div>
      ) : pagina.length === 0 ? (
        <div className="py-12 text-center text-gray-600 text-sm">
          <PackageCheck size={32} className="mx-auto mb-2 opacity-30" />
          Todavía no se registró ninguna entrega
          <p className="text-xs text-gray-500 mt-1">La recepción se registra desde la orden de compra, ítem por ítem.</p>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {pagina.map(r => {
            const est = ESTADO_LOGISTICA[r.orden.estado_logistica];
            const conProblema = r.items.filter(i => Number(i.cantidad_problema) > 0);
            const noVino = r.items.filter(i => i.no_recibido);
            return (
              <div key={r.id} className="rounded-xl border border-gray-200 shadow-sm">
                <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 border-b border-gray-100">
                  <div className="sm:shrink-0 sm:w-[120px]">
                    <p className="text-[11px] font-mono text-gray-700">{r.orden.numero}</p>
                    <p className="text-[10px] text-gray-500">{fmtFecha(r.fecha)} · entrega {r.numero_secuencia}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 truncate">{r.proveedor.nombre}</span>
                      {r.operacion && <span className="text-[10px] text-gray-600 truncate">{r.operacion.numero.replace(/^OP-/, 'PRO-')} · {nombreCliente(r.operacion.cliente)}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge label={est.label} cls={est.cls} />
                      {r.remito_proveedor_nro && <span className="text-[10px] text-gray-600 inline-flex items-center gap-1"><FileText size={9} /> Remito {r.remito_proveedor_nro}</span>}
                      {r.transportista_nombre && <span className="text-[10px] text-gray-600 inline-flex items-center gap-1"><Truck size={9} /> {r.transportista_nombre}</span>}
                      {r.costo_envio_real != null && <span className="text-[10px] text-amber-700">flete {fmtMoneda(r.costo_envio_real)}</span>}
                      {r.usuario_nombre && <span className="text-[10px] text-gray-500">· {r.usuario_nombre}</span>}
                    </div>
                  </div>
                  <div className="sm:shrink-0 flex items-center gap-2">
                    {conProblema.length > 0 && (
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                        <AlertTriangle size={9} /> {conProblema.length} con problema
                      </span>
                    )}
                    <button onClick={() => abrir('oc', r.orden.id)} className="text-[11px] font-semibold text-emerald-700 hover:underline whitespace-nowrap">Ver orden</button>
                  </div>
                </div>
                <div className="px-3 py-2 space-y-1">
                  {r.items.map(i => {
                    const prob = Number(i.cantidad_problema), conf = Number(i.cantidad_conforme);
                    return (
                      <div key={i.id} className="flex items-center gap-2 text-xs">
                        {i.no_recibido ? <XCircle size={12} className="text-gray-500 shrink-0" />
                          : prob > 0 ? <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                          : <Check size={12} className="text-emerald-600 shrink-0" />}
                        <span className="flex-1 min-w-0 truncate text-gray-800">{i.descripcion}</span>
                        <span className="text-gray-600 shrink-0 tabular-nums">
                          {i.no_recibido ? 'no vino'
                            : prob > 0
                              ? <>{fmtCantidad(conf, i.unidad)} ok · <span className="text-amber-700">{fmtCantidad(prob, i.unidad)} con problema</span></>
                              : <>{fmtCantidad(conf, i.unidad)} de {fmtCantidad(i.cantidad_pedida, i.unidad)}</>}
                        </span>
                        {i.incidencia && (
                          <button onClick={() => abrir('rec', i.incidencia!.id)} className="text-[10px] font-mono text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 hover:bg-red-100 shrink-0">
                            {i.incidencia.numero}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {noVino.length > 0 && r.orden.estado_logistica === 'recibida_parcial' && (
                    <p className="text-[11px] text-amber-700 pt-1">Faltan ítems por recibir en esta orden.</p>
                  )}
                  {r.notas && <p className="text-[11px] text-gray-600 italic pt-1">{r.notas}</p>}
                  {r.adjuntos?.length > 0 && <div className="pt-1"><AdjuntosGrid urls={r.adjuntos} size="sm" /></div>}
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
