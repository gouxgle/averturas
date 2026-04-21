import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, ChevronRight, Package, DollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Operacion, OperacionItem, EstadoOperacion } from '@/types';

const ESTADOS: { value: EstadoOperacion; label: string }[] = [
  { value: 'presupuesto',   label: 'Presupuesto' },
  { value: 'enviado',       label: 'Enviado' },
  { value: 'aprobado',      label: 'Aprobado' },
  { value: 'en_produccion', label: 'En producción' },
  { value: 'listo',         label: 'Listo' },
  { value: 'entregado',     label: 'Entregado' },
  { value: 'cancelado',     label: 'Cancelado' },
];

const ESTADO_COLOR: Record<string, string> = {
  presupuesto:   'bg-gray-100 text-gray-700 border-gray-200',
  enviado:       'bg-blue-100 text-blue-700 border-blue-200',
  aprobado:      'bg-green-100 text-green-700 border-green-200',
  en_produccion: 'bg-amber-100 text-amber-700 border-amber-200',
  listo:         'bg-teal-100 text-teal-700 border-teal-200',
  instalado:     'bg-purple-100 text-purple-700 border-purple-200',
  entregado:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelado:     'bg-red-100 text-red-700 border-red-200',
};

const TIPO_LABEL: Record<string, string> = {
  estandar:           'Estándar',
  a_medida_proveedor: 'A medida',
  fabricacion_propia: 'Fabricación propia',
};

const SIGUIENTE_ESTADO: Partial<Record<EstadoOperacion, EstadoOperacion>> = {
  presupuesto:   'enviado',
  enviado:       'aprobado',
  aprobado:      'en_produccion',
  en_produccion: 'listo',
  listo:         'entregado',
};

interface EstadoHistorial {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  notas: string | null;
  created_at: string;
}

interface OperacionDetalle extends Operacion {
  items: OperacionItem[];
  historial: EstadoHistorial[];
}

export function OperacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [operacion, setOperacion] = useState<OperacionDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  async function load() {
    if (!id) return;
    const data = await api.get<OperacionDetalle>(`/operaciones/${id}`);
    setOperacion(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function avanzarEstado() {
    if (!operacion) return;
    const siguiente = SIGUIENTE_ESTADO[operacion.estado];
    if (!siguiente) return;
    setCambiandoEstado(true);
    await api.patch(`/operaciones/${operacion.id}/estado`, { estado: siguiente });
    await load();
    setCambiandoEstado(false);
  }

  async function cancelar() {
    if (!operacion || operacion.estado === 'cancelado') return;
    if (!confirm('¿Cancelar esta operación?')) return;
    setCambiandoEstado(true);
    await api.patch(`/operaciones/${operacion.id}/estado`, { estado: 'cancelado' });
    await load();
    setCambiandoEstado(false);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-1/3" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!operacion) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <p className="text-gray-400">Operación no encontrada</p>
        <button onClick={() => navigate('/operaciones')} className="text-amber-600 text-sm mt-2 hover:underline">Volver</button>
      </div>
    );
  }

  const cliente = operacion.cliente as any;
  const siguiente = SIGUIENTE_ESTADO[operacion.estado];
  const estadoLabel = ESTADOS.find(e => e.value === operacion.estado)?.label ?? operacion.estado;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/operaciones')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-800">{operacion.numero}</h1>
            <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium border', ESTADO_COLOR[operacion.estado])}>
              {estadoLabel}
            </span>
            <span className="text-xs text-gray-400">{TIPO_LABEL[operacion.tipo]}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Creada el {formatDate(operacion.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {operacion.estado !== 'cancelado' && operacion.estado !== 'entregado' && (
            <button onClick={cancelar} disabled={cambiandoEstado}
              className="px-3 py-2 text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50">
              Cancelar
            </button>
          )}
          {siguiente && (
            <button onClick={avanzarEstado} disabled={cambiandoEstado}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm rounded-lg font-medium">
              {ESTADOS.find(e => e.value === siguiente)?.label}
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Cliente</h3>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                <User size={15} className="text-amber-700" />
              </div>
              <div>
                {cliente ? (
                  <>
                    <Link to={`/clientes/${cliente.id}`} className="text-sm font-semibold text-gray-800 hover:text-amber-600">
                      {cliente.nombre} {cliente.apellido ?? ''}
                    </Link>
                    {cliente.telefono && <p className="text-xs text-gray-400">{cliente.telefono}</p>}
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Sin cliente</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Totales</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Costo</span>
              <span className="text-gray-700">{formatCurrency(operacion.costo_total)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-700">Precio venta</span>
              <span className="text-gray-800">{formatCurrency(operacion.precio_total)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
              <span className="text-gray-500">Margen</span>
              <span className={cn('font-semibold', operacion.margen >= 20 ? 'text-green-600' : 'text-amber-600')}>
                {operacion.margen}%
              </span>
            </div>
            {operacion.incluye_instalacion && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <DollarSign size={11} /> Incluye instalación
              </p>
            )}
          </div>

          {(operacion.notas || operacion.fecha_validez) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-2">
              {operacion.fecha_validez && (
                <div>
                  <p className="text-xs text-gray-400">Validez</p>
                  <p className="text-sm text-gray-700">{formatDate(operacion.fecha_validez)}</p>
                </div>
              )}
              {operacion.notas && (
                <div>
                  <p className="text-xs text-gray-400">Notas</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{operacion.notas}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Package size={15} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800">Ítems</h2>
            </div>
            {operacion.items.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-400">Sin ítems</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                      <th className="px-5 py-3 text-left font-medium">Descripción</th>
                      <th className="px-3 py-3 text-center font-medium">Cant.</th>
                      <th className="px-3 py-3 text-right font-medium">Precio unit.</th>
                      <th className="px-5 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {operacion.items.map(item => (
                      <tr key={item.id}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-800">{item.descripcion}</p>
                          {(item.ancho || item.alto) && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {item.ancho && `${item.ancho}cm`}{item.ancho && item.alto && ' × '}{item.alto && `${item.alto}cm`}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-center text-gray-600">{item.cantidad}</td>
                        <td className="px-3 py-3.5 text-right text-gray-600">{formatCurrency(item.precio_unitario)}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-gray-800">{formatCurrency(item.precio_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {operacion.historial.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Historial de estados</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {operacion.historial.map(h => (
                  <div key={h.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      {h.estado_anterior && (
                        <>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium border', ESTADO_COLOR[h.estado_anterior])}>
                            {ESTADOS.find(e => e.value === h.estado_anterior)?.label ?? h.estado_anterior}
                          </span>
                          <ChevronRight size={12} className="text-gray-300" />
                        </>
                      )}
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium border', ESTADO_COLOR[h.estado_nuevo])}>
                        {ESTADOS.find(e => e.value === h.estado_nuevo)?.label ?? h.estado_nuevo}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">{formatDate(h.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
