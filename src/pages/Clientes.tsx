import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Users, Phone, ArrowRight, TrendingUp,
  User, Building2, Hash, Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Cliente } from '@/types';

function nombreMostrado(c: Cliente) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  const partes = [c.apellido, c.nombre].filter(Boolean);
  return partes.length ? partes.join(', ') : '—';
}

function iniciales(c: Cliente) {
  if (c.tipo_persona === 'juridica') return (c.razon_social ?? '?')[0].toUpperCase();
  return ((c.apellido ?? c.nombre ?? '?')[0]).toUpperCase();
}

export function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = search.trim() ? `?search=${encodeURIComponent(search)}` : '';
    const data = await api.get<Cliente[]>(`/clientes${params}`);
    setClientes(data);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const fisica = clientes.filter(c => c.tipo_persona === 'fisica').length;
  const juridica = clientes.filter(c => c.tipo_persona === 'juridica').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Users size={20} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
            <p className="text-sm text-gray-500">CRM y seguimiento comercial</p>
          </div>
        </div>
        <Link
          to="/clientes/nuevo"
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all"
        >
          <Plus size={16} /> Nuevo cliente
        </Link>
      </div>

      {/* Stats rápidas */}
      {!loading && clientes.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Users size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-lg font-bold text-gray-800">{clientes.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
              <User size={15} className="text-sky-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Personas</p>
              <p className="text-lg font-bold text-gray-800">{fisica}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Building2 size={15} className="text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Empresas</p>
              <p className="text-lg font-bold text-gray-800">{juridica}</p>
            </div>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, apellido, razón social, DNI/CUIT o teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white shadow-sm"
        />
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse flex gap-4">
                <div className="w-11 h-11 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : clientes.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">
              {search ? 'Sin resultados para esa búsqueda' : 'No hay clientes todavía'}
            </p>
            {!search && (
              <Link to="/clientes/nuevo" className="text-sm text-brand-600 hover:underline">
                Agregar el primero
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {clientes.map(cliente => {
              const esEmpresa = cliente.tipo_persona === 'juridica';
              const cat = cliente.categoria as any;
              return (
                <button
                  key={cliente.id}
                  onClick={() => navigate(`/clientes/${cliente.id}`)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group"
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 relative',
                    esEmpresa ? 'bg-blue-100' : 'bg-emerald-100'
                  )}>
                    {esEmpresa
                      ? <Building2 size={18} className="text-blue-600" />
                      : <User size={18} className="text-emerald-600" />
                    }
                    <span className={cn(
                      'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold',
                      esEmpresa ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'
                    )}>
                      {iniciales(cliente)}
                    </span>
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {nombreMostrado(cliente)}
                      </p>
                      {cat && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                          style={{
                            backgroundColor: cat.color + '20',
                            color: cat.color,
                          }}
                        >
                          {cat.nombre}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {cliente.documento_nro && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Hash size={10} />
                          {esEmpresa ? 'CUIT' : 'DNI'} {cliente.documento_nro}
                        </span>
                      )}
                      {cliente.telefono && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Phone size={10} /> {cliente.telefono}
                        </span>
                      )}
                      {cliente.ultima_interaccion && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar size={10} /> {formatDate(cliente.ultima_interaccion)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats derecha */}
                  <div className="text-right shrink-0 hidden sm:block">
                    <div className="flex items-center gap-1 text-xs text-gray-400 justify-end">
                      <TrendingUp size={11} />
                      <span>{cliente.operaciones_count ?? 0} op.</span>
                    </div>
                    {(cliente.valor_total_historico ?? 0) > 0 && (
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">
                        {formatCurrency(cliente.valor_total_historico)}
                      </p>
                    )}
                  </div>

                  <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
