import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Phone, ArrowRight, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Cliente } from '@/types';

export function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadClientes = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('clientes')
      .select('*, categoria:categorias_cliente(nombre, color)')
      .eq('activo', true)
      .order('ultima_interaccion', { ascending: false, nullsFirst: false });

    if (search.trim()) {
      q = q.or(`nombre.ilike.%${search}%,apellido.ilike.%${search}%,telefono.ilike.%${search}%`);
    }

    const { data } = await q.limit(50);
    setClientes((data ?? []) as unknown as Cliente[]);
    setLoading(false);
  }, [search]);

  useEffect(() => { loadClientes(); }, [loadClientes]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión y seguimiento CRM</p>
        </div>
        <Link
          to="/clientes/nuevo"
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={16} /> Nuevo cliente
        </Link>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse flex gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : clientes.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-1">No hay clientes todavía</p>
            <Link to="/clientes/nuevo" className="text-sm text-brand-600 hover:underline">
              Agregar el primero
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {clientes.map(cliente => (
              <button
                key={cliente.id}
                onClick={() => navigate(`/clientes/${cliente.id}`)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left group"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-brand-700">
                    {cliente.nombre[0].toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {cliente.nombre} {cliente.apellido ?? ''}
                      {cliente.razon_social ? ` — ${cliente.razon_social}` : ''}
                    </p>
                    {(cliente.categoria as any) && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{
                          backgroundColor: (cliente.categoria as any).color + '20',
                          color: (cliente.categoria as any).color,
                        }}
                      >
                        {(cliente.categoria as any).nombre}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {cliente.telefono && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Phone size={11} /> {cliente.telefono}
                      </span>
                    )}
                    {cliente.ultima_interaccion && (
                      <span className="text-xs text-gray-400">
                        Último contacto: {formatDate(cliente.ultima_interaccion)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-xs text-gray-500 justify-end">
                    <TrendingUp size={11} />
                    <span>{cliente.operaciones_count ?? 0} operaciones</span>
                  </div>
                  {(cliente.valor_total_historico ?? 0) > 0 && (
                    <p className="text-sm font-semibold text-gray-700 mt-0.5">
                      {formatCurrency(cliente.valor_total_historico)}
                    </p>
                  )}
                </div>

                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
