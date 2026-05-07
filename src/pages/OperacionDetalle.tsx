import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, User, ChevronRight, Package, DollarSign, Printer,
  Receipt, Truck, XCircle, RotateCcw, Plus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Operacion, OperacionItem, EstadoOperacion } from '@/types';

const ESTADOS: { value: EstadoOperacion; label: string }[] = [
  { value: 'presupuesto',   label: 'Presupuesto' },
  { value: 'enviado',       label: 'Enviado' },
  { value: 'aprobado',      label: 'Aprobado' },
  { value: 'rechazado',     label: 'Rechazado' },
  { value: 'en_produccion', label: 'En producción' },
  { value: 'listo',         label: 'Listo' },
  { value: 'entregado',     label: 'Entregado' },
  { value: 'cancelado',     label: 'Cancelado' },
];

const ESTADO_COLOR: Record<string, string> = {
  presupuesto:   'bg-gray-100 text-gray-700 border-gray-200',
  enviado:       'bg-blue-100 text-blue-700 border-blue-200',
  aprobado:      'bg-green-100 text-green-700 border-green-200',
  rechazado:     'bg-red-100 text-red-700 border-red-200',
  en_produccion: 'bg-amber-100 text-amber-700 border-amber-200',
  listo:         'bg-teal-100 text-teal-700 border-teal-200',
  instalado:     'bg-purple-100 text-purple-700 border-purple-200',
  entregado:     'bg-indigo-100 text-indigo-700 border-indigo-200',
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
  rechazado:     'presupuesto',
  en_produccion: 'listo',
  listo:         'entregado',
};

const SIGUIENTE_LABEL: Partial<Record<EstadoOperacion, string>> = {
  presupuesto:   'Marcar enviado',
  enviado:       'Aprobar',
  aprobado:      'En producción',
  rechazado:     'Revisar (borrador)',
  en_produccion: 'Listo',
  listo:         'Entregado',
};

interface EstadoHistorial {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  notas: string | null;
  created_at: string;
}

interface ReciboResumen {
  id: string;
  numero: string;
  fecha: string;
  monto_total: number;
  forma_pago: string;
  estado: string;
}

interface RemitoResumen {
  id: string;
  numero: string;
  fecha_emision: string;
  estado: string;
}

interface OperacionDetalle extends Operacion {
  items: OperacionItem[];
  historial: EstadoHistorial[];
}

const FORMA_PAGO_LABEL: Record<string, string> = {
  efectivo:        'Efectivo',
  transferencia:   'Transferencia',
  cheque:          'Cheque',
  tarjeta_debito:  'Débito',
  tarjeta_credito: 'Crédito',
  mercadopago:     'MercadoPago',
  otro:            'Otro',
};

const REMITO_ESTADO_COLOR: Record<string, string> = {
  borrador:  'bg-gray-100 text-gray-600',
  emitido:   'bg-blue-100 text-blue-700',
  entregado: 'bg-indigo-100 text-indigo-700',
  cancelado: 'bg-red-100 text-red-700',
};

export function OperacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [operacion, setOperacion] = useState<OperacionDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [recibos, setRecibos] = useState<ReciboResumen[]>([]);
  const [remitos, setRemitos] = useState<RemitoResumen[]>([]);

  async function load() {
    if (!id) return;
    const data = await api.get<OperacionDetalle>(`/operaciones/${id}`);
    setOperacion(data);
    setLoading(false);
    Promise.all([
      api.get<ReciboResumen[]>(`/recibos?operacion_id=${id}`),
      api.get<RemitoResumen[]>(`/remitos?operacion_id=${id}`),
    ]).then(([r, rm]) => {
      setRecibos(r.filter(x => x.estado !== 'anulado'));
      setRemitos(rm.filter(x => x.estado !== 'cancelado'));
    }).catch(() => {});
  }

  useEffect(() => { load(); }, [id]);

  async function cambiarEstado(nuevoEstado: EstadoOperacion) {
    if (!operacion) return;
    setCambiandoEstado(true);
    await api.patch(`/operaciones/${operacion.id}/estado`, { estado: nuevoEstado });
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

  const totalCobrado = recibos.reduce((s, r) => s + Number(r.monto_total), 0);
  const saldoPendiente = Number(operacion.precio_total) - totalCobrado;

  // Mostrar paneles recibos/remitos solo en estados del flujo comercial
  const esComercial = ['presupuesto', 'enviado', 'aprobado', 'rechazado',
    'en_produccion', 'listo', 'instalado', 'entregado'].includes(operacion.estado);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
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
          <button
            onClick={() => window.open(`/imprimir/presupuesto/${operacion.id}`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
            <Printer size={13} /> PDF
          </button>
          {operacion.estado === 'enviado' && (
            <button
              onClick={() => { if (confirm('¿Marcar como rechazado?')) cambiarEstado('rechazado'); }}
              disabled={cambiandoEstado}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50">
              <XCircle size={13} /> Rechazar
            </button>
          )}
          {operacion.estado === 'rechazado' && (
            <button
              onClick={() => cambiarEstado('presupuesto')}
              disabled={cambiandoEstado}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg disabled:opacity-50">
              <RotateCcw size={13} /> Revisar
            </button>
          )}
          {operacion.estado !== 'cancelado' && operacion.estado !== 'entregado' && operacion.estado !== 'rechazado' && (
            <button onClick={cancelar} disabled={cambiandoEstado}
              className="px-3 py-2 text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50">
              Cancelar
            </button>
          )}
          {siguiente && operacion.estado !== 'rechazado' && (
            <button onClick={() => cambiarEstado(siguiente)} disabled={cambiandoEstado}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm rounded-lg font-medium">
              {SIGUIENTE_LABEL[operacion.estado] ?? ESTADOS.find(e => e.value === siguiente)?.label}
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Columna izquierda */}
        <div className="space-y-4">
          {/* Cliente */}
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

          {/* Totales */}
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

          {/* Notas / validez */}
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

          {/* Panel recibos */}
          {esComercial && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <Receipt size={14} className="text-emerald-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex-1">Recibos</span>
                {operacion.estado === 'aprobado' && (
                  <Link
                    to={`/recibos/nuevo?operacion_id=${operacion.id}&cliente_id=${cliente?.id ?? ''}`}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                  >
                    <Plus size={11} /> Nuevo
                  </Link>
                )}
              </div>
              {recibos.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin recibos</p>
              ) : (
                <>
                  <div className="divide-y divide-gray-50">
                    {recibos.map(r => (
                      <Link key={r.id} to={`/recibos/${r.id}/editar`}
                        className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700">{r.numero}</p>
                          <p className="text-[10px] text-gray-400">{formatDate(r.fecha)} · {FORMA_PAGO_LABEL[r.forma_pago] ?? r.forma_pago}</p>
                        </div>
                        <p className="text-xs font-bold text-emerald-700 shrink-0">{formatCurrency(Number(r.monto_total))}</p>
                      </Link>
                    ))}
                  </div>
                  <div className="px-3 py-2 border-t border-gray-100 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Cobrado</span>
                      <span className="font-semibold text-emerald-700">{formatCurrency(totalCobrado)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Saldo pendiente</span>
                      <span className={cn('font-semibold', saldoPendiente > 0.01 ? 'text-amber-600' : 'text-gray-400')}>
                        {formatCurrency(Math.max(0, saldoPendiente))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Panel remitos */}
          {esComercial && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <Truck size={14} className="text-blue-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex-1">Remitos</span>
                {operacion.estado === 'aprobado' && (
                  <Link
                    to={`/remitos/nuevo?operacion_id=${operacion.id}&cliente_id=${cliente?.id ?? ''}`}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    <Plus size={11} /> Nuevo
                  </Link>
                )}
              </div>
              {remitos.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin remitos</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {remitos.map(rm => (
                    <Link key={rm.id} to={`/remitos/${rm.id}/editar`}
                      className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700">{rm.numero}</p>
                        <p className="text-[10px] text-gray-400">{formatDate(rm.fecha_emision)}</p>
                      </div>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', REMITO_ESTADO_COLOR[rm.estado] ?? 'bg-gray-100 text-gray-600')}>
                        {rm.estado}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ítems */}
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

          {/* Historial */}
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
