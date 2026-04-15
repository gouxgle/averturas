import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, ArrowRight, Send, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Operacion, EstadoOperacion } from '@/types';

const FILTROS: { value: 'activos' | EstadoOperacion; label: string }[] = [
  { value: 'activos',     label: 'Activos' },
  { value: 'presupuesto', label: 'Borrador' },
  { value: 'enviado',     label: 'Enviados' },
  { value: 'aprobado',    label: 'Aprobados' },
];

const ESTADO_COLOR: Record<string, string> = {
  presupuesto: 'bg-gray-100 text-gray-700',
  enviado:     'bg-blue-100 text-blue-700',
  aprobado:    'bg-green-100 text-green-700',
};

const ESTADO_LABEL: Record<string, string> = {
  presupuesto: 'Borrador',
  enviado:     'Enviado',
  aprobado:    'Aprobado',
};

const TIPO_LABEL: Record<string, string> = {
  estandar:           'Estándar',
  a_medida_proveedor: 'A medida',
  fabricacion_propia: 'Fabricación',
};

function diasHastaVencimiento(fecha: string | null): number | null {
  if (!fecha) return null;
  const diff = new Date(fecha).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function Presupuestos() {
  const navigate = useNavigate();
  const [presupuestos, setPresupuestos] = useState<Operacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'activos' | EstadoOperacion>('activos');
  const [search, setSearch] = useState('');
  const [cambiando, setCambiando] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtro === 'activos') {
      params.set('estados', 'presupuesto,enviado,aprobado');
    } else {
      params.set('estado', filtro);
    }
    if (search.trim()) params.set('search', search);
    const data = await api.get<Operacion[]>(`/operaciones?${params}`);
    setPresupuestos(data);
    setLoading(false);
  }, [filtro, search]);

  useEffect(() => { load(); }, [load]);

  async function cambiarEstado(op: Operacion, nuevoEstado: EstadoOperacion) {
    setCambiando(op.id);
    await api.patch(`/operaciones/${op.id}/estado`, { estado: nuevoEstado });
    setPresupuestos(prev => prev.map(p => p.id === op.id ? { ...p, estado: nuevoEstado } : p));
    setCambiando(null);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <FileText size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Presupuestos</h1>
            <p className="text-sm text-gray-500">Gestión de cotizaciones</p>
          </div>
        </div>
        <Link
          to="/presupuestos/nuevo"
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all"
        >
          <Plus size={16} /> Nuevo presupuesto
        </Link>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTROS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFiltro(value)}
            className={cn(
              'whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
              filtro === value
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'
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
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
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
        ) : presupuestos.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-1">No hay presupuestos</p>
            <Link to="/presupuestos/nuevo" className="text-sm text-brand-600 hover:underline">
              Crear el primero
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {presupuestos.map(op => {
              const dias = diasHastaVencimiento(op.fecha_validez);
              const vencido = dias !== null && dias < 0;
              const porVencer = dias !== null && dias >= 0 && dias <= 3;
              const cliente = op.cliente as any;

              return (
                <div key={op.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                  <div className="w-32 shrink-0">
                    <button
                      onClick={() => navigate(`/operaciones/${op.id}`)}
                      className="text-sm font-bold text-gray-800 hover:text-brand-600 transition-colors text-left"
                    >
                      {op.numero}
                    </button>
                    <p className="text-xs text-gray-400 mt-0.5">{TIPO_LABEL[op.tipo]}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {cliente?.nombre} {cliente?.apellido ?? ''}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span>{formatDate(op.created_at)}</span>
                      {op.fecha_validez && (
                        <span className={cn(
                          'flex items-center gap-1',
                          vencido ? 'text-red-500' : porVencer ? 'text-amber-500' : 'text-gray-400'
                        )}>
                          {vencido ? <AlertTriangle size={10} /> : <Clock size={10} />}
                          {vencido
                            ? `Vencido hace ${Math.abs(dias!)} días`
                            : dias === 0
                              ? 'Vence hoy'
                              : `Vence en ${dias} días`
                          }
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium shrink-0', ESTADO_COLOR[op.estado] ?? 'bg-gray-100 text-gray-700')}>
                    {ESTADO_LABEL[op.estado] ?? op.estado}
                  </span>

                  <div className="text-right w-28 shrink-0">
                    <p className="text-sm font-bold text-gray-800">{formatCurrency(op.precio_total)}</p>
                    {op.margen > 0 && <p className="text-xs text-gray-400">{op.margen}% margen</p>}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {op.estado === 'presupuesto' && (
                      <button
                        onClick={() => cambiarEstado(op, 'enviado')}
                        disabled={cambiando === op.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        <Send size={12} /> Enviar
                      </button>
                    )}
                    {op.estado === 'enviado' && (
                      <button
                        onClick={() => cambiarEstado(op, 'aprobado')}
                        disabled={cambiando === op.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={12} /> Aprobar
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/operaciones/${op.id}`)}
                      className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
