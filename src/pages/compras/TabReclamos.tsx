import { useEffect, useState } from 'react';
import { AlertTriangle, Search, X, ChevronRight, RefreshCw, PackageCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AbrirDetalle } from './Compras';
import {
  ESTADO_INCIDENCIA, TIPO_INCIDENCIA_LABEL, SOLUCION_LABEL, fmtCantidad, fmtFecha, nombreCliente, haceCuanto,
  type Incidencia,
} from './tipos';
import { Badge, Paginacion } from './ui';

type Filtro = 'abiertas' | 'abierta' | 'reclamada' | 'en_reposicion' | 'cerradas' | 'todas';
const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'abiertas',      label: 'Pendientes' },
  { value: 'abierta',       label: 'Sin reclamar' },
  { value: 'reclamada',     label: 'Reclamados' },
  { value: 'en_reposicion', label: 'En reposición' },
  { value: 'cerradas',      label: 'Cerrados' },
  { value: 'todas',         label: 'Todos' },
];
const PER_PAGE = 12;

export function TabReclamos({ abrir, refresh }: { abrir: AbrirDetalle; refresh: number }) {
  const [filas, setFilas] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('abiertas');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let vivo = true;
    api.get<Incidencia[]>(`/compras/incidencias?estado=${filtro}`)
      .then(d => { if (vivo) setFilas(d); })
      .catch(() => toast.error('Error al cargar reclamos'))
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [filtro, refresh]);

  const q = search.trim().toLowerCase();
  const visibles = filas.filter(i => !q || [i.numero, i.orden.numero, i.proveedor.nombre, i.item_descripcion,
    TIPO_INCIDENCIA_LABEL[i.tipo], nombreCliente(i.operacion?.cliente)].some(v => v?.toLowerCase().includes(q)));
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
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar reclamo, orden, proveedor…"
            className="w-full pl-8 pr-8 h-9 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-300" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={12} className="text-gray-500" /></button>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><RefreshCw className="animate-spin text-lime-600" /></div>
      ) : pagina.length === 0 ? (
        <div className="py-12 text-center text-gray-600 text-sm">
          <PackageCheck size={32} className="mx-auto mb-2 opacity-30 text-emerald-600" />
          {filtro === 'abiertas' ? 'No hay reclamos pendientes' : 'No hay reclamos en este filtro'}
          <p className="text-xs text-gray-500 mt-1">Los reclamos se abren solos al marcar un ítem con problema en la recepción.</p>
        </div>
      ) : (
        <div className="p-3 space-y-1.5">
          {pagina.map(i => {
            const est = ESTADO_INCIDENCIA[i.estado];
            return (
              <div key={i.id} onClick={() => abrir('rec', i.id)}
                className={cn('rounded-xl border border-gray-200 border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all', est.border)}>
                <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  <div className="sm:shrink-0 sm:w-[120px] flex items-baseline gap-2 sm:block">
                    <p className="text-[11px] font-mono text-gray-700">{i.numero}</p>
                    <p className="text-[10px] text-gray-500 sm:mt-0.5">{fmtFecha(i.created_at)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 truncate">{TIPO_INCIDENCIA_LABEL[i.tipo]}</span>
                      <span className="text-[11px] text-gray-600 truncate">· {i.item_descripcion}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge label={est.label} cls={est.cls} />
                      <span className="text-[10px] text-gray-600">{fmtCantidad(i.cantidad_afectada, i.item_unidad)} afectada{Number(i.cantidad_afectada) === 1 ? '' : 's'}</span>
                      <span className="text-[10px] text-gray-500">· {i.proveedor.nombre}</span>
                      {i.operacion && <span className="text-[10px] text-gray-500 truncate max-w-[140px]">· {nombreCliente(i.operacion.cliente)}</span>}
                    </div>
                    {i.descripcion && <p className="text-[11px] text-gray-600 italic mt-1 line-clamp-1">"{i.descripcion}"</p>}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                      <button onClick={() => abrir('oc', i.orden.id)} className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100">{i.orden.numero}</button>
                      {i.adjuntos?.length > 0 && <span className="text-[10px] text-gray-500">{i.adjuntos.length} foto{i.adjuntos.length === 1 ? '' : 's'}</span>}
                    </div>
                  </div>
                  <div className="sm:shrink-0 text-left sm:text-right sm:min-w-[130px]">
                    {i.solucion && <p className="text-[11px] font-semibold text-sky-800">{SOLUCION_LABEL[i.solucion].label}</p>}
                    {i.reclamada_at && !i.respondida_at && <p className="text-[11px] text-amber-700">Reclamado {haceCuanto(i.reclamada_at)}</p>}
                    {!i.reclamada_at && <p className="text-[11px] text-red-600 font-semibold">Sin reclamar</p>}
                    {i.reposicion && i.reposicion.estado_item !== 'recibido' && <p className="text-[10px] text-indigo-700">esperando reposición</p>}
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
      {!loading && filas.some(i => !i.reclamada_at) && (
        <p className="px-4 pb-3 text-[11px] text-red-700 flex items-center gap-1.5">
          <AlertTriangle size={12} /> Hay reclamos abiertos que todavía no se le pasaron al proveedor.
        </p>
      )}
    </div>
  );
}
