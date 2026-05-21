import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Plus, Search, X, ChevronRight,
  Phone, MessageCircle, Package, Clock,
  CheckCircle, XCircle, AlertTriangle, Edit,
  Truck, RefreshCw, Calendar, DollarSign,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  notas: string | null;
  proveedor: ProveedorMin;
  operacion: OperacionMin | null;
  items_resumen: { descripcion: string; cantidad: number }[] | null;
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
    : `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() || '—';
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

function waLink(telefono: string | null | undefined, texto: string) {
  if (!telefono) return null;
  const num = telefono.replace(/\D/g, '');
  return `https://wa.me/${num.startsWith('54') ? num : '54' + num}?text=${encodeURIComponent(texto)}`;
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

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<PedidoDetalle>(`/pedidos/${id}`);
      setPedido(d);
    } catch {
      toast.error('Error al cargar el pedido');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [id, onClose]);

  useEffect(() => { cargar(); }, [cargar]);

  async function cambiarEstado(nuevoEstado: string, extra?: Record<string, string>) {
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

  const waLink_ = waLink(pedido.proveedor.telefono, waTextoPedido(pedido));

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
              {waLink_ && (
                <a
                  href={waLink_}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors"
                >
                  <MessageCircle size={13} />
                  WhatsApp
                </a>
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
                  {pedido.operacion.cliente?.telefono && (
                    <a
                      href={waLink(pedido.operacion.cliente.telefono, `Hola ${nombreCliente(pedido.operacion)}, te aviso que tu pedido fue recibido y estamos preparándolo para entregarte!`) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <MessageCircle size={12} />
                      Avisar cliente
                    </a>
                  )}
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
                <div key={item.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
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
              <div className="flex justify-between items-center mt-3 pt-3 border-t">
                <span className="text-sm font-semibold text-gray-600">Total</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(pedido.monto_total)}</span>
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
            <div className="pt-2 border-t">
              <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl">
                <CheckCircle size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-800">Mercadería recibida</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Preparar el packaging y coordinar entrega con el cliente.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/remitos/nuevo?operacion_id=${pedido.operacion!.id}`)}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-600 transition-colors"
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
              <div className="flex gap-2">
                <button
                  onClick={() => cambiarEstado('recibido', { fecha_recepcion: fechaRecepcion })}
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
    <div className="p-4 xl:p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pedidos a Proveedor</h1>
          <p className="text-sm text-gray-500">Gestión de órdenes de compra</p>
        </div>
        <button
          onClick={() => navigate('/pedidos/nuevo')}
          className="flex items-center gap-2 bg-lime-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-lime-600 transition-colors"
        >
          <Plus size={16} />
          Nuevo pedido
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 xl:items-start">

        {/* Tabla principal */}
        <div className="flex-1 min-w-0">

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Pendientes',   value: stats.pendientes,       icon: Clock,         cls: 'text-amber-600' },
              { label: 'Enviados',     value: stats.enviados,         icon: Truck,         cls: 'text-sky-600' },
              { label: 'Recibidos (semana)', value: stats.recibidos_semana, icon: CheckCircle, cls: 'text-emerald-600' },
              { label: 'Valor pendiente', value: formatCurrency(stats.valor_pendiente), icon: DollarSign, cls: 'text-purple-600', raw: true },
            ].map(({ label, value, icon: Icon, cls, raw }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={cls} />
                  <span className="text-[11px] text-gray-400 font-medium">{label}</span>
                </div>
                <p className={cn('text-xl font-bold', cls)}>{raw ? value : value}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 p-3 border-b border-gray-100">
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
                <div className="grid text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-4 py-2 border-b border-gray-100"
                  style={{ gridTemplateColumns: '140px 1fr 1fr 120px 110px 90px' }}>
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
                  const waText = waTextoPedido(p);
                  const waUrl  = waLink(p.proveedor.telefono, waText);
                  const primerItem = p.items_resumen?.[0];
                  const masItems   = (p.items_resumen?.length ?? 0) - 1;

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'grid items-center px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors',
                        'border-l-2', borderColor(p.estado)
                      )}
                      style={{ gridTemplateColumns: '140px 1fr 1fr 120px 110px 90px' }}
                      onClick={() => setDetailId(p.id)}
                    >
                      {/* Pedido */}
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{p.numero}</p>
                        <p className="text-[11px] text-gray-400">{formatFecha(p.fecha_pedido)}</p>
                      </div>

                      {/* Proveedor */}
                      <div className="pr-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.proveedor.nombre}</p>
                        {primerItem && (
                          <p className="text-[11px] text-gray-400 truncate">
                            {primerItem.descripcion} x{primerItem.cantidad}
                            {masItems > 0 && ` +${masItems} más`}
                          </p>
                        )}
                      </div>

                      {/* Operación / Cliente */}
                      <div className="pr-2">
                        {p.operacion ? (
                          <>
                            <p className="text-sm text-blue-700 font-medium">{p.operacion.numero}</p>
                            <p className="text-[11px] text-gray-400 truncate">{nombreCliente(p.operacion)}</p>
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-300">—</span>
                        )}
                      </div>

                      {/* Estado */}
                      <div>{estadoBadge(p.estado)}</div>

                      {/* Fecha entrega */}
                      <div>
                        <p className="text-sm text-gray-700">{formatFecha(p.fecha_entrega_est)}</p>
                      </div>

                      {/* Monto */}
                      <div className="text-right" onClick={e => e.stopPropagation()}>
                        {p.monto_total > 0 && (
                          <p className="text-sm font-semibold text-gray-700">{formatCurrency(p.monto_total)}</p>
                        )}
                        <div className="flex justify-end gap-1 mt-1">
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-green-50 text-green-500"
                              title="Enviar por WhatsApp"
                            >
                              <MessageCircle size={13} />
                            </a>
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
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
            <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
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
            <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
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
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
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
