import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, FileText, Send, CheckCircle, XCircle, RotateCcw,
  X, Pen, Printer, Share2, Copy, Check, Phone, Mail, User,
  CreditCard, Truck, MapPin, Gift, Building2, Package,
  ChevronLeft, ChevronRight, MoreVertical, TrendingUp, AlertTriangle,
  Clock, MessageSquare, List, LayoutGrid, Download, Flame,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { EstadoOperacion } from '@/types';

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
  motivo_rechazo: string | null;
  dias_vencido: number | null;
  dias_hasta_vencimiento: number | null;
  dias_sin_respuesta: number;
  ultimo_contacto_canal: string | null;
  prioridad: 'alta' | 'media' | 'baja';
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

interface OpDetalle {
  id: string; numero: string; tipo: string; estado: EstadoOperacion;
  cliente_id: string; tipo_proyecto: string | null; forma_pago: string | null;
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

const PER_PAGE = 10;

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
  presupuesto: 'Borrador',
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
  if (['cancelado', 'rechazado'].includes(p.estado)) return 'border-l-gray-300';
  if (p.estado === 'aprobado') return 'border-l-emerald-400';
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

// Referencia a la ventana de WhatsApp Web para reutilizar pestaña existente
let waWindow: Window | null = null;

// ── PresupuestoModal ──────────────────────────────────────────────────────────

function PresupuestoModal({
  id, onClose, onEstadoChange,
}: {
  id: string;
  onClose: () => void;
  onEstadoChange: (id: string, estado: EstadoOperacion) => void;
}) {
  const navigate = useNavigate();
  const [op, setOp] = useState<OpDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando]         = useState(false);
  const [linkUrl, setLinkUrl]             = useState<string | null>(null);
  const [generandoLink, setGenerandoLink] = useState(false);
  const [copiado, setCopiado]             = useState(false);

  useEffect(() => {
    setLoading(true); setError(null);
    api.get<OpDetalle>(`/operaciones/${id}`)
      .then(d => { setOp(d); setLoading(false); })
      .catch(err => { setError(err.message ?? 'Error al cargar'); setLoading(false); });
  }, [id]);

  async function generarLink() {
    setGenerandoLink(true);
    try {
      const { url } = await api.post<{ token: string; url: string }>(`/operaciones/${id}/generar-link`, {});
      setLinkUrl(url);
    } finally { setGenerandoLink(false); }
  }

  async function copiarLink() {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(linkUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function compartirWhatsApp() {
    if (!linkUrl || !op) return;
    const cl = op.cliente;
    const nombre = cl.tipo_persona === 'juridica' ? cl.razon_social : `${cl.nombre ?? ''} ${cl.apellido ?? ''}`.trim();
    const msg = encodeURIComponent(`Hola ${nombre}, te envío el presupuesto ${op.numero} para tu revisión y aprobación:\n${linkUrl}`);

    // Normalizar número solo al enviar: quitar no-dígitos, agregar código país 54 si falta
    const tel = cl.telefono ?? '';
    const digits = tel.replace(/\D/g, '');
    const phone = digits.startsWith('54') ? digits : digits ? `54${digits}` : '';

    const url = phone
      ? `https://web.whatsapp.com/send?phone=${phone}&text=${msg}`
      : `https://web.whatsapp.com/send?text=${msg}`;

    // Reutiliza pestaña existente si sigue abierta; abre nueva solo si fue cerrada
    if (waWindow && !waWindow.closed) {
      waWindow.location.href = url;
      waWindow.focus();
    } else {
      waWindow = window.open(url, 'whatsapp_web') ?? null;
    }
  }

  async function cambiarEstado(nuevoEstado: EstadoOperacion) {
    if (!op) return;
    setCambiando(true);
    await api.patch(`/operaciones/${id}/estado`, { estado: nuevoEstado });
    const updated = { ...op, estado: nuevoEstado };
    setOp(updated);
    onEstadoChange(id, nuevoEstado);
    setCambiando(false);
  }

  const esAprobado  = op?.estado === 'aprobado';
  const puedeEditar = op && !esAprobado;
  const subtotal    = op ? op.items.reduce((s, it) => s + Number(it.precio_total), 0) : 0;
  const costoEnvio  = op?.forma_envio === 'envio_empresa' ? Number(op.costo_envio ?? 0) : 0;
  const total       = subtotal + costoEnvio;
  const esCuotas    = op?.forma_pago === 'Tarjeta de crédito 3 cuotas sin interés';
  const fmtEnvio    = op?.forma_envio ? FORMA_ENVIO_LABEL[op.forma_envio] : null;
  const EnvioIcon   = fmtEnvio?.icon ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
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
                <button onClick={() => window.open(`/imprimir/presupuesto/${id}`, '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg font-medium transition-colors">
                  <Printer size={13} /> PDF
                </button>
                <button onClick={generarLink} disabled={generandoLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-medium transition-colors disabled:opacity-50">
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
          <div className="mx-5 mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-emerald-800">Link de aprobación generado</p>
            <div className="flex items-center gap-2">
              <input readOnly value={linkUrl}
                className="flex-1 text-xs bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-mono select-all"
                onClick={e => (e.target as HTMLInputElement).select()} />
              <button onClick={copiarLink}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors">
                {copiado ? <Check size={12} /> : <Copy size={12} />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <button onClick={compartirWhatsApp}
              className="w-full flex items-center justify-center gap-2 py-2 bg-[#25D366] hover:bg-[#1ebe5a] text-white rounded-lg text-xs font-semibold transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              Enviar por WhatsApp
            </button>
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

            {!esAprobado && (
              <div className="px-5 py-3 flex items-center gap-2 bg-gray-50 rounded-b-2xl">
                <span className="text-xs text-gray-400 mr-1">Cambiar estado:</span>
                {op.estado === 'presupuesto' && (
                  <button onClick={() => cambiarEstado('enviado')} disabled={cambiando}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium disabled:opacity-50">
                    <Send size={11} /> Enviar
                  </button>
                )}
                {op.estado === 'enviado' && (
                  <>
                    <button onClick={() => cambiarEstado('aprobado')} disabled={cambiando}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium disabled:opacity-50">
                      <CheckCircle size={11} /> Aprobar
                    </button>
                    <button onClick={() => cambiarEstado('rechazado')} disabled={cambiando}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium disabled:opacity-50">
                      <XCircle size={11} /> Rechazar
                    </button>
                  </>
                )}
                {op.estado === 'rechazado' && (
                  <button onClick={() => cambiarEstado('presupuesto')} disabled={cambiando}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium disabled:opacity-50">
                    <RotateCcw size={11} /> Revisar
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ordenRef.current && !ordenRef.current.contains(e.target as Node)) setOrdenOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const presupuestos = data?.presupuestos ?? [];

  const conteos = useMemo(() => {
    const sinResp  = presupuestos.filter(p => p.estado === 'enviado' && p.dias_sin_respuesta > 3).length;
    const porVence = presupuestos.filter(p => ['presupuesto','enviado'].includes(p.estado) && p.dias_hasta_vencimiento !== null && (p.dias_hasta_vencimiento ?? -1) >= 0 && (p.dias_hasta_vencimiento ?? -1) <= 7).length;
    const vencidos = presupuestos.filter(p => ['presupuesto','enviado'].includes(p.estado) && (p.dias_vencido ?? 0) > 0).length;
    const aprobados = presupuestos.filter(p => p.estado === 'aprobado').length;
    const perdidos  = presupuestos.filter(p => ['cancelado','rechazado'].includes(p.estado)).length;
    return { todos: presupuestos.length, sinResp, porVence, vencidos, aprobados, perdidos };
  }, [presupuestos]);

  const filtrado = useMemo(() => {
    let result = presupuestos;
    if (tab === 'sin_respuesta') result = result.filter(p => p.estado === 'enviado' && p.dias_sin_respuesta > 3);
    else if (tab === 'por_vencer') result = result.filter(p => ['presupuesto','enviado'].includes(p.estado) && p.dias_hasta_vencimiento !== null && (p.dias_hasta_vencimiento ?? -1) >= 0 && (p.dias_hasta_vencimiento ?? -1) <= 7);
    else if (tab === 'vencidos') result = result.filter(p => ['presupuesto','enviado'].includes(p.estado) && (p.dias_vencido ?? 0) > 0);
    else if (tab === 'aprobados') result = result.filter(p => p.estado === 'aprobado');
    else if (tab === 'perdidos') result = result.filter(p => ['cancelado','rechazado'].includes(p.estado));

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
    <div className="p-5 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <FileText size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Presupuestos</h1>
            <p className="text-sm text-gray-500">Gestión de cotizaciones</p>
          </div>
        </div>
        <Link to="/presupuestos/nuevo"
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all">
          <Plus size={16} /> Nuevo presupuesto
        </Link>
      </div>

      {/* KPI tiles */}
      {loading ? (
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
              <div className="h-6 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : s ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <FileText size={14} className="text-violet-600" />
              </div>
              <span className="text-xs text-gray-500">Total presupuestos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.total_activos}</p>
            <p className="text-xs text-gray-400 mt-0.5">Activos</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp size={14} className="text-emerald-600" />
              </div>
              <span className="text-xs text-gray-500">Importe total</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(s.importe_total)}</p>
            <p className="text-xs text-gray-400 mt-0.5">En presupuestos activos</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock size={14} className="text-amber-600" />
              </div>
              <span className="text-xs text-gray-500">Sin respuesta</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.sin_respuesta_count}</p>
            <p className="text-xs text-amber-600 mt-0.5 font-medium">{formatCurrency(s.sin_respuesta_monto)} en riesgo</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle size={14} className="text-red-500" />
              </div>
              <span className="text-xs text-gray-500">Vencidos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.vencidos_count}</p>
            <p className="text-xs text-red-500 mt-0.5 font-medium">{formatCurrency(s.vencidos_monto)} en riesgo</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <CheckCircle size={14} className="text-blue-600" />
              </div>
              <span className="text-xs text-gray-500">Tasa de cierre</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.tasa_cierre_pct}%</p>
            <p className="text-xs text-gray-400 mt-0.5">Últimos 30 días</p>
          </div>
        </div>
      ) : null}

      {/* Main area */}
      <div className="flex gap-4 items-start">
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5 border-b border-gray-100 bg-gray-50"
              style={{ gridTemplateColumns: '180px 1fr 160px 150px 120px 110px 100px' }}>
              <span>Presupuesto</span>
              <span>Cliente</span>
              <span>Estado / Prioridad</span>
              <span>Último contacto</span>
              <span>Vence</span>
              <span className="text-right">Importe</span>
              <span className="text-right">Acciones</span>
            </div>

            {loading ? (
              <div className="divide-y divide-gray-50">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="px-4 py-3 animate-pulse grid gap-4" style={{ gridTemplateColumns: '180px 1fr 160px 150px 120px 110px 100px' }}>
                    {[...Array(7)].map((_, j) => <div key={j} className="h-4 bg-gray-100 rounded" />)}
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
              <div className="divide-y divide-gray-50">
                {paginated.map(p => {
                  const vc     = fmtVencimiento(p);
                  const canal  = p.ultimo_contacto_canal;
                  const prio   = PRIO_CFG[p.prioridad];
                  const isAprobadoOnline = !!p.aprobado_online_at;
                  const isRechazado = p.estado === 'rechazado';

                  return (
                    <div key={p.id}
                      className={cn(
                        'grid items-center px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 group',
                        borderColor(p),
                        isAprobadoOnline && 'bg-emerald-50/50 hover:bg-emerald-50/70',
                        isRechazado && !isAprobadoOnline && 'bg-red-50/30 hover:bg-red-50/50'
                      )}
                      style={{ gridTemplateColumns: '180px 1fr 160px 150px 120px 110px 100px' }}
                      onClick={() => setDetailId(p.id)}>

                      {/* Presupuesto */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-gray-800 group-hover:text-violet-600 transition-colors">{p.numero}</span>
                          {isAprobadoOnline && <Check size={11} className="text-emerald-500" />}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(p.created_at)}</p>
                      </div>

                      {/* Cliente */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', avatarColor(p.cliente))}>
                          {initials(p.cliente)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{nombreCliente(p.cliente)}</p>
                          {p.cliente.telefono && <p className="text-[11px] text-gray-400 truncate">{p.cliente.telefono}</p>}
                        </div>
                      </div>

                      {/* Estado / Prioridad */}
                      <div className="space-y-1">
                        <span className={cn('inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold', ESTADO_COLOR[p.estado] ?? 'bg-gray-100 text-gray-700')}>
                          {ESTADO_LABEL[p.estado] ?? p.estado}
                        </span>
                        {['presupuesto','enviado'].includes(p.estado) && (
                          <div className={cn('flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit', prio.bg, prio.text)}>
                            {p.prioridad === 'alta' ? <Flame size={9} /> : p.prioridad === 'media' ? <AlertTriangle size={9} /> : <CheckCircle size={9} />}
                            {prio.label}
                          </div>
                        )}
                      </div>

                      {/* Último contacto */}
                      <div>
                        <p className="text-xs text-gray-700">{fmtDias(p.dias_sin_respuesta)}</p>
                        {canal && (
                          <p className={cn('text-[11px] font-medium mt-0.5', canalColor(canal))}>
                            {canalLabel(canal)}
                          </p>
                        )}
                      </div>

                      {/* Vence / Motivo rechazo */}
                      <div>
                        {isRechazado && p.motivo_rechazo ? (
                          <span className="text-[11px] text-red-500 leading-tight line-clamp-2" title={p.motivo_rechazo}>
                            {p.motivo_rechazo}
                          </span>
                        ) : vc ? (
                          <span className={cn('text-[11px]', vc.color)}>{vc.text}</span>
                        ) : (
                          <span className="text-[11px] text-gray-300">—</span>
                        )}
                      </div>

                      {/* Importe */}
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-800">{formatCurrency(p.precio_total)}</p>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {p.cliente.telefono && (
                          <>
                            <a href={whatsappUrl(p.cliente.telefono)} target="_blank" rel="noreferrer"
                              className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center transition-colors"
                              title="WhatsApp">
                              <MessageSquare size={13} className="text-green-600" />
                            </a>
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
                        <button onClick={() => setDetailId(p.id)}
                          className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
                          <MoreVertical size={13} className="text-gray-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!loading && filtrado.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
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
        <div className="w-72 shrink-0 space-y-4">
          {/* En riesgo total */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-700">Seguimiento sugerido hoy</span>
            </div>
            {seg.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin pendientes urgentes</p>
            ) : (
              <div className="space-y-3">
                {seg.map(p => (
                  <button key={p.id} onClick={() => setDetailId(p.id)}
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
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
            </div>
          </div>
        </div>
      </div>

      {detailId && (
        <PresupuestoModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onEstadoChange={onEstadoChange}
        />
      )}
    </div>
  );
}
