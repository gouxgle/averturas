import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Plus, Search, X, ChevronRight,
  Phone, MessageCircle, Package, Clock,
  CheckCircle, XCircle, AlertTriangle, Edit,
  Truck, RefreshCw, Calendar, DollarSign, Copy, Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SectionHero } from '@/components/SectionHero';
import { CompactStatsBar } from '@/components/CompactStatsBar';

// ── Tipos ──────────────────────────────────────────────────────

type EstadoPedido = 'pendiente' | 'enviado' | 'recibido' | 'cancelado';

interface ProveedorMin {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
}

interface OperacionMin {
  id: string;
  numero: string;
  cliente?: {
    id: string;
    nombre: string | null;
    apellido: string | null;
    razon_social: string | null;
    tipo_persona: 'fisica' | 'juridica';
    telefono?: string | null;
  };
}

interface PedidoRow {
  id: string;
  numero: string;
  estado: EstadoPedido;
  fecha_pedido: string;
  fecha_entrega_est: string | null;
  fecha_recepcion: string | null;
  monto_total: number;
  costo_envio: number;
  transportista_id: string | null;
  transportista_nombre: string | null;
  notas: string | null;
  operacion_id: string | null;
  proveedor: ProveedorMin;
  operacion: OperacionMin | null;
  items_resumen: { descripcion: string; cantidad: number }[] | null;
  items_total_op: number | null;
  items_cubiertos: number | null;
}

interface Transportista {
  id: string;
  nombre: string;
}

interface PedidoItem {
  id: string;
  descripcion: string;
  cantidad: number;
  costo_unitario: number;
  producto: { id: string; nombre: string; codigo?: string } | null;
}

interface PedidoDetalle extends PedidoRow {
  items: PedidoItem[];
}

interface TableroData {
  stats: {
    pendientes: number;
    enviados: number;
    recibidos_semana: number;
    valor_pendiente: number;
  };
  pedidos: PedidoRow[];
  esperando_recepcion: PedidoRow[];
  para_preparar: PedidoRow[];
}

type FiltroEstado = 'todos' | EstadoPedido;

// ── Helpers ────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function formatFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function nombreCliente(op: OperacionMin | null) {
  if (!op?.cliente) return '—';
  const c = op.cliente;
  return c.tipo_persona === 'juridica'
    ? (c.razon_social ?? '—')
    : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim() || '—';
}

function entregaBadge(fechaEst: string | null, estado: EstadoPedido) {
  if (!fechaEst || estado === 'recibido' || estado === 'cancelado') {
    return <span className="text-sm text-gray-700">{formatFecha(fechaEst)}</span>;
  }
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
  const dest = new Date(fechaEst.slice(0, 10) + 'T12:00:00');
  const diff = Math.round((dest.getTime() - hoy.getTime()) / 86_400_000);

  if (diff < 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
      Demorado {Math.abs(diff)}d
    </span>
  );
  if (diff === 0) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
      Llega hoy
    </span>
  );
  if (diff === 1) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
      Mañana
    </span>
  );
  return <span className="text-sm text-gray-700">{formatFecha(fechaEst)}</span>;
}

function estadoBadge(estado: EstadoPedido) {
  const cfg: Record<EstadoPedido, { label: string; cls: string }> = {
    pendiente: { label: 'Pendiente de envío', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
    enviado:   { label: 'Enviado al proveedor', cls: 'bg-sky-100 text-sky-700 border border-sky-200' },
    recibido:  { label: 'Recibido', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
  };
  const { label, cls } = cfg[estado] ?? cfg.cancelado;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', cls)}>
      {label}
    </span>
  );
}

function borderColor(estado: EstadoPedido) {
  return {
    pendiente: 'border-amber-400',
    enviado:   'border-sky-400',
    recibido:  'border-emerald-400',
    cancelado: 'border-gray-300',
  }[estado] ?? 'border-gray-300';
}


function waTextoPedido(pedido: PedidoDetalle | PedidoRow, items?: PedidoItem[]) {
  const allItems = items ?? (pedido as PedidoDetalle).items ?? [];
  const lineas = allItems.map(i => `- ${i.descripcion} x${i.cantidad}`).join('\n');
  const opRef = pedido.operacion ? ` para Op. ${pedido.operacion.numero}` : '';
  const cliente = pedido.operacion ? ` — cliente: ${nombreCliente(pedido.operacion)}` : '';
  const fecha = pedido.fecha_entrega_est
    ? `\nNecesito para: ${formatFecha(pedido.fecha_entrega_est)}`
    : '';
  return `Hola ${pedido.proveedor.nombre}!\nTe hago el pedido${opRef}${cliente}:\n\n${lineas}${fecha}\nGracias!`;
}

// ── Botón WA por fila (estado local) ──────────────────────────

function WARowButton({ pedidoId }: { pedidoId: string }) {
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);

  async function enviar(e: React.MouseEvent) {
    e.stopPropagation();
    setEnviando(true);
    try {
      await api.post(`/pedidos/${pedidoId}/enviar-whatsapp`, {});
      setEnviado(true);
      toast.success('Pedido enviado por WhatsApp');
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al enviar por WhatsApp');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <button onClick={enviar} disabled={enviando || enviado}
      className="p-1 rounded hover:bg-green-50 disabled:opacity-50 text-green-500"
      title={enviado ? 'Enviado' : 'Enviar por WhatsApp'}>
      <MessageCircle size={13} className={enviado ? 'text-green-600' : ''} />
    </button>
  );
}

// ── Modal de detalle ───────────────────────────────────────────

function PedidoModal({ id, onClose, onSaved }: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [modalRecepcion, setModalRecepcion] = useState(false);
  const [fechaRecepcion, setFechaRecepcion] = useState(new Date().toISOString().split('T')[0]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [transportistaId, setTransportistaId] = useState('');
  const [costoEnvioReal, setCostoEnvioReal] = useState<number | null>(null);
  const [enviandoWA, setEnviandoWA] = useState(false);
  const [enviadoWA, setEnviadoWA]   = useState(false);
  const [errorWA, setErrorWA]       = useState<string | null>(null);
  const [copiado, setCopiado]       = useState(false);
  const [avisandoCliente, setAvisandoCliente] = useState(false);
  const [avisadoCliente, setAvisadoCliente]   = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function enviarWhatsApp() {
    if (!pedido) return;
    setEnviandoWA(true);
    setErrorWA(null);
    try {
      const res = await api.post<{ enviado: boolean; pedido?: typeof pedido }>(`/pedidos/${pedido.id}/enviar-whatsapp`, {});
      setEnviadoWA(true);
      toast.success('Pedido enviado por WhatsApp');
      if (res.pedido) { setPedido(res.pedido as any); onSaved(); }
    } catch (e: any) {
      setErrorWA(e?.message ?? 'Error al enviar por WhatsApp');
    } finally {
      setEnviandoWA(false);
    }
  }

  async function copiarTextoWA() {
    if (!pedido) return;
    const texto = waTextoPedido(pedido, pedido.items);
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const el = document.createElement('textarea');
      el.value = texto;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<PedidoDetalle>(`/pedidos/${id}`);
      setPedido(d);
      setCostoEnvioReal(null);
    } catch {
      toast.error('Error al cargar el pedido');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [id, onClose]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    api.get<Transportista[]>('/transportistas').then(setTransportistas).catch(() => {});
  }, []);

  async function cambiarEstado(nuevoEstado: string, extra?: Record<string, unknown>) {
    if (!pedido) return;
    setCambiandoEstado(true);
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado: nuevoEstado, ...extra });
      toast.success(`Pedido marcado como ${nuevoEstado}`);
      onSaved();
      await cargar();
    } catch {
      toast.error('Error al cambiar estado');
    } finally {
      setCambiandoEstado(false);
      setConfirmarCancelar(false);
      setModalRecepcion(false);
    }
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8"><RefreshCw className="animate-spin text-blue-500" /></div>
    </div>
  );

  if (!pedido) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">

        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b">
          <div className="w-10 h-10 rounded-xl bg-lime-50 flex items-center justify-center">
            <ShoppingCart size={20} className="text-lime-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{pedido.numero}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {estadoBadge(pedido.estado)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pedido.estado === 'pendiente' && (
              <button
                onClick={() => navigate(`/pedidos/${id}/editar`)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                title="Editar"
              >
                <Edit size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* Proveedor */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Proveedor</p>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="font-semibold text-gray-900">{pedido.proveedor.nombre}</p>
                {pedido.proveedor.contacto && (
                  <p className="text-sm text-gray-500">{pedido.proveedor.contacto}</p>
                )}
                {pedido.proveedor.telefono && (
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <Phone size={11} />
                    {pedido.proveedor.telefono}
                  </p>
                )}
              </div>
              {pedido.proveedor.telefono && (
                <div className="flex flex-col items-end gap-1.5">
                  <button
                    onClick={enviarWhatsApp}
                    disabled={enviandoWA || enviadoWA}
                    className="flex items-center gap-1.5 bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-60 transition-colors"
                  >
                    <MessageCircle size={13} />
                    {enviadoWA ? 'Enviado ✓' : enviandoWA ? 'Enviando...' : pedido.estado === 'enviado' || pedido.estado === 'recibido' ? 'Reenviar por WhatsApp' : 'Enviar por WhatsApp'}
                  </button>
                  {errorWA && (
                    <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-lg text-right max-w-[220px]">
                      <p className="text-[11px] text-red-600 mb-1.5">{errorWA}</p>
                      <button
                        onClick={copiarTextoWA}
                        className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        {copiado ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        {copiado ? 'Copiado' : 'Copiar texto del pedido'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Operación vinculada */}
          {pedido.operacion && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Operación vinculada</p>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-900">{pedido.operacion.numero}</p>
                    <p className="text-sm text-blue-700">{nombreCliente(pedido.operacion)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fechas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl text-center">
              <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Fecha pedido</p>
              <p className="text-sm font-semibold text-gray-700">{formatFecha(pedido.fecha_pedido)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl text-center">
              <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Entrega est.</p>
              <p className="text-sm font-semibold text-gray-700">{formatFecha(pedido.fecha_entrega_est)}</p>
            </div>
            <div className={cn('p-3 rounded-xl text-center', pedido.fecha_recepcion ? 'bg-emerald-50' : 'bg-gray-50')}>
              <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Recibido</p>
              <p className="text-sm font-semibold text-gray-700">{formatFecha(pedido.fecha_recepcion)}</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Items del pedido</p>
            <div className="space-y-2">
              {pedido.items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.descripcion}</p>
                    {item.producto && (
                      <p className="text-[11px] text-gray-400">{item.producto.nombre}</p>
                    )}
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-sm font-semibold text-gray-700">x{item.cantidad}</p>
                    {item.costo_unitario > 0 && (
                      <p className="text-[11px] text-gray-400">{formatCurrency(item.costo_unitario)} c/u</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {pedido.monto_total > 0 && (
              <div className="mt-3 pt-3 border-t space-y-1">
                {pedido.costo_envio > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Al proveedor (productos)</span>
                      <span>{formatCurrency(pedido.monto_total - pedido.costo_envio)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-amber-600">
                      <span>
                        {pedido.transportista_nombre
                          ? `Al transporte · ${pedido.transportista_nombre}`
                          : 'Costo de envío'}
                      </span>
                      <span>{formatCurrency(pedido.costo_envio)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-600">Total</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(pedido.monto_total)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          {pedido.notas && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-xs font-semibold text-amber-700 mb-1">Notas</p>
              <p className="text-sm text-amber-900">{pedido.notas}</p>
            </div>
          )}

          {/* Items faltantes — completar pedido */}
          {pedido.operacion_id && pedido.estado !== 'cancelado' &&
           pedido.items_total_op !== null && pedido.items_cubiertos !== null &&
           pedido.items_cubiertos < pedido.items_total_op && (
            <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 flex items-start gap-3">
              <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-800">
                  {pedido.items_total_op - pedido.items_cubiertos} ítem{pedido.items_total_op - pedido.items_cubiertos > 1 ? 's' : ''} sin pedido en esta operación
                </p>
                <p className="text-xs text-orange-600 mt-0.5">
                  Podés completar los faltantes con otro pedido, al mismo proveedor u otro.
                </p>
                <button
                  onClick={() => navigate(`/pedidos/nuevo?operacion_id=${pedido.operacion_id}`)}
                  className="mt-2 flex items-center gap-1.5 bg-orange-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <Plus size={12} />
                  Completar pedido faltante
                </button>
              </div>
            </div>
          )}

          {/* Acciones de estado */}
          {pedido.estado === 'pendiente' && (
            <div className="flex gap-2 pt-2 border-t">
              <button
                disabled={cambiandoEstado}
                onClick={() => cambiarEstado('enviado')}
                className="flex-1 flex items-center justify-center gap-2 bg-sky-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-sky-600 disabled:opacity-50 transition-colors"
              >
                <Truck size={15} />
                Marcar como enviado
              </button>
              <button
                disabled={cambiandoEstado}
                onClick={() => setConfirmarCancelar(true)}
                className="px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {pedido.estado === 'enviado' && (
            <div className="flex gap-2 pt-2 border-t">
              <button
                disabled={cambiandoEstado}
                onClick={() => setModalRecepcion(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                <CheckCircle size={15} />
                Registrar recepción
              </button>
              <button
                disabled={cambiandoEstado}
                onClick={() => setConfirmarCancelar(true)}
                className="px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {pedido.estado === 'recibido' && pedido.operacion && (
            <div className="pt-2 border-t space-y-2">
              <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl">
                <CheckCircle size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-800">Mercadería recibida</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Avisá al cliente y generá el remito de entrega.
                  </p>
                </div>
              </div>
              <button
                disabled={avisandoCliente || avisadoCliente}
                onClick={async () => {
                  setAvisandoCliente(true);
                  try {
                    await api.post(`/pedidos/${pedido.id}/avisar-recepcion-cliente`, {});
                    setAvisadoCliente(true);
                    toast.success('Cliente avisado por WhatsApp');
                  } catch (e: any) {
                    toast.error(e?.message ?? 'Error al enviar WhatsApp');
                  } finally {
                    setAvisandoCliente(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-green-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                <MessageCircle size={15} />
                {avisadoCliente ? '✓ Cliente avisado' : avisandoCliente ? 'Enviando...' : 'Avisar al cliente por WhatsApp'}
              </button>
              <button
                onClick={() => navigate(`/remitos/nuevo?operacion_id=${pedido.operacion!.id}&cliente_id=${pedido.operacion!.cliente?.id ?? ''}`)}
                className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-600 transition-colors"
              >
                <Truck size={15} />
                Generar remito de entrega
              </button>
            </div>
          )}

          {/* Confirmar cancelar */}
          {confirmarCancelar && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle size={16} />
                <p className="text-sm font-semibold">¿Cancelar este pedido?</p>
              </div>
              <p className="text-xs text-red-600">Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => cambiarEstado('cancelado')}
                  disabled={cambiandoEstado}
                  className="flex-1 bg-red-500 text-white text-sm font-semibold py-2 rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  Sí, cancelar
                </button>
                <button
                  onClick={() => setConfirmarCancelar(false)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-lg hover:bg-gray-50"
                >
                  No, volver
                </button>
              </div>
            </div>
          )}

          {/* Modal de recepción */}
          {modalRecepcion && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
              <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                <Package size={15} />
                Registrar recepción de mercadería
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de recepción</label>
                <input
                  type="date"
                  value={fechaRecepcion}
                  onChange={e => setFechaRecepcion(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 space-y-3">
                <p className="text-xs font-semibold text-amber-700 uppercase">Datos del envío</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Transportista</label>
                  <select
                    value={transportistaId}
                    onChange={e => setTransportistaId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Sin especificar</option>
                    {transportistas.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Costo de envío real
                    {pedido.costo_envio > 0 && (
                      <span className="text-gray-400 font-normal ml-1">
                        (estimado: {formatCurrency(pedido.costo_envio)})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={costoEnvioReal ?? pedido.costo_envio}
                    onChange={e => setCostoEnvioReal(e.target.value === '' ? null : Number(e.target.value))}
                    onFocus={e => e.target.select()}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right"
                    min={0}
                    step={1}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => cambiarEstado('recibido', {
                    fecha_recepcion: fechaRecepcion,
                    ...(transportistaId ? { transportista_id: transportistaId } : {}),
                    ...(costoEnvioReal !== null ? { costo_envio_real: costoEnvioReal } : {}),
                  })}
                  disabled={cambiandoEstado}
                  className="flex-1 bg-emerald-500 text-white text-sm font-semibold py-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                >
                  Confirmar recepción
                </button>
                <button
                  onClick={() => setModalRecepcion(false)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────

const TABS: { label: string; value: FiltroEstado }[] = [
  { label: 'Todos',      value: 'todos' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Enviados',   value: 'enviado' },
  { label: 'Recibidos',  value: 'recibido' },
  { label: 'Cancelados', value: 'cancelado' },
];

export default function Pedidos() {
  const navigate = useNavigate();
  const [data, setData]       = useState<TableroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro]   = useState<FiltroEstado>('todos');
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const PER_PAGE = 10;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<TableroData>('/pedidos/tablero');
      setData(d);
    } catch {
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filas = (data?.pedidos ?? []).filter(p => {
    if (filtro !== 'todos' && p.estado !== filtro) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.numero.toLowerCase().includes(q) ||
        p.proveedor.nombre.toLowerCase().includes(q) ||
        (p.operacion?.numero.toLowerCase().includes(q) ?? false) ||
        nombreCliente(p.operacion).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filas.length / PER_PAGE);
  const paginated  = filas.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleFiltro(f: FiltroEstado) {
    setFiltro(f);
    setPage(1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-400" size={32} />
      </div>
    );
  }

  const stats = data?.stats ?? { pendientes: 0, enviados: 0, recibidos_semana: 0, valor_pendiente: 0 };

  return (
    <div className="p-4 xl:p-6 space-y-4 max-w-[1440px] mx-auto" data-section="pedidos">
      <SectionHero
        section="pedidos"
        icon={ShoppingCart}
        title="Pedidos al Proveedor"
        sub="Gestión de órdenes de compra"
        actions={
          <button onClick={() => navigate('/pedidos/nuevo')}
            className="flex items-center gap-2 bg-lime-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-lime-600 transition-colors">
            <Plus size={16} /> Nuevo pedido
          </button>
        }
      />

      <CompactStatsBar items={[
        { value: stats.pendientes,                label: 'pendientes',       color: '#a3e635' },
        { value: stats.enviados,                  label: 'enviados',         color: '#60a5fa' },
        { value: stats.recibidos_semana,          label: 'recibidos esta semana', color: '#34d399' },
        { value: formatCurrency(stats.valor_pendiente), label: 'valor pendiente', color: '#ffffff' },
      ]} />

      <div className="flex flex-col xl:flex-row gap-4 xl:items-start">

        {/* Tabla principal */}
        <div className="flex-1 min-w-0">

          {/* Filtros */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg">
            <div className="flex flex-col sm:flex-row gap-3 p-3 border-b border-gray-200">
              <div className="flex gap-1 flex-wrap">
                {TABS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => handleFiltro(t.value)}
                    className={cn(
                      'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                      filtro === t.value
                        ? 'bg-lime-500 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-0 sm:max-w-xs ml-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Buscar pedido, proveedor..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-300"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X size={12} className="text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                {/* Header */}
                <div className="grid text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-4 py-2 border-b border-gray-200"
                  style={{ gridTemplateColumns: '160px 1fr 1fr 120px 110px 90px' }}>
                  <span>Pedido</span>
                  <span>Proveedor</span>
                  <span>Operación / Cliente</span>
                  <span>Estado</span>
                  <span>Entrega est.</span>
                  <span className="text-right">Monto</span>
                </div>

                {paginated.length === 0 && (
                  <div className="py-12 text-center text-gray-400 text-sm">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                    No hay pedidos en este filtro
                  </div>
                )}

                {paginated.map(p => {
                  const primerItem = p.items_resumen?.[0];
                  const masItems   = (p.items_resumen?.length ?? 0) - 1;

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'grid items-center px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors',
                        'border-l-2', borderColor(p.estado)
                      )}
                      style={{ gridTemplateColumns: '160px 1fr 1fr 120px 110px 90px' }}
                      onClick={() => setDetailId(p.id)}
                    >
                      {/* Pedido */}
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.numero}</p>
                        <p className="text-[11px] text-gray-400">{formatFecha(p.fecha_pedido)}</p>
                      </div>

                      {/* Proveedor */}
                      <div className="pr-2 min-w-0 overflow-hidden">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.proveedor.nombre}</p>
                        {primerItem && (
                          <p className="text-[11px] text-gray-400 truncate">
                            {primerItem.descripcion} x{primerItem.cantidad}
                            {masItems > 0 && ` +${masItems} más`}
                          </p>
                        )}
                      </div>

                      {/* Operación / Cliente */}
                      <div className="pr-2 min-w-0 overflow-hidden">
                        {p.operacion ? (
                          <>
                            <p className="text-sm text-blue-700 font-medium truncate">{p.operacion.numero}</p>
                            <p className="text-xs text-gray-700 font-medium truncate">{nombreCliente(p.operacion)}</p>
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-300">—</span>
                        )}
                      </div>

                      {/* Estado */}
                      <div>
                        {p.operacion && p.items_total_op !== null && p.items_cubiertos !== null && p.items_cubiertos < p.items_total_op
                          ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200" title={`${p.items_cubiertos} de ${p.items_total_op} ítems enviados al proveedor`}>
                              <AlertTriangle size={9} />
                              Envío parcial · {p.items_total_op - p.items_cubiertos} pend.
                            </span>
                          )
                          : estadoBadge(p.estado)
                        }
                      </div>

                      {/* Fecha entrega */}
                      <div>
                        {entregaBadge(p.fecha_entrega_est, p.estado)}
                      </div>

                      {/* Monto */}
                      <div className="text-right" onClick={e => e.stopPropagation()}>
                        {p.monto_total > 0 && (
                          <p className="text-sm font-semibold text-gray-700">{formatCurrency(p.monto_total)}</p>
                        )}
                        {p.costo_envio > 0 && (
                          <p className="text-[10px] text-amber-500">
                            envío: {formatCurrency(p.costo_envio)}
                            {p.transportista_nombre && ` · ${p.transportista_nombre}`}
                          </p>
                        )}
                        <div className="flex justify-end gap-1 mt-1">
                          {p.proveedor.telefono && (
                            <WARowButton pedidoId={p.id} />
                          )}
                          <button
                            onClick={() => setDetailId(p.id)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400"
                          >
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <span className="text-xs text-gray-400">
                  Mostrando {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filas.length)} de {filas.length}
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={cn(
                        'w-7 h-7 rounded-lg text-xs font-semibold',
                        n === page ? 'bg-lime-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full xl:w-[260px] xl:shrink-0 space-y-4">

          {/* Esperando recepción */}
          {(data?.esperando_recepcion?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-sky-200 shadow-md overflow-hidden">
              <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                <Truck size={14} className="text-sky-600" />
                <p className="text-xs font-semibold text-sky-700">Esperando recepción</p>
              </div>
              <div className="p-2 space-y-1">
                {data!.esperando_recepcion.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setDetailId(p.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-sky-50 transition-colors"
                  >
                    <p className="text-xs font-semibold text-gray-800">{p.numero}</p>
                    <p className="text-[11px] text-gray-500 truncate">{p.proveedor.nombre}</p>
                    {p.fecha_entrega_est && (
                      <p className="text-[11px] text-sky-600 flex items-center gap-1 mt-0.5">
                        <Calendar size={9} />
                        Est. {formatFecha(p.fecha_entrega_est)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Para preparar */}
          {(data?.para_preparar?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-emerald-200 shadow-md overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                <Package size={14} className="text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-700">Para preparar y entregar</p>
              </div>
              <div className="p-2 space-y-1">
                {data!.para_preparar.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setDetailId(p.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    <p className="text-xs font-semibold text-gray-800">{p.numero}</p>
                    <p className="text-[11px] text-gray-500 truncate">{p.proveedor.nombre}</p>
                    {p.operacion && (
                      <p className="text-[11px] text-emerald-700 truncate">{nombreCliente(p.operacion)}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Acciones rápidas */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Acciones rápidas</p>
            <div className="space-y-1">
              <button
                onClick={() => navigate('/pedidos/nuevo')}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-lime-50 text-sm text-gray-700 hover:text-lime-700 transition-colors"
              >
                <Plus size={14} />
                Nuevo pedido
              </button>
              <button
                onClick={() => navigate('/proveedores')}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors"
              >
                <Truck size={14} />
                Ver proveedores
              </button>
              <button
                onClick={() => navigate('/stock')}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors"
              >
                <Package size={14} />
                Ver existencias
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal detalle */}
      {detailId && (
        <PedidoModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onSaved={cargar}
        />
      )}
    </div>
  );
}
