import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, ArrowRight, Hammer } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Operacion, EstadoOperacion, TipoOperacion } from '@/types';

const ESTADOS: { value: EstadoOperacion | 'todos'; label: string }[] = [
  { value: 'todos',          label: 'Todos' },
  { value: 'presupuesto',    label: 'Presupuesto' },
  { value: 'enviado',        label: 'Enviado' },
  { value: 'aprobado',       label: 'Aprobado' },
  { value: 'en_produccion',  label: 'En producción' },
  { value: 'listo',          label: 'Listo' },
  { value: 'entregado',      label: 'Entregado' },
  { value: 'cancelado',      label: 'Cancelado' },
];

const ESTADO_COLOR: Record<string, string> = {
  presupuesto:   'bg-gray-100 text-gray-700',
  enviado:       'bg-blue-100 text-blue-700',
  aprobado:      'bg-green-100 text-green-700',
  en_produccion: 'bg-amber-100 text-amber-700',
  listo:         'bg-teal-100 text-teal-700',
  instalado:     'bg-purple-100 text-purple-700',
  entregado:     'bg-emerald-100 text-emerald-700',
  cancelado:     'bg-red-100 text-red-700',
};

const TIPO_COLOR: Record<TipoOperacion, string> = {
  estandar:           'bg-sky-50 text-sky-700 border-sky-200',
  a_medida_proveedor: 'bg-violet-50 text-violet-700 border-violet-200',
  fabricacion_propia: 'bg-orange-50 text-orange-700 border-orange-200',
};

const TIPO_LABEL: Record<TipoOperacion, string> = {
  estandar:           'Estándar',
  a_medida_proveedor: 'A medida',
  fabricacion_propia: 'Fabricación propia',
};

export function Operaciones() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const estadoFiltro = (searchParams.get('estado') ?? 'todos') as EstadoOperacion | 'todos';

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (estadoFiltro !== 'todos') params.set('estado', estadoFiltro);
    if (search.trim()) params.set('search', search);
    const data = await api.get<Operacion[]>(`/operaciones?${params}`);
    setOperaciones(data);
    setLoading(false);
  }, [estadoFiltro, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Hammer size={20} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Operaciones</h1>
            <p className="text-sm text-gray-500">Seguimiento de producción y entregas</p>
          </div>
        </div>
        <Link
          to="/operaciones/nueva"
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all"
        >
          <Plus size={16} /> Nueva operación
        </Link>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ESTADOS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSearchParams(value === 'todos' ? {} : { estado: value })}
            className={cn(
              'whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
              estadoFiltro === value
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-600'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por número..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : operaciones.length === 0 ? (
          <div className="py-16 text-center">
            <Hammer size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-1">No hay operaciones</p>
            <Link to="/operaciones/nueva" className="text-sm text-amber-600 hover:underline">
              Crear la primera
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {operaciones.map(op => (
              <Link
                key={op.id}
                to={`/operaciones/${op.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-28 shrink-0">
                  <p className="text-sm font-bold text-gray-800">{op.numero}</p>
                  <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', TIPO_COLOR[op.tipo])}>
                    {TIPO_LABEL[op.tipo]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {(op.cliente as any)?.nombre} {(op.cliente as any)?.apellido ?? ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(op.cliente as any)?.telefono ?? '—'} · {formatDate(op.created_at)}
                  </p>
                </div>
                <div className="shrink-0">
                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', ESTADO_COLOR[op.estado])}>
                    {ESTADOS.find(e => e.value === op.estado)?.label ?? op.estado}
                  </span>
                </div>
                <div className="text-right shrink-0 w-28">
                  <p className="text-sm font-bold text-gray-800">{formatCurrency(op.precio_total)}</p>
                  <p className="text-xs text-gray-400">
                    {op.margen > 0 ? `${op.margen}% margen` : '—'}
                  </p>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
