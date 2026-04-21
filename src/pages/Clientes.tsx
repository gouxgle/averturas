import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Phone, ArrowRight, TrendingUp, User, Building2, Hash, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { Cliente, EstadoCliente } from '@/types';

const ESTADO_CFG: Record<EstadoCliente, { label: string; color: string; bg: string }> = {
  prospecto:  { label: 'Prospecto',  color: 'text-gray-600',    bg: 'bg-gray-100' },
  activo:     { label: 'Activo',     color: 'text-emerald-700', bg: 'bg-emerald-100' },
  recurrente: { label: 'Recurrente', color: 'text-blue-700',    bg: 'bg-blue-100' },
  inactivo:   { label: 'Inactivo',   color: 'text-amber-700',   bg: 'bg-amber-100' },
  perdido:    { label: 'Perdido',    color: 'text-red-700',     bg: 'bg-red-100' },
};

const FILTROS: { valor: string; label: string }[] = [
  { valor: '', label: 'Todos' },
  { valor: 'prospecto',  label: 'Prospectos' },
  { valor: 'activo',     label: 'Activos' },
  { valor: 'recurrente', label: 'Recurrentes' },
  { valor: 'inactivo',   label: 'Inactivos' },
];

function nombreMostrado(c: Cliente) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function iniciales(c: Cliente) {
  const base = c.tipo_persona === 'juridica' ? c.razon_social : (c.apellido ?? c.nombre);
  return (base ?? '?')[0].toUpperCase();
}

function DiasTag({ dias }: { dias: number | null }) {
  if (dias === null) return null;
  const color = dias <= 7 ? 'text-emerald-600' : dias <= 30 ? 'text-amber-600' : 'text-red-600';
  return (
    <span className={cn('flex items-center gap-1 text-xs', color)}>
      <Clock size={10} /> {dias}d
    </span>
  );
}

export function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search);
    if (filtroEstado) params.set('estado', filtroEstado);
    const data = await api.get<Cliente[]>(`/clientes${params.toString() ? '?' + params : ''}`);
    setClientes(data);
    setLoading(false);
  }, [search, filtroEstado]);

  useEffect(() => { load(); }, [load]);

  const byEstado = (e: EstadoCliente) => clientes.filter(c => c.estado === e).length;

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Users size={18} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Clientes</h1>
            <p className="text-xs text-gray-500">CRM · seguimiento comercial</p>
          </div>
        </div>
        <Link to="/clientes/nuevo"
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all sm:w-auto w-full">
          <Plus size={15} /> Nuevo cliente
        </Link>
      </div>

      {/* Stats rápidas */}
      {!loading && clientes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {([
            { label: 'Total',      valor: clientes.length, color: 'bg-gray-50 border-gray-200', icon: <Users size={14} className="text-gray-500" /> },
            { label: 'Prospectos', valor: byEstado('prospecto'),  color: 'bg-gray-50 border-gray-200',    icon: <User size={14} className="text-gray-500" /> },
            { label: 'Activos',    valor: byEstado('activo'),     color: 'bg-emerald-50 border-emerald-200', icon: <User size={14} className="text-emerald-600" /> },
            { label: 'Recurrentes',valor: byEstado('recurrente'), color: 'bg-blue-50 border-blue-200',    icon: <TrendingUp size={14} className="text-blue-600" /> },
            { label: 'Inactivos',  valor: byEstado('inactivo'),   color: 'bg-amber-50 border-amber-200',  icon: <Clock size={14} className="text-amber-600" /> },
          ] as const).map(s => (
            <div key={s.label} className={cn('rounded-xl border px-3 py-2.5 flex items-center gap-2', s.color)}>
              {s.icon}
              <div>
                <p className="text-[10px] text-gray-500">{s.label}</p>
                <p className="text-base font-bold text-gray-800">{s.valor}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Búsqueda + filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar por nombre, DNI/CUIT, teléfono..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-sm" />
        </div>
        <div className="flex items-center flex-wrap gap-1 bg-gray-100 p-1 rounded-xl">
          {FILTROS.map(f => (
            <button key={f.valor} onClick={() => setFiltroEstado(f.valor)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filtroEstado === f.valor
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="px-5 py-3.5 animate-pulse flex gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : clientes.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users size={22} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-400 mb-1">
              {search || filtroEstado ? 'Sin resultados' : 'No hay clientes todavía'}
            </p>
            {!search && !filtroEstado && (
              <Link to="/clientes/nuevo" className="text-sm text-emerald-600 hover:underline">Agregar el primero</Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {clientes.map(cliente => {
              const esEmpresa = cliente.tipo_persona === 'juridica';
              const cat = cliente.categoria as any;
              const est = ESTADO_CFG[cliente.estado] ?? ESTADO_CFG.activo;
              return (
                <button key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left group">

                  {/* Avatar */}
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    esEmpresa ? 'bg-blue-100' : 'bg-emerald-100')}>
                    {esEmpresa
                      ? <Building2 size={17} className="text-blue-600" />
                      : <User size={17} className="text-emerald-600" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 truncate">{nombreMostrado(cliente)}</p>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', est.bg, est.color)}>
                        {est.label}
                      </span>
                      {cat && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                          style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                          {cat.nombre}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {cliente.documento_nro && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Hash size={10} />{esEmpresa ? 'CUIT' : 'DNI'} {cliente.documento_nro}
                        </span>
                      )}
                      {cliente.telefono && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Phone size={10} /> {cliente.telefono}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 shrink-0">
                    <DiasTag dias={cliente.dias_sin_contacto ?? null} />
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{cliente.operaciones_count ?? 0} op.</p>
                      {(cliente.valor_total_historico ?? 0) > 0 && (
                        <p className="text-sm font-semibold text-gray-700">{formatCurrency(cliente.valor_total_historico)}</p>
                      )}
                    </div>
                  </div>

                  <ArrowRight size={13} className="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
