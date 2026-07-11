import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HelpButton } from '@/components/HelpButton';
import { SectionHero } from '@/components/SectionHero';
import { CompactStatsBar } from '@/components/CompactStatsBar';
import {
  Plus, Search, FileText, CheckCircle, XCircle,
  X, Pen, Printer, Share2, Copy, Check, Phone, Mail, User,
  CreditCard, Truck, MapPin, Gift, Building2, Package,
  ChevronLeft, ChevronRight, MoreVertical, TrendingUp, AlertTriangle,
  Clock, MessageSquare, List, LayoutGrid, Download, Flame, Receipt, ShoppingCart,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { EstadoOperacion } from '@/types';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface ClienteMin {
  id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  telefono: string | null;
  email?: string | null;
}

interface PresupuestoPanel {
  id: string;
  numero: string;
  tipo: string;
  estado: string;
  precio_total: number;
  created_at: string;
  fecha_validez: string | null;
  aprobado_online_at: string | null;
  link_enviado: boolean;
  motivo_rechazo: string | null;
  dias_vencido: number | null;
  dias_hasta_vencimiento: number | null;
  dias_sin_respuesta: number;
  ultimo_contacto_canal: string | null;
  prioridad: 'alta' | 'media' | 'baja';
  cobrado_total: number;
  estado_cobro: 'sin_cobrar' | 'seña' | 'cobrado' | null;
  tiene_pedido: boolean;
  pedido_estado: 'pendiente' | 'enviado' | 'recibido' | 'cancelado' | null;
  items_total: number;
  items_en_pedido: number;
  cliente: ClienteMin;
}

interface VentasStats {
  total_activos: number;
  importe_total: number;
  sin_respuesta_count: number;
  sin_respuesta_monto: number;
  vencidos_count: number;
  vencidos_monto: number;
  tasa_cierre_pct: number;
  en_riesgo_total: number;
}

interface VentasPanel {
  stats: VentasStats;
  presupuestos: PresupuestoPanel[];
  seguimiento_sugerido: PresupuestoPanel[];
  prob_cierre: { alta: number; media: number; baja: number };
}

interface PedidoResumen {
  id: string;
  numero: string;
  estado: 'pendiente' | 'enviado' | 'recibido' | 'cancelado';
  proveedor: { nombre: string };
  monto_total: number;
  fecha_pedido: string;
}

interface OpDetalle {
  id: string; numero: string; tipo: string; estado: EstadoOperacion;
  cliente_id: string; cobrado_total: number; total_descuentos: number; proveedor_id: string | null;
  tipo_proyecto: string | null; forma_pago: string | null;
  tiempo_entrega: number | null; fecha_validez: string | null;
  notas: string | null; created_at: string; updated_at: string;
  forma_envio: string | null; costo_envio: number;
  cliente: {
    nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; telefono: string | null; email: string | null;
    direccion: string | null; localidad: string | null;
  };
  items: Array<{
    id: string; descripcion: string; cantidad: number;
    precio_unitario: number; precio_instalacion: number;
    incluye_instalacion: boolean; precio_total: number;
    medida_ancho: number | null; medida_alto: number | null;
    color: string | null; vidrio: string | null; accesorios: string[];
    tipo_abertura_nombre: string | null; sistema_nombre: string | null;
    producto_atributos: Record<string, unknown> | null;
  }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

type Tab = 'todos' | 'sin_respuesta' | 'por_vencer' | 'vencidos' | 'aprobados' | 'perdidos';
type Orden = 'prioridad' | 'monto' | 'vencimiento' | 'reciente';

const PER_PAGE = 6;

const PRIO_CFG = {
  alta:  { label: 'Alta prioridad',  bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-l-red-500' },
  media: { label: 'Media prioridad', bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-l-amber-400' },
  baja:  { label: 'Listo p/ cerrar', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-l-emerald-400' },
};

const ESTADO_COLOR: Record<string, string> = {
  presupuesto:   'bg-gray-100 text-gray-700',
  enviado:       'bg-blue-100 text-blue-700',
  aprobado:      'bg-emerald-100 text-emerald-700',
  rechazado:     'bg-red-100 text-red-700',
  cancelado:     'bg-red-100 text-red-700',
  en_produccion: 'bg-amber-100 text-amber-700',
  listo:         'bg-teal-100 text-teal-700',
};

const ESTADO_LABEL: Record<string, string> = {
  presupuesto: 'Pendiente de Aprobación',
  enviado:     'Enviado',
  aprobado:    'Aprobado',
  rechazado:   'Rechazado',
  cancelado:   'Cancelado',
};

const FORMA_ENVIO_LABEL: Record<string, { label: string; icon: React.ElementType }> = {
  retiro_local:     { label: 'Retiro en local',                icon: MapPin },
  envio_bonificado: { label: 'Envío bonificado',               icon: Gift },
  envio_destino:    { label: 'Envío a destino (paga cliente)', icon: Truck },
  envio_empresa:    { label: 'Envío a cargo de la empresa',    icon: Building2 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function nombreCliente(c: ClienteMin): string {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '-';
  return `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim() || '-';
}

function initials(c: ClienteMin): string {
  const name = nombreCliente(c);
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
];

function avatarColor(c: ClienteMin): string {
  return AVATAR_COLORS[(nombreCliente(c).charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function canalLabel(canal: string | null): string {
  const map: Record<string, string> = {
    whatsapp: 'WhatsApp', llamada: 'Llamada', email: 'Email',
    visita: 'Visita', nota: 'Nota',
    presupuesto_enviado: 'Presupuesto', operacion_completada: 'Operación',
  };
  return canal ? (map[canal] ?? canal) : '-';
}

function canalColor(canal: string | null): string {
  if (canal === 'whatsapp') return 'text-green-600';
  if (canal === 'llamada')  return 'text-blue-600';
  if (canal === 'email')    return 'text-violet-600';
  return 'text-gray-400';
}

function fmtDias(dias: number): string {
  if (dias >= 999) return 'Sin registro';
  if (dias === 0)  return 'Hoy';
  if (dias === 1)  return 'Hace 1 día';
  return `Hace ${dias} días`;
}

function fmtVencimiento(p: PresupuestoPanel): { text: string; color: string } | null {
  // No mostrar vencimiento si ya está aprobado, rechazado o cancelado
  if (['aprobado', 'rechazado', 'cancelado'].includes(p.estado)) return null;
  if (!p.fecha_validez) return null;
  const dv = p.dias_vencido ?? 0;
  const dh = p.dias_hasta_vencimiento ?? 0;
  if (dv > 0) return { text: `Vencido hace ${dv} día${dv !== 1 ? 's' : ''}`, color: 'text-red-500 font-semibold' };
  if (dh === 0) return { text: 'Vence hoy', color: 'text-amber-500 font-semibold' };
  if (dh <= 7)  return { text: `En ${dh} días`, color: 'text-amber-500' };
  return { text: formatDate(p.fecha_validez.slice(0, 10) + 'T12:00:00'), color: 'text-gray-500' };
}

function borderColor(p: PresupuestoPanel): string {
  if (p.estado === 'rechazado') return 'border-l-red-500';
  if (p.estado === 'cancelado') return 'border-l-gray-300';
  if (p.estado === 'aprobado') return 'border-l-emerald-500';
  return PRIO_CFG[p.prioridad].border;
}

function whatsappUrl(telefono: string | null, mensaje?: string): string {
  const num = (telefono ?? '').replace(/\D/g, '');
  const base = `https://wa.me/${num.startsWith('54') ? num : '54' + num}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

// ── DonutChart ────────────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((s, g) => s + g.value, 0);
  const r = 36; const circ = 2 * Math.PI * r; const cx = 44; const cy = 44;
  let offset = 0;
  const paths = segments.map((seg, i) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * circ;
    const el = (
      <circle key={i} cx={cx} cy={cy} r={r} fill="none"
        stroke={seg.color} strokeWidth={14}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={-offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
      />
    );
    offset += dash;
    return el;
  });
  return (
    <svg width={88} height={88}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={14} />
      {paths}
    </svg>
  );
}


// ── PresupuestoModal ──────────────────────────────────────────────────────────

function PresupuestoModal({
  id, onClose, onEstadoChange, onRefresh, itemsEnPedido, itemsTotal,
}: {
  id: string;
  onClose: () => void;
  onEstadoChange: (id: string, estado: EstadoOperacion) => void;
  onRefresh: () => void;
  itemsEnPedido?: number;
  itemsTotal?: number;
}) {
  const navigate = useNavigate();
  const [op, setOp] = useState<OpDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando]         = useState(false);
  const [linkUrl, setLinkUrl]             = useState<string | null>(null);
  const [generandoLink, setGenerandoLink] = useState(false);
  const [enviandoWA, setEnviandoWA]       = useState(false);
  const [copiado, setCopiado]             = useState(false);
  const [copiadoMsg, setCopiadoMsg]       = useState(false);
  const [pedidos, setPedidos]             = useState<PedidoResumen[]>([]);

  // ESC cierra el modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const todosItemsEnviados = (itemsTotal ?? 0) > 0 && (itemsEnPedido ?? 0) >= (itemsTotal ?? 1);

  useEffect(() => {
    setLoading(true); setError(null);
    api.get<OpDetalle>(`/operaciones/${id}`)
      .then(d => {
        setOp(d);
        setLoading(false);
        if (d.estado === 'aprobado') {
          api.get<PedidoResumen[]>(`/pedidos?operacion_id=${d.id}`)
            .then(setPedidos)
            .catch(() => {});
        }
      })
      .catch(err => { setError(err.message ?? 'Error al cargar'); setLoading(false); });
  }, [id]);

  function buildMensajeWA(url: string) {
    if (!op) return url;
    const cl = op.cliente;
    const nombre = cl.tipo_persona === 'juridica' ? cl.razon_social : `${cl.apellido ?? ''} ${cl.nombre ?? ''}`.trim();
    return `Hola ${nombre}, te envío el presupuesto *${op.numero}* para tu revisión.\n\nPodés aprobarlo desde este enlace:\n${url}`;
  }

  async function copiarTexto(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  async function generarLink() {
    if (esVencido) {
      toast.error('El presupuesto está vencido. Editalo para actualizar la fecha de validez antes de compartir.');
      return;
    }
    setGenerandoLink(true);
    try {
      const { url } = await api.post<{ token: string; url: string }>(`/operaciones/${id}/generar-link`, {});
      setLinkUrl(url);
      // Auto-copia el mensaje completo al generar
      await copiarTexto(buildMensajeWA(url));
      toast.success('Link generado — mensaje copiado al portapapeles');
    } finally { setGenerandoLink(false); }
  }

  async function copiarLink() {
    if (!linkUrl) return;
    await copiarTexto(linkUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function copiarMensaje() {
    if (!linkUrl) return;
    await copiarTexto(buildMensajeWA(linkUrl));
    setCopiadoMsg(true);
    setTimeout(() => setCopiadoMsg(false), 2000);
  }

  async function enviarWhatsApp() {
    if (!op) return;
    setEnviandoWA(true);
    try {
      const res = await api.post<{ enviado: boolean; numero: string; url: string }>(
        `/operaciones/${id}/enviar-whatsapp`, {}
      );
      setLinkUrl(res.url);
      toast.success(`Mensaje enviado al ${res.numero}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al enviar por WhatsApp');
    } finally {
      setEnviandoWA(false);
    }
  }

  async function cambiarEstado(nuevoEstado: EstadoOperacion) {
    if (!op) return;
    setCambiando(true);
    await api.patch(`/operaciones/${id}/estado`, { estado: nuevoEstado });
    const updated = { ...op, estado: nuevoEstado };
    setOp(updated);
    onEstadoChange(id, nuevoEstado);
    onRefresh();
    setCambiando(false);
  }

  const esAprobado  = op?.estado === 'aprobado';
  const puedeEditar = op && !esAprobado;
  const esVencido   = op?.fecha_validez
    ? new Date(op.fecha_validez.slice(0, 10) + 'T23:59:59') < new Date()
    : false;
  const subtotal    = op ? op.items.reduce((s, it) => s + Number(it.precio_total), 0) : 0;
  const costoEnvio  = op?.forma_envio === 'envio_empresa' ? Number(op.costo_envio ?? 0) : 0;
  const total       = subtotal + costoEnvio;
  const esCuotas    = op?.forma_pago === 'Tarjeta de crédito 3 cuotas sin interés';
  const fmtEnvio    = op?.forma_envio ? FORMA_ENVIO_LABEL[op.forma_envio] : null;
  const EnvioIcon   = fmtEnvio?.icon ?? null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-full items-start justify-center p-4 pt-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText size={16} className="text-violet-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{op?.numero ?? '...'}</span>
                {op && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', ESTADO_COLOR[op.estado] ?? 'bg-gray-100 text-gray-700')}>
                    {ESTADO_LABEL[op.estado] ?? op.estado}
                  </span>
                )}
              </div>
              {op && <p className="text-xs text-gray-400 mt-0.5">{formatDate(op.created_at)}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {op && (
              <>
                {puedeEditar && (
                  <button onClick={() => navigate(`/presupuestos/${id}/editar`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg font-medium transition-colors">
                    <Pen size={13} /> Editar
                  </button>
                )}
                {esAprobado && Number(op.cobrado_total) > 0.01 && (
                  <button onClick={() => { onClose(); navigate(`/pedidos/nuevo?operacion_id=${op.id}`); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-lime-50 hover:bg-lime-100 text-lime-700 border border-lime-200 rounded-lg font-medium transition-colors">
                    <ShoppingCart size={13} />
                    {pedidos.filter(p => p.estado !== 'cancelado').length > 0 ? 'Otro pedido' : 'Pedido al proveedor'}
                  </button>
                )}
                <button onClick={() => window.open(`/imprimir/presupuesto/${id}`, '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg font-medium transition-colors">
                  <Printer size={13} /> PDF
                </button>
                <button onClick={generarLink} disabled={generandoLink || esVencido}
                  title={esVencido ? 'Presupuesto vencido — actualizá la fecha de validez antes de compartir' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    esVencido
                      ? 'bg-gray-50 text-gray-400 border-gray-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}>
                  <Share2 size={13} /> {generandoLink ? '...' : 'Compartir'}
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {linkUrl && (
          <div className="mx-5 mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2.5">
            <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
              <Check size={12} className="text-emerald-600" /> Link generado — mensaje copiado automáticamente
            </p>
            {/* URL */}
            <div className="flex items-center gap-2">
              <input readOnly value={linkUrl}
                className="flex-1 text-xs bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-mono select-all"
                onClick={e => (e.target as HTMLInputElement).select()} />
              <button onClick={copiarLink}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-medium transition-colors">
                {copiado ? <Check size={12} /> : <Copy size={12} />}
                {copiado ? 'Copiado' : 'Copiar link'}
              </button>
            </div>
            {/* Acciones */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copiarMensaje}
                className="flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors">
                {copiadoMsg ? <Check size={12} /> : <Copy size={12} />}
                {copiadoMsg ? 'Copiado' : 'Copiar mensaje'}
              </button>
              <button onClick={enviarWhatsApp} disabled={enviandoWA}
                className="flex items-center justify-center gap-1.5 py-2 bg-[#25D366] hover:bg-[#1ebe5a] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                {enviandoWA ? 'Enviando...' : 'Enviar por WhatsApp'}
              </button>
            </div>
            <p className="text-[10px] text-emerald-700 text-center">El link regenerado invalida el anterior</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 text-sm">{error}</div>
        ) : op ? (
          <div className="divide-y divide-gray-100">
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2.5">
                <User size={13} className="text-gray-400" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cliente</p>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {op.cliente.tipo_persona === 'juridica'
                  ? op.cliente.razon_social
                  : `${op.cliente.apellido ?? ''} ${op.cliente.nombre ?? ''}`.trim()}
              </p>
              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                {op.cliente.telefono  && <span>{op.cliente.telefono}</span>}
                {op.cliente.email     && <span>{op.cliente.email}</span>}
                {(op.cliente.direccion || op.cliente.localidad) && (
                  <span>{[op.cliente.direccion, op.cliente.localidad].filter(Boolean).join(', ')}</span>
                )}
              </div>
            </div>

            <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {op.tipo_proyecto   && <div><span className="text-gray-400">Proyecto: </span><span className="font-medium">{op.tipo_proyecto}</span></div>}
              {op.tiempo_entrega  && <div><span className="text-gray-400">Entrega: </span><span className="font-medium">{op.tiempo_entrega} días</span></div>}
              {op.fecha_validez   && <div><span className="text-gray-400">Válido hasta: </span><span className="font-medium">{formatDate(op.fecha_validez.slice(0, 10) + 'T12:00:00')}</span></div>}
              {op.forma_pago      && <div className="col-span-2"><span className="text-gray-400">Pago: </span><span className="font-semibold text-violet-700">{op.forma_pago}</span></div>}
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Package size={13} className="text-gray-400" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Ítems ({op.items.length})</p>
              </div>
              <div className="space-y-2.5">
                {op.items.map((item, i) => {
                  const attr = item.producto_atributos ?? {};
                  const hojas = (attr as any).hojas ? `${(attr as any).hojas} hojas` : (attr as any).config_hojas ? String((attr as any).config_hojas) : null;
                  const specs = [
                    item.tipo_abertura_nombre, item.sistema_nombre, item.color, hojas,
                    (item.medida_ancho || item.medida_alto) ? `${item.medida_ancho ?? '?'} × ${item.medida_alto ?? '?'} m` : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <div key={item.id} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-400 shrink-0">{i + 1}.</span>
                          <span className="text-sm font-medium text-gray-800 truncate">{item.descripcion}</span>
                          {item.cantidad > 1 && <span className="text-xs text-gray-400 shrink-0">× {item.cantidad}</span>}
                        </div>
                        {specs && <p className="text-[11px] text-gray-400 mt-0.5 ml-4">{specs}</p>}
                        {item.accesorios.length > 0 && <p className="text-[11px] text-gray-400 mt-0.5 ml-4">Incluye: {item.accesorios.join(', ')}</p>}
                        {item.incluye_instalacion && <span className="ml-4 text-[10px] text-emerald-600 font-medium">✓ Con instalación</span>}
                      </div>
                      <span className="text-sm font-bold text-gray-800 shrink-0">{formatCurrency(Number(item.precio_total))}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-4 space-y-2">
              {fmtEnvio && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CreditCard size={13} className="text-gray-400" />
                  {EnvioIcon && <EnvioIcon size={13} className="text-gray-400" />}
                  <span>{fmtEnvio.label}</span>
                  {costoEnvio > 0 && <span className="font-semibold">({formatCurrency(costoEnvio)})</span>}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                {costoEnvio > 0 && (
                  <span className="text-xs text-gray-400">Productos: {formatCurrency(subtotal)} + Envío: {formatCurrency(costoEnvio)}</span>
                )}
                <span className="text-xs text-gray-500">Total:</span>
                <span className="text-xl font-bold text-gray-900">{formatCurrency(total)}</span>
              </div>
              {esCuotas && total > 0 && (
                <div className="flex justify-end">
                  <span className="text-xs text-violet-600 font-semibold bg-violet-50 px-3 py-1 rounded-lg border border-violet-100">
                    3 cuotas de {formatCurrency(total / 3)}
                  </span>
                </div>
              )}
              {op.notas && (
                <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700 border border-amber-100">{op.notas}</div>
              )}
            </div>

            {op.estado === 'aprobado' && (() => {
              const cobrado    = Number(op.cobrado_total    ?? 0);
              const descuentos = Number(op.total_descuentos ?? 0);
              const saldo      = Math.max(0, total - cobrado - descuentos);
              const pct        = total > 0 ? Math.min(100, Math.round((cobrado + descuentos) / total * 100)) : 0;
              const ecLabel    = cobrado < 0.01 ? 'Sin cobrar' : saldo < 0.01 ? 'Cobrado' : 'Pago parcial (seña)';
              const ecColor    = cobrado < 0.01 ? 'text-amber-600' : saldo < 0.01 ? 'text-emerald-600' : 'text-sky-600';
              return (
                <div className="px-5 py-4 bg-gray-50/60">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Receipt size={13} className="text-gray-400" />
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cobranza</p>
                    </div>
                    <span className={cn('text-[10px] font-semibold', ecColor)}>{ecLabel}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                    <div className="bg-white rounded-lg px-2 py-2 border border-gray-200">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Total</p>
                      <p className="text-xs font-bold text-gray-800">{formatCurrency(total)}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg px-2 py-2 border border-emerald-100">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Cobrado</p>
                      <p className="text-xs font-bold text-emerald-700">{formatCurrency(cobrado)}</p>
                      {descuentos > 0.01 && (
                        <p className="text-[9px] text-violet-500 mt-0.5">+{formatCurrency(descuentos)} bonif.</p>
                      )}
                    </div>
                    <div className={cn('rounded-lg px-2 py-2 border', saldo > 0.01 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-200')}>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Saldo</p>
                      <p className={cn('text-xs font-bold', saldo > 0.01 ? 'text-amber-700' : 'text-gray-400')}>{formatCurrency(saldo)}</p>
                    </div>
                  </div>
                  {total > 0 && (
                    <div className="mb-3">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 text-right">{pct}% cobrado</p>
                    </div>
                  )}
                  {saldo > 0.01 && (
                    <button
                      onClick={() => { onClose(); navigate(`/recibos/nuevo?operacion_id=${op.id}&cliente_id=${op.cliente_id}&monto=${Math.round(saldo)}&concepto=${encodeURIComponent(cobrado > 0.01 ? 'Cancelación de saldo' : 'Pago total')}`); }}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      <Receipt size={13} /> Registrar cobro
                    </button>
                  )}
                  {cobrado > 0.01 && !todosItemsEnviados && (
                    <button
                      onClick={() => { onClose(); navigate(`/pedidos/nuevo?operacion_id=${op.id}`); }}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-lime-500 hover:bg-lime-600 text-white rounded-xl text-xs font-semibold transition-colors mt-1"
                    >
                      <ShoppingCart size={13} />
                      {pedidos.filter(p => p.estado !== 'cancelado').length > 0
                        ? 'Generar pedido a otro proveedor'
                        : 'Generar pedido al proveedor'}
                    </button>
                  )}

                  {/* Pedidos vinculados — trazabilidad por proveedor */}
                  {pedidos.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ShoppingCart size={11} className="text-gray-400" />
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                            Pedidos al proveedor ({pedidos.length})
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {pedidos.map(ped => {
                          const estadoColor = {
                            pendiente: 'bg-gray-100 text-gray-600',
                            enviado:   'bg-blue-100 text-blue-700',
                            recibido:  'bg-emerald-100 text-emerald-700',
                            cancelado: 'bg-red-100 text-red-600',
                          }[ped.estado] ?? 'bg-gray-100 text-gray-600';
                          return (
                            <button
                              key={ped.id}
                              onClick={() => { onClose(); navigate(`/pedidos?operacion_id=${op.id}`); }}
                              className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-lime-300 hover:bg-lime-50 transition-colors text-left"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-700">{ped.numero}</p>
                                <p className="text-[10px] text-gray-400 truncate">{ped.proveedor.nombre}</p>
                                {ped.monto_total > 0 && (
                                  <p className="text-[10px] text-gray-400">{formatCurrency(ped.monto_total)}</p>
                                )}
                              </div>
                              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2', estadoColor)}>
                                {ped.estado}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {/* Aviso si pedidos pendientes de recepción */}
                      {pedidos.some(p => p.estado !== 'cancelado' && p.estado !== 'recibido') && (
                        <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                          <span>⚠</span> Hay pedidos que aún no fueron recibidos
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {!esAprobado && (
              <div className="px-5 py-3 flex items-center gap-2 bg-gray-50 rounded-b-2xl">
                <span className="text-xs text-gray-400 mr-1">Cambiar estado:</span>
                {op.estado !== 'aprobado' && (
                  <button onClick={() => cambiarEstado('aprobado')} disabled={cambiando}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium disabled:opacity-50">
                    <CheckCircle size={11} /> Aceptar
                  </button>
                )}
                {op.estado !== 'rechazado' && (
                  <button onClick={() => cambiarEstado('rechazado')} disabled={cambiando}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium disabled:opacity-50">
                    <XCircle size={11} /> Rechazar
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Presupuestos() {
  const [data, setData]         = useState<VentasPanel | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Tab>('todos');
  const [orden, setOrden]       = useState<Orden>('reciente');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage]         = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailPanel, setDetailPanel] = useState<PresupuestoPanel | null>(null);
  const [enviandoWaIds, setEnviandoWaIds] = useState<Set<string>>(new Set());
  const [showCancelados, setShowCancelados] = useState(false);

  async function enviarMensajeWa(clienteId: string, mensaje: string) {
    setEnviandoWaIds(s => new Set(s).add(clienteId));
    try {
      await api.post(`/clientes/${clienteId}/enviar-mensaje-whatsapp`, { mensaje });
      toast.success('Mensaje enviado por WhatsApp');
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al enviar WhatsApp');
    } finally {
      setEnviandoWaIds(s => { const n = new Set(s); n.delete(clienteId); return n; });
    }
  }

  function abrirDetalle(p: PresupuestoPanel) { setDetailId(p.id); setDetailPanel(p); }
  const [ordenOpen, setOrdenOpen] = useState(false);
  const ordenRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<VentasPanel>('/operaciones/ventas-panel');
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Recargar al volver al tab (cliente aprobó mientras estaba en otra pestaña)
  useEffect(() => {
    function handleVisibility() { if (document.visibilityState === 'visible') load(); }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [load]);

  // Recargar cuando NotificationBell detecta aprobación online nueva
  useEffect(() => {
    function handleAprobado(e: Event) {
      const detail = (e as CustomEvent).detail;
      const nuevas: Array<{ numero?: string }> = detail?.nuevas ?? [];
      load();
      if (nuevas.length > 0) {
        const nums = nuevas.map((n: { numero?: string }) => n.numero).filter(Boolean).join(', ');
        toast.success(`Aprobación online recibida${nums ? ` — Presupuesto ${nums}` : ''}`, {
          description: 'La lista se actualizó automáticamente',
          duration: 6000,
        });
      }
    }
    window.addEventListener('presupuesto:aprobado-online', handleAprobado);
    return () => window.removeEventListener('presupuesto:aprobado-online', handleAprobado);
  }, [load]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ordenRef.current && !ordenRef.current.contains(e.target as Node)) setOrdenOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const presupuestos = useMemo(() => (data?.presupuestos ?? []).filter(p => p.estado !== 'cancelado'), [data]);
  const cancelados    = useMemo(() => (data?.presupuestos ?? []).filter(p => p.estado === 'cancelado'), [data]);

  const conteos = useMemo(() => {
    const sinResp  = presupuestos.filter(p => p.estado === 'enviado' && p.dias_sin_respuesta > 3).length;
    const porVence = presupuestos.filter(p => ['presupuesto','enviado'].includes(p.estado) && p.dias_hasta_vencimiento !== null && (p.dias_hasta_vencimiento ?? -1) >= 0 && (p.dias_hasta_vencimiento ?? -1) <= 7).length;
    const vencidos = presupuestos.filter(p => ['presupuesto','enviado'].includes(p.estado) && (p.dias_vencido ?? 0) > 0).length;
    const aprobados = presupuestos.filter(p => p.estado === 'aprobado').length;
    const perdidos  = presupuestos.filter(p => p.estado === 'rechazado').length;
    return { todos: presupuestos.length, sinResp, porVence, vencidos, aprobados, perdidos };
  }, [presupuestos]);

  const filtrado = useMemo(() => {
    let result = presupuestos;
    if (tab === 'sin_respuesta') result = result.filter(p => p.estado === 'enviado' && p.dias_sin_respuesta > 3);
    else if (tab === 'por_vencer') result = result.filter(p => ['presupuesto','enviado'].includes(p.estado) && p.dias_hasta_vencimiento !== null && (p.dias_hasta_vencimiento ?? -1) >= 0 && (p.dias_hasta_vencimiento ?? -1) <= 7);
    else if (tab === 'vencidos') result = result.filter(p => ['presupuesto','enviado'].includes(p.estado) && (p.dias_vencido ?? 0) > 0);
    else if (tab === 'aprobados') result = result.filter(p => p.estado === 'aprobado');
    else if (tab === 'perdidos') result = result.filter(p => p.estado === 'rechazado');

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      result = result.filter(p =>
        p.numero.toLowerCase().includes(q) ||
        nombreCliente(p.cliente).toLowerCase().includes(q)
      );
    }

    const PRIO_ORD: Record<string, number> = { alta: 0, media: 1, baja: 2 };
    if (orden === 'prioridad') result = [...result].sort((a, b) => PRIO_ORD[a.prioridad] - PRIO_ORD[b.prioridad]);
    else if (orden === 'monto') result = [...result].sort((a, b) => b.precio_total - a.precio_total);
    else if (orden === 'vencimiento') result = [...result].sort((a, b) => {
      const da = a.dias_hasta_vencimiento ?? 9999;
      const db = b.dias_hasta_vencimiento ?? 9999;
      return da - db;
    });
    else result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  }, [presupuestos, tab, busqueda, orden]);

  const totalPages = Math.max(1, Math.ceil(filtrado.length / PER_PAGE));
  const paginated  = filtrado.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => { setPage(1); }, [tab, busqueda, orden]);

  function onEstadoChange(id: string, estado: EstadoOperacion) {
    if (!data) return;
    setData({ ...data, presupuestos: data.presupuestos.map(p => p.id === id ? { ...p, estado } : p) });
  }

  const s = data?.stats;
  const seg = data?.seguimiento_sugerido ?? [];
  const prob = data?.prob_cierre ?? { alta: 0, media: 0, baja: 0 };
  const probTotal = prob.alta + prob.media + prob.baja;

  const TABS: { value: Tab; label: string; count: number; dot?: string }[] = [
    { value: 'todos',         label: 'Todos',         count: conteos.todos },
    { value: 'sin_respuesta', label: 'Sin respuesta',  count: conteos.sinResp,  dot: 'bg-amber-400' },
    { value: 'por_vencer',    label: 'Por vencer',     count: conteos.porVence, dot: 'bg-amber-500' },
    { value: 'vencidos',      label: 'Vencidos',       count: conteos.vencidos, dot: 'bg-red-500' },
    { value: 'aprobados',     label: 'Aprobados',      count: conteos.aprobados, dot: 'bg-emerald-500' },
    { value: 'perdidos',      label: 'Perdidos',       count: conteos.perdidos },
  ];

  const ORDENES: { value: Orden; label: string }[] = [
    { value: 'prioridad',   label: 'Prioridad' },
    { value: 'monto',       label: 'Monto mayor' },
    { value: 'vencimiento', label: 'Vencimiento próximo' },
    { value: 'reciente',    label: 'Más reciente' },
  ];

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-[1440px] mx-auto" data-section="presupuestos">
      <SectionHero
        section="presupuestos"
        icon={FileText}
        title="Presupuestos"
        sub="Gestión de cotizaciones"
        actions={<>
          <HelpButton topic="presupuestos" />
          <Link to="/presupuestos/nuevo"
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all">
            <Plus size={16} /> Nuevo presupuesto
          </Link>
        </>}
      />

      {s && (
        <div className="mb-5">
          <CompactStatsBar items={[
            { value: s.total_activos,             label: 'presupuestos activos',    color: '#a78bfa' },
            { value: formatCurrency(s.importe_total), label: 'importe total',       color: '#ffffff' },
            { value: s.sin_respuesta_count,        label: 'sin respuesta',           color: '#fbbf24' },
            { value: s.vencidos_count,             label: 'vencidos',                color: '#f87171' },
            { value: `${s.tasa_cierre_pct}%`,      label: 'tasa de cierre',          color: '#34d399' },
          ]} />
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col xl:flex-row gap-4 xl:items-start">
        {/* Left: table */}
        <div className="flex-1 min-w-0">
          {/* Tabs + ordenar */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex gap-1 flex-wrap flex-1">
              {TABS.map(t => (
                <button key={t.value} onClick={() => setTab(t.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
                    tab === t.value
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                  )}>
                  {t.dot && <span className={cn('w-1.5 h-1.5 rounded-full', t.dot)} />}
                  {t.label}
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    tab === t.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  )}>{t.count}</span>
                </button>
              ))}
            </div>
            <div className="relative shrink-0" ref={ordenRef}>
              <button onClick={() => setOrdenOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-gray-300 transition-all whitespace-nowrap">
                Ordenar por <span className="font-semibold text-gray-800">{ORDENES.find(o => o.value === orden)?.label}</span>
                <ChevronLeft size={12} className={cn('transition-transform', ordenOpen ? 'rotate-90' : '-rotate-90')} />
              </button>
              {ordenOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                  {ORDENES.map(o => (
                    <button key={o.value} onMouseDown={() => { setOrden(o.value); setOrdenOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors',
                        orden === o.value ? 'text-violet-600 font-semibold' : 'text-gray-700'
                      )}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search + actions */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar por número, cliente o producto..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-gray-300 transition-all">
              <Download size={13} /> Exportar
            </button>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button className="p-2 bg-violet-50 border-r border-gray-200"><List size={14} className="text-violet-600" /></button>
              <button className="p-2 bg-white hover:bg-gray-50"><LayoutGrid size={14} className="text-gray-400" /></button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg">
            {loading ? (
              <div className="p-3 space-y-1.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 px-3 py-3 animate-pulse grid gap-3"
                    style={{ gridTemplateColumns: '70px 1fr 110px 80px 85px 80px' }}>
                    <div className="h-4 bg-gray-100 rounded" />
                    <div className="h-4 bg-gray-100 rounded" />
                    <div className="h-4 bg-gray-100 rounded" />
                    <div className="h-4 bg-gray-100 rounded" />
                    <div className="h-4 bg-gray-100 rounded" />
                    <div className="h-4 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <div className="py-16 text-center">
                <FileText size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-1">No hay presupuestos</p>
                <Link to="/presupuestos/nuevo" className="text-sm text-violet-600 hover:underline">Crear el primero</Link>
              </div>
            ) : (
              <div className="p-3 space-y-1.5">
                {/* Cabecera columnas */}
                <div className="grid gap-3 px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
                  style={{ gridTemplateColumns: '70px 1fr 110px 80px 85px 80px' }}>
                  <span>N°</span>
                  <span>Cliente</span>
                  <span>Estado</span>
                  <span>Vence</span>
                  <span className="text-right">Importe</span>
                  <span></span>
                </div>

                {paginated.map(p => {
                  const vc     = fmtVencimiento(p);
                  const canal  = p.ultimo_contacto_canal;
                  const prio   = PRIO_CFG[p.prioridad];
                  const isAprobadoOnline = !!p.aprobado_online_at;
                  const isRechazado = p.estado === 'rechazado';

                  const estadoBadge = !p.aprobado_online_at ? (
                    <span className={cn('inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold',
                      p.link_enviado && p.estado === 'presupuesto'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : ESTADO_COLOR[p.estado] ?? 'bg-gray-100 text-gray-700'
                    )}>
                      {p.link_enviado && p.estado === 'presupuesto'
                        ? '⏳ Pendiente aprobación'
                        : ESTADO_LABEL[p.estado] ?? p.estado}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">
                      ✓ Aprobado Online
                    </span>
                  );

                  const cobroBadge = p.estado === 'aprobado' && p.estado_cobro ? (
                    <span title={
                      p.estado_cobro === 'sin_cobrar' ? 'No se registró ningún pago'
                      : p.estado_cobro === 'seña'     ? 'Pago parcial — saldo pendiente'
                      : 'Total cobrado'
                    } className={cn(
                      'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold cursor-default',
                      p.estado_cobro === 'sin_cobrar' && 'bg-amber-50 text-amber-700 border border-amber-200',
                      p.estado_cobro === 'seña'       && 'bg-sky-50 text-sky-700 border border-sky-200',
                      p.estado_cobro === 'cobrado'    && 'bg-emerald-100 text-emerald-700',
                    )}>
                      {p.estado_cobro === 'sin_cobrar' && '○ Sin cobrar'}
                      {p.estado_cobro === 'seña'       && `◑ Seña ${formatCurrency(p.cobrado_total)}`}
                      {p.estado_cobro === 'cobrado'    && '● Cobrado'}
                    </span>
                  ) : null;

                  const pedidoBadge = p.tiene_pedido && p.pedido_estado !== 'cancelado' ? (() => {
                    const parcial  = (p.items_en_pedido ?? 0) > 0 && (p.items_en_pedido ?? 0) < (p.items_total ?? 1);
                    const completo = (p.items_total ?? 0) > 0 && (p.items_en_pedido ?? 0) >= (p.items_total ?? 1);
                    const label = p.pedido_estado === 'recibido' ? 'Pedido recibido'
                      : completo ? 'Env. total proveedor'
                      : parcial  ? 'Env. parcial proveedor'
                      : 'Pedido generado';
                    const cls = p.pedido_estado === 'recibido' ? 'bg-emerald-100 text-emerald-700'
                      : completo ? 'bg-blue-100 text-blue-700'
                      : parcial  ? 'bg-amber-100 text-amber-700'
                      : 'bg-lime-100 text-lime-700';
                    return (
                      <span title={`Pedido al proveedor: ${p.pedido_estado}`}
                        className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold cursor-default', cls)}>
                        <ShoppingCart size={9} />{label}
                      </span>
                    );
                  })() : null;

                  return (
                    <div key={p.id}
                      className={cn(
                        'rounded-xl border border-gray-200 border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-gray-300 group',
                        borderColor(p),
                        isAprobadoOnline && 'bg-emerald-50/60 border-emerald-200',
                        isRechazado && !isAprobadoOnline && 'bg-red-50/50 border-red-200',
                      )}
                      onClick={() => abrirDetalle(p)}>

                      <div className="grid gap-3 px-3 py-2.5 items-start"
                        style={{ gridTemplateColumns: '70px 1fr 110px 80px 85px 80px' }}>

                        {/* N° + fecha */}
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-mono text-gray-400 group-hover:text-violet-500 transition-colors">{p.numero}</span>
                            {isAprobadoOnline && <Check size={10} className="text-emerald-500" />}
                          </div>
                          <p className="text-[10px] text-gray-300 mt-0.5">{formatDate(p.created_at)}</p>
                          {p.tipo && p.tipo !== 'estandar' && (
                            <p className="text-[9px] text-gray-300 mt-0.5">{p.tipo === 'a_medida_proveedor' ? 'A medida' : 'Fab. propia'}</p>
                          )}
                        </div>

                        {/* Cliente */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0', avatarColor(p.cliente))}>
                              {initials(p.cliente)}
                            </div>
                            <span className="text-sm font-bold text-gray-900 truncate group-hover:text-violet-700 transition-colors">
                              {nombreCliente(p.cliente)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 ml-[30px] flex-wrap">
                            {p.cliente.telefono && <span className="text-[10px] text-gray-400">{p.cliente.telefono}</span>}
                            {canal && <span className={cn('text-[10px] font-medium', canalColor(canal))}>{canalLabel(canal)}</span>}
                            {pedidoBadge}
                          </div>
                        </div>

                        {/* Estado + cobro + prioridad */}
                        <div className="space-y-1">
                          {estadoBadge}
                          {cobroBadge && <div>{cobroBadge}</div>}
                          {['presupuesto','enviado'].includes(p.estado) && (
                            <div className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full', prio.bg, prio.text)}>
                              {p.prioridad === 'alta' ? <Flame size={9} /> : p.prioridad === 'media' ? <AlertTriangle size={9} /> : <CheckCircle size={9} />}
                              {prio.label}
                            </div>
                          )}
                        </div>

                        {/* Vence */}
                        <div>
                          {isRechazado && p.motivo_rechazo ? (
                            <span className="text-[10px] text-red-400 truncate block" title={p.motivo_rechazo}>{p.motivo_rechazo}</span>
                          ) : vc ? (
                            <span className={cn('text-[11px] font-semibold', vc.color)}>{vc.text}</span>
                          ) : (
                            <span className="text-[11px] text-gray-300">—</span>
                          )}
                          {p.dias_sin_respuesta !== undefined && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDias(p.dias_sin_respuesta)}</p>
                          )}
                        </div>

                        {/* Importe */}
                        <div className="text-right">
                          <p className="text-sm font-black text-gray-800 tabular-nums">{formatCurrency(p.precio_total)}</p>
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                          {p.cliente.telefono && (
                            <>
                              <button
                                onClick={() => enviarMensajeWa(p.cliente.id, `Hola ${p.cliente.nombre ?? ''}, te contactamos por el presupuesto ${p.numero}.`)}
                                disabled={enviandoWaIds.has(p.cliente.id)}
                                className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 disabled:opacity-60 flex items-center justify-center transition-colors" title="Enviar WhatsApp">
                                {enviandoWaIds.has(p.cliente.id)
                                  ? <span className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin inline-block" />
                                  : <MessageSquare size={13} className="text-green-600" />}
                              </button>
                              <a href={`tel:${p.cliente.telefono}`}
                                className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors"
                                title="Llamar">
                                <Phone size={13} className="text-blue-600" />
                              </a>
                            </>
                          )}
                          {p.cliente.email && (
                            <a href={`mailto:${p.cliente.email}`}
                              className="w-7 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 flex items-center justify-center transition-colors"
                              title="Email">
                              <Mail size={13} className="text-violet-600" />
                            </a>
                          )}
                          <button onClick={() => abrirDetalle(p)}
                            className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
                            <MoreVertical size={13} className="text-gray-400" />
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!loading && filtrado.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-xs text-gray-500">
                  Mostrando {(page - 1) * PER_PAGE + 1} a {Math.min(page * PER_PAGE, filtrado.length)} de {filtrado.length} presupuestos
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={14} className="text-gray-600" />
                  </button>
                  {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                    const n = i + 1;
                    return (
                      <button key={n} onClick={() => setPage(n)}
                        className={cn(
                          'w-7 h-7 rounded-lg text-xs font-medium transition-colors',
                          page === n ? 'bg-violet-600 text-white' : 'hover:bg-gray-100 text-gray-600'
                        )}>{n}</button>
                    );
                  })}
                  {totalPages > 5 && <span className="text-xs text-gray-400 px-1">...</span>}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={14} className="text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-full xl:w-64 xl:shrink-0 space-y-4">
          {/* En riesgo total */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-amber-600">
                <AlertTriangle size={14} />
                <span className="text-xs font-semibold">En riesgo total</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(s?.en_riesgo_total ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">En presupuestos sin cerrar</p>
            <button onClick={() => setTab('sin_respuesta')}
              className="w-full flex items-center justify-center gap-1.5 py-2 border border-amber-200 rounded-lg text-xs font-semibold text-amber-600 hover:bg-amber-50 transition-colors">
              Ver presupuestos en riesgo →
            </button>
          </div>

          {/* Seguimiento sugerido */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-700">Seguimiento sugerido hoy</span>
            </div>
            {seg.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin pendientes urgentes</p>
            ) : (
              <div className="space-y-3">
                {seg.map(p => (
                  <button key={p.id} onClick={() => abrirDetalle(p)}
                    className="w-full flex items-center gap-2.5 hover:bg-gray-50 rounded-lg p-1.5 transition-colors text-left">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', avatarColor(p.cliente))}>
                      {initials(p.cliente)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 truncate">{nombreCliente(p.cliente)}</p>
                      <p className="text-[10px] text-gray-500 truncate">{p.numero} · {formatCurrency(p.precio_total)}</p>
                      <p className="text-[10px] text-amber-500 font-medium">{fmtDias(p.dias_sin_respuesta)} sin respuesta</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {seg.length > 0 && (
              <button onClick={() => setTab('sin_respuesta')}
                className="mt-3 w-full text-center text-xs text-violet-600 hover:underline font-medium">
                Ver todos ({conteos.sinResp}) →
              </button>
            )}
          </div>

          {/* Probabilidad de cierre */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Probabilidad de cierre</p>
            <div className="flex items-center gap-3">
              <DonutChart segments={[
                { value: prob.alta,  color: '#10b981' },
                { value: prob.media, color: '#f59e0b' },
                { value: prob.baja,  color: '#ef4444' },
              ]} />
              <div className="space-y-1.5 flex-1">
                {[
                  { label: 'Alta',  val: prob.alta,  color: 'bg-emerald-500' },
                  { label: 'Media', val: prob.media, color: 'bg-amber-400' },
                  { label: 'Baja',  val: prob.baja,  color: 'bg-red-400' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', row.color)} />
                    <span className="text-xs text-gray-600 flex-1">{row.label}</span>
                    <span className="text-xs font-semibold text-gray-800">{row.val}</span>
                    <span className="text-[10px] text-gray-400">
                      ({probTotal > 0 ? Math.round(row.val / probTotal * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Acciones rápidas</p>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <MessageSquare size={13} className="text-green-600" />
                </div>
                <span className="text-xs text-gray-700 font-medium">WhatsApp masivo</span>
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                  <Mail size={13} className="text-violet-600" />
                </div>
                <span className="text-xs text-gray-700 font-medium">Enviar recordatorios</span>
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <FileText size={13} className="text-blue-600" />
                </div>
                <span className="text-xs text-gray-700 font-medium">Reporte de seguimiento</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCancelados(v => !v)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <XCircle size={13} className="text-red-600" />
                </div>
                <span className="text-xs text-gray-700 font-medium flex-1">Presupuestos cancelados</span>
                {cancelados.length > 0 && (
                  <span className="text-[10px] font-extrabold bg-red-400 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {cancelados.length}
                  </span>
                )}
                <ChevronRight size={12} className={cn('text-gray-400 transition-transform', showCancelados && 'rotate-90')} />
              </button>
            </div>
          </div>

          {/* Panel presupuestos cancelados */}
          {showCancelados && (
            <div className="bg-white rounded-xl border border-red-200 shadow-lg p-4">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">
                Cancelados
              </p>
              {cancelados.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin presupuestos cancelados</p>
              ) : (
                <div className="space-y-1.5">
                  {cancelados.map(p => (
                    <div
                      key={p.id}
                      onClick={() => abrirDetalle(p)}
                      className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 cursor-pointer hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono text-gray-400">{p.numero}</span>
                        <span className="text-[10px] font-bold text-gray-800 tabular-nums">{formatCurrency(p.precio_total)}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-800 truncate mt-0.5">{nombreCliente(p.cliente)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {detailId && (
        <PresupuestoModal
          id={detailId}
          onClose={() => { setDetailId(null); setDetailPanel(null); }}
          onEstadoChange={onEstadoChange}
          onRefresh={load}
          itemsEnPedido={detailPanel?.items_en_pedido}
          itemsTotal={detailPanel?.items_total}
        />
      )}
    </div>
  );
}
