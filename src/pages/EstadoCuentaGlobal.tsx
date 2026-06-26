import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, AlertTriangle, Calendar, CreditCard, Banknote,
  ArrowUpDown, XCircle, CheckCheck, Trash2, Users,
  DollarSign, Phone, MessageSquare, Mail, MoreVertical,
  TrendingUp, TrendingDown, RefreshCw, Download, Plus,
  ExternalLink, Flame, BookOpen,
  FileText, Truck, ArrowDownLeft, ArrowUpRight, Check, Clock,
  ChevronDown, ChevronUp, Send, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SectionHero } from '@/components/SectionHero';
import { CompactStatsBar } from '@/components/CompactStatsBar';

// ── Types ────────────────────────────────────────────────────────────────────

type EstadoCobro = 'vencido' | 'por_vencer' | 'al_dia' | 'saldado';

interface ClienteResumen {
  id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  telefono: string | null;
  email: string | null;
  operaciones_count: number;
  pendientes_count: number;
  pendientes_monto: number;
  total_presupuestado: number;
  total_cobrado: number;
  saldo: number;
  compromisos_pendientes: number;
  proximo_vencimiento: string | null;
  compromisos_vencidos: number;
  dias_vencido_oldest: number;
  ultima_actividad: string | null;
  ultima_compra_fecha: string | null;
  dias_desde_primera_op: number | null;
  dias_desde_ultima_compra: number | null;
  pct_cobrado: number;
  estado_cobro: EstadoCobro;
}

interface Totales {
  presupuestado: number;
  cobrado: number;
  saldo: number;
  compromisos: number;
  clientes_con_saldo: number;
  compromisos_vencidos_count: number;
  total_clientes: number;
  vencidos_monto: number;
  por_vencer_monto: number;
  al_dia_monto: number;
  pct_cobrado: number;
  dias_promedio_atraso: number;
  tendencia_30d: number;
}

interface Compromiso {
  id: string;
  cliente_id: string;
  operacion_id: string | null;
  operacion: { id: string; numero: string } | null;
  tipo: 'cuota' | 'cheque' | 'efectivo_futuro' | 'transferencia';
  monto: number;
  fecha_vencimiento: string;
  descripcion: string | null;
  numero_cheque: string | null;
  banco: string | null;
  estado: 'pendiente' | 'cobrado' | 'rechazado' | 'vencido';
  notas: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nombreCliente(c: Pick<ClienteResumen, 'nombre' | 'apellido' | 'razon_social' | 'tipo_persona'>): string {
  if (c.tipo_persona === 'juridica' || c.razon_social) return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(' ') || '—';
}

function initials(c: ClienteResumen): string {
  const n = nombreCliente(c);
  const parts = n.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700', 'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700', 'bg-orange-100 text-orange-700',
];

function avatarColor(c: ClienteResumen): string {
  return AVATAR_COLORS[(nombreCliente(c).charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function segmento(c: ClienteResumen): { label: string; cls: string } | null {
  if (Number(c.compromisos_vencidos) > 0) return { label: 'Cliente irregular', cls: 'bg-red-50 text-red-600' };
  if (Number(c.operaciones_count) >= 4)    return { label: 'Cliente frecuente', cls: 'bg-emerald-50 text-emerald-700' };
  if ((c.dias_desde_primera_op ?? 999) <= 45) return { label: 'Cliente nuevo', cls: 'bg-blue-50 text-blue-600' };
  if ((c.dias_desde_ultima_compra ?? 999) >= 60) return { label: 'Cliente inactivo', cls: 'bg-gray-100 text-gray-500' };
  return { label: 'Cliente activo', cls: 'bg-violet-50 text-violet-600' };
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const s = d.split('T')[0].split('-');
  return `${s[2]}/${s[1]}/${s[0]}`;
}

// ── Types para modal de detalle ──────────────────────────────────────────────

interface ModalCliInfo {
  id: string; nombre: string | null; apellido: string | null; razon_social: string | null;
  tipo_persona: string; telefono: string | null; email: string | null;
  direccion: string | null; localidad: string | null; documento_nro: string | null;
}
interface ModalReciboR {
  id: string; numero: string; fecha: string; monto_total: number;
  forma_pago: string; concepto: string | null; estado: string; operacion_id: string | null;
}
interface ModalRemitoR {
  id: string; numero: string; fecha_emision: string; estado: string; operacion_id: string | null;
}
interface ModalCompPromise {
  id: string; tipo: string; monto: number; fecha_vencimiento: string;
  descripcion: string | null; numero_cheque: string | null; banco: string | null;
  estado: 'pendiente' | 'cobrado' | 'rechazado' | 'vencido';
  operacion: { id: string; numero: string } | null;
}
interface ModalOpDetalle {
  id: string; numero: string; tipo: string; estado: string;
  precio_total: number; created_at: string;
  items: Array<{
    id: string; descripcion: string; cantidad: number; precio_total: number;
    tipo_abertura: string | null; sistema: string | null;
    medida_ancho: number | null; medida_alto: number | null;
    color: string | null; incluye_instalacion: boolean;
  }>;
  recibos: ModalReciboR[]; remitos: ModalRemitoR[];
  cobrado: number | null; saldo: number | null; genera_saldo: boolean;
}
interface EstadoCuentaDetalleData {
  cliente: ModalCliInfo;
  operaciones: ModalOpDetalle[];
  recibos_directos: ModalReciboR[];
  compromisos: ModalCompPromise[];
  totales: { presupuestado: number; cobrado: number; saldo: number; pendiente_aprobacion: number };
}
interface MovimientoM { fecha: string; tipo: 'cargo' | 'abono'; numero: string; concepto: string; monto: number; saldo: number; }

function buildLedgerM(ops: ModalOpDetalle[], directos: ModalReciboR[]): MovimientoM[] {
  const APROBADOS = new Set(['aprobado','en_produccion','listo','instalado','entregado']);
  const entries: Omit<MovimientoM, 'saldo'>[] = [];
  for (const op of ops) {
    if (!APROBADOS.has(op.estado)) continue;
    entries.push({ fecha: op.created_at, tipo: 'cargo', numero: op.numero, concepto: op.numero, monto: Number(op.precio_total) });
    for (const r of op.recibos) entries.push({ fecha: r.fecha, tipo: 'abono', numero: r.numero, concepto: r.forma_pago + (r.concepto ? ` · ${r.concepto}` : ''), monto: Number(r.monto_total) });
  }
  for (const r of directos) entries.push({ fecha: r.fecha, tipo: 'abono', numero: r.numero, concepto: r.forma_pago + (r.concepto ? ` · ${r.concepto}` : ''), monto: Number(r.monto_total) });
  entries.sort((a, b) => a.fecha.localeCompare(b.fecha));
  let saldo = 0;
  return entries.map(e => { saldo = e.tipo === 'cargo' ? saldo + e.monto : saldo - e.monto; return { ...e, saldo }; });
}

function diasHasta(dateStr: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoy.getTime()) / 86400000);
}

function fmtDiasRelativo(dias: number | null): string {
  if (dias === null || dias >= 999) return 'Sin registro';
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return `Hace ${dias} días`;
}

function fmtVencimiento(c: ClienteResumen): { text: string; color: string } | null {
  if (c.estado_cobro === 'vencido') {
    const d = Number(c.dias_vencido_oldest ?? 0);
    return { text: `${d} día${d !== 1 ? 's' : ''}\nVencido`, color: 'text-red-600 font-bold' };
  }
  if (c.proximo_vencimiento) {
    const d = diasHasta(c.proximo_vencimiento);
    if (d === 0) return { text: 'Hoy', color: 'text-amber-600 font-semibold' };
    if (d > 0)   return { text: `En ${d} días`, color: d <= 3 ? 'text-amber-500' : 'text-gray-600' };
  }
  return null;
}

const ESTADO_COBRO_CFG: Record<EstadoCobro, { label: string; bg: string; text: string; border: string }> = {
  vencido:    { label: 'Vencido',    bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-l-red-500' },
  por_vencer: { label: 'Por vencer', bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-l-amber-400' },
  al_dia:     { label: 'Al día',     bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-l-emerald-400' },
  saldado:    { label: 'Saldado',    bg: 'bg-gray-100',    text: 'text-gray-500',    border: 'border-l-gray-200' },
};

const TIPO_ICON: Record<string, React.ElementType> = {
  cuota: Calendar, cheque: CreditCard,
  efectivo_futuro: Banknote, transferencia: ArrowUpDown,
};

const TIPO_LABEL: Record<string, string> = {
  cuota: 'Cuota', cheque: 'Cheque', efectivo_futuro: 'Efectivo futuro', transferencia: 'Transferencia',
};

// ── DonutChart ────────────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((s, g) => s + g.value, 0);
  const r = 38; const circ = 2 * Math.PI * r; const cx = 48; const cy = 48;
  let offset = 0;
  const paths = segments.map((seg, i) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * circ;
    const el = (
      <circle key={i} cx={cx} cy={cy} r={r} fill="none"
        stroke={seg.color} strokeWidth={16}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={-offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }} />
    );
    offset += dash;
    return el;
  });
  return (
    <svg width={96} height={96}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={16} />
      {paths}
    </svg>
  );
}

// ── ModalNuevoCompromiso ──────────────────────────────────────────────────────

function ModalNuevoCompromiso({
  clienteId, clienteNombre: cNombre, onClose, onCreated,
}: {
  clienteId: string;
  clienteNombre: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    tipo: 'cuota', monto: '', fecha_vencimiento: '',
    descripcion: '', numero_cheque: '', banco: '', notas: '',
  });
  const [saving, setSaving] = useState(false);

  function upd(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.monto || !form.fecha_vencimiento) { toast.error('Completá monto y fecha'); return; }
    setSaving(true);
    try {
      await api.post(`/estado-cuenta/${clienteId}/compromisos`, {
        tipo: form.tipo, monto: parseFloat(form.monto),
        fecha_vencimiento: form.fecha_vencimiento,
        descripcion: form.descripcion || null,
        numero_cheque: form.numero_cheque || null,
        banco: form.banco || null,
        notas: form.notas || null,
      });
      toast.success('Compromiso registrado');
      onCreated(); onClose();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-bold text-gray-800">Nuevo compromiso de pago</h3>
            <p className="text-xs text-gray-500 mt-0.5">{cNombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><XCircle size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(['cuota','cheque','efectivo_futuro','transferencia'] as const).map(t => {
                const Icon = TIPO_ICON[t];
                return (
                  <button key={t} type="button" onClick={() => upd('tipo', t)}
                    className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all',
                      form.tipo === t ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                    <Icon size={14} />{TIPO_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Monto *</label>
              <input type="number" step="0.01" min="0.01" required value={form.monto} onChange={e => upd('monto', e.target.value)}
                placeholder="0.00" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Vencimiento *</label>
              <input type="date" required value={form.fecha_vencimiento} onChange={e => upd('fecha_vencimiento', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
            <input type="text" value={form.descripcion} onChange={e => upd('descripcion', e.target.value)}
              placeholder={form.tipo === 'cuota' ? 'Ej: Cuota 2 de 6' : ''}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          {form.tipo === 'cheque' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">N° Cheque</label>
                <input type="text" value={form.numero_cheque} onChange={e => upd('numero_cheque', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Banco</label>
                <input type="text" value={form.banco} onChange={e => upd('banco', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm disabled:opacity-60">
              {saving ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ExpandedRow ───────────────────────────────────────────────────────────────

function ExpandedRow({ cliente, onNuevoCompromiso, onRefresh }: {
  cliente: ClienteResumen;
  onNuevoCompromiso: (id: string, nombre: string) => void;
  onRefresh: () => void;
}) {
  const [compromisos, setCompromisos] = useState<Compromiso[]>([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    api.get<Compromiso[]>(`/estado-cuenta/${cliente.id}/compromisos`)
      .then(d => setCompromisos(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cliente.id]);

  async function cambiarEstado(id: string, estado: string) {
    try {
      await api.patch(`/estado-cuenta/compromisos/${id}`, { estado });
      setCompromisos(prev => prev.map(c => c.id === id ? { ...c, estado: estado as Compromiso['estado'] } : c));
      onRefresh();
      toast.success(`Marcado como ${estado}`);
    } catch { toast.error('Error al actualizar'); }
  }

  async function eliminar(id: string) {
    try {
      await api.delete(`/estado-cuenta/compromisos/${id}`);
      setCompromisos(prev => prev.filter(c => c.id !== id));
      onRefresh();
      toast.success('Eliminado');
    } catch { toast.error('Error al eliminar'); }
  }

  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Compromisos de pago</span>
        <button onClick={() => onNuevoCompromiso(cliente.id, nombreCliente(cliente))}
          className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-semibold">
          <Plus size={11} /> Nuevo
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400 py-1">Cargando...</p>
      ) : compromisos.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Sin compromisos</p>
      ) : (
        <div className="space-y-1.5">
          {compromisos.map(comp => {
            const Icon = TIPO_ICON[comp.tipo] ?? Calendar;
            const dias = comp.estado === 'pendiente' ? diasHasta(comp.fecha_vencimiento) : null;
            const vencido = dias !== null && dias < 0;
            return (
              <div key={comp.id} className={cn(
                'flex items-center gap-2.5 bg-white rounded-lg px-3 py-2 border',
                vencido ? 'border-red-200' : 'border-gray-200'
              )}>
                <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0',
                  comp.estado === 'cobrado' ? 'bg-emerald-100' : comp.estado === 'rechazado' ? 'bg-red-100' : 'bg-blue-100')}>
                  <Icon size={12} className={comp.estado === 'cobrado' ? 'text-emerald-600' : comp.estado === 'rechazado' ? 'text-red-500' : 'text-blue-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800">{formatCurrency(Number(comp.monto))}</span>
                    {comp.descripcion && <span className="text-[11px] text-gray-500">{comp.descripcion}</span>}
                    {comp.numero_cheque && <span className="text-[11px] text-gray-400">#{comp.numero_cheque}{comp.banco ? ` · ${comp.banco}` : ''}</span>}
                  </div>
                  <p className="text-[11px] text-gray-400">{formatDate(comp.fecha_vencimiento)}{comp.operacion ? ` · Op. ${comp.operacion.numero}` : ''}</p>
                </div>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0',
                  comp.estado === 'cobrado' ? 'bg-emerald-100 text-emerald-700' :
                  comp.estado === 'rechazado' ? 'bg-red-100 text-red-700' :
                  vencido ? 'bg-red-200 text-red-800' : 'bg-amber-100 text-amber-700')}>
                  {comp.estado === 'cobrado' ? 'Cobrado' : comp.estado === 'rechazado' ? 'Rechazado' : vencido ? 'VENCIDO' : 'Pendiente'}
                </span>
                {comp.estado === 'pendiente' && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => cambiarEstado(comp.id, 'cobrado')} title="Cobrado"
                      className="p-1 rounded hover:bg-emerald-100 text-gray-400 hover:text-emerald-600 transition-colors">
                      <CheckCheck size={13} />
                    </button>
                    <button onClick={() => cambiarEstado(comp.id, 'rechazado')} title="Rechazado"
                      className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors">
                      <XCircle size={13} />
                    </button>
                    <button onClick={() => eliminar(comp.id)} title="Eliminar"
                      className="p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Modal Estado de Cuenta ────────────────────────────────────────────────────

const ESTADO_OP_COLOR_M: Record<string, string> = {
  presupuesto: 'bg-gray-100 text-gray-700', enviado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700', rechazado: 'bg-red-100 text-red-700',
  en_produccion: 'bg-amber-100 text-amber-700', listo: 'bg-teal-100 text-teal-700',
  instalado: 'bg-purple-100 text-purple-700', entregado: 'bg-indigo-100 text-indigo-700',
};
const ESTADO_OP_LABEL_M: Record<string, string> = {
  presupuesto: 'Presupuesto', enviado: 'Enviado', aprobado: 'Aprobado',
  rechazado: 'Rechazado', en_produccion: 'En producción', listo: 'Listo',
  instalado: 'Instalado', entregado: 'Entregado',
};
const COMP_TIPO_M: Record<string, string> = {
  cuota: 'Cuota', cheque: 'Cheque', efectivo_futuro: 'Efectivo futuro', transferencia: 'Transferencia',
};
const COMP_ESTADO_COLOR_M: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700', cobrado: 'bg-emerald-100 text-emerald-700',
  rechazado: 'bg-red-100 text-red-700', vencido: 'bg-red-200 text-red-800',
};

function isVencidoM(fecha: string) { return new Date(fecha.slice(0,10) + 'T12:00:00') < new Date(new Date().toDateString()); }

function OpCardM({ op }: { op: ModalOpDetalle }) {
  const [open, setOpen] = useState(false);
  const cobrado = Number(op.cobrado ?? 0);
  const saldo = op.saldo !== null ? Number(op.saldo) : null;
  const saldada = saldo !== null && saldo <= 0.01;
  const pct = op.genera_saldo && op.precio_total ? Math.min(100, Math.round((cobrado / Number(op.precio_total)) * 100)) : 0;
  return (
    <div className={cn('rounded-xl border overflow-hidden', op.genera_saldo ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-75')}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">
        <FileText size={13} className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{op.numero}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', ESTADO_OP_COLOR_M[op.estado])}>{ESTADO_OP_LABEL_M[op.estado] ?? op.estado}</span>
            <span className="text-xs text-gray-400">{formatDate(op.created_at)}</span>
          </div>
          {op.genera_saldo && (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', saldada ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200')} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-gray-500">{pct}%</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className="text-sm font-bold text-gray-800 font-mono">{formatCurrency(Number(op.precio_total))}</p>
          {op.genera_saldo && !saldada && saldo !== null && <p className="text-[10px] text-amber-600 font-medium">Saldo: {formatCurrency(saldo)}</p>}
          {op.genera_saldo && saldada && <p className="text-[10px] text-emerald-600 flex items-center gap-0.5 justify-end"><Check size={9} /> Saldado</p>}
        </div>
        {open ? <ChevronUp size={12} className="text-gray-400 shrink-0" /> : <ChevronDown size={12} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-gray-200 px-3 py-2.5 space-y-2">
          {op.items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Ítems</p>
              <div className="space-y-1">
                {op.items.map((item, i) => (
                  <div key={item.id ?? i} className="flex justify-between text-xs">
                    <span className="text-gray-700">{item.tipo_abertura ?? item.descripcion}{item.cantidad > 1 ? ` ×${item.cantidad}` : ''}</span>
                    <span className="font-mono font-semibold text-gray-800">{formatCurrency(Number(item.precio_total))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {op.remitos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {op.remitos.map(rm => (
                <div key={rm.id} className="flex items-center gap-1 bg-blue-50 rounded px-2 py-1 text-xs">
                  <Truck size={10} className="text-blue-500" />
                  <span className="font-semibold text-blue-800">{rm.numero}</span>
                  <span className="text-gray-500">{ESTADO_OP_LABEL_M[rm.estado] ?? rm.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModalDetalleEstadoCuenta({ clienteId, onClose }: { clienteId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [data, setData] = useState<EstadoCuentaDetalleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get<EstadoCuentaDetalleData>(`/clientes/${clienteId}/estado-cuenta`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clienteId]);

  async function enviarWhatsApp() {
    setEnviando(true);
    try {
      await api.post(`/clientes/${clienteId}/enviar-estado-cuenta-whatsapp`, {});
      toast.success('Estado de cuenta enviado por WhatsApp');
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al enviar por WhatsApp');
    } finally {
      setEnviando(false);
    }
  }

  const ledger = data ? buildLedgerM(data.operaciones, data.recibos_directos) : [];
  const saldo = data?.totales.saldo ?? 0;
  const saldado = Math.abs(saldo) <= 0.01;
  const compPendientes = data?.compromisos.filter(c => c.estado === 'pendiente') ?? [];
  const compVencidos = compPendientes.filter(c => isVencidoM(c.fecha_vencimiento));
  const totalCompromisos = compPendientes.reduce((s, c) => s + Number(c.monto), 0);
  const compFuturos = compPendientes.filter(c => !isVencidoM(c.fecha_vencimiento));

  const nombre = data
    ? (data.cliente.tipo_persona === 'juridica'
        ? (data.cliente.razon_social ?? '—')
        : [data.cliente.apellido, data.cliente.nombre].filter(Boolean).join(', ') || '—')
    : '…';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Estado de Cuenta</p>
            <h3 className="font-bold text-gray-800 truncate">{nombre}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {data?.cliente.telefono && (
              <button onClick={enviarWhatsApp} disabled={enviando}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-60">
                <Send size={12} />
                {enviando ? 'Enviando...' : 'WhatsApp PDF'}
              </button>
            )}
            <button onClick={() => navigate(`/clientes/${clienteId}/estado-cuenta`)}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" title="Ver página completa">
              <ExternalLink size={14} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-20 bg-gray-100 rounded-xl" />
              <div className="h-40 bg-gray-100 rounded-xl" />
            </div>
          )}
          {!loading && !data && (
            <p className="text-center text-gray-400 py-8">Error al cargar datos</p>
          )}
          {!loading && data && (
            <>
              {/* Resumen financiero */}
              <div className={cn('rounded-xl border-2 p-4', saldado ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total facturado</p>
                    <p className="text-base font-bold text-gray-800 font-mono">{formatCurrency(data.totales.presupuestado)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total cobrado</p>
                    <p className="text-base font-bold text-emerald-700 font-mono">{formatCurrency(data.totales.cobrado)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Saldo</p>
                    <p className={cn('text-base font-bold font-mono', saldado ? 'text-emerald-600' : 'text-amber-600')}>
                      {formatCurrency(Math.max(0, saldo))}
                    </p>
                    <p className={cn('text-[10px] mt-0.5', saldado ? 'text-emerald-600' : 'text-amber-600')}>
                      {saldado ? '✓ Sin deuda' : 'Pendiente de cobro'}
                    </p>
                  </div>
                </div>
                {totalCompromisos > 0 && (
                  <div className={cn('mt-3 pt-3 border-t flex items-center gap-2 text-xs', compVencidos.length > 0 ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-700')}>
                    <Calendar size={11} className="shrink-0" />
                    <span className="font-medium">
                      {compVencidos.length > 0 ? `${compVencidos.length} vencido${compVencidos.length !== 1 ? 's' : ''} — ` : ''}
                      {formatCurrency(totalCompromisos)} comprometido
                      {compFuturos.length > 0 ? ` (próximo: ${formatDate(compFuturos[0].fecha_vencimiento)})` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Ledger */}
              {ledger.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cuenta corriente</p>
                    <p className="text-xs text-gray-400">{ledger.length} movimientos</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left py-2 px-3 font-semibold text-gray-500 w-20">Fecha</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-500 w-24">Comprob.</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-500">Concepto</th>
                          <th className="text-right py-2 px-2 font-semibold text-gray-500 w-24">Cargo</th>
                          <th className="text-right py-2 px-2 font-semibold text-gray-500 w-24">Abono</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-500 w-24">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ledger.map((mov, i) => (
                          <tr key={i} className={cn('hover:bg-gray-50', mov.tipo === 'abono' && 'bg-emerald-50/30')}>
                            <td className="py-2 px-3 text-gray-500">{formatDate(mov.fecha)}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1">
                                {mov.tipo === 'cargo'
                                  ? <ArrowUpRight size={11} className="text-amber-500 shrink-0" />
                                  : <ArrowDownLeft size={11} className="text-emerald-500 shrink-0" />}
                                <span className={cn('font-semibold', mov.tipo === 'cargo' ? 'text-gray-700' : 'text-emerald-700')}>{mov.numero}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-gray-600 max-w-[100px] truncate">{mov.concepto}</td>
                            <td className="py-2 px-2 text-right font-mono">
                              {mov.tipo === 'cargo' ? <span className="font-semibold text-gray-800">{formatCurrency(mov.monto)}</span> : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              {mov.tipo === 'abono' ? <span className="font-semibold text-emerald-700">{formatCurrency(mov.monto)}</span> : <span className="text-gray-300">—</span>}
                            </td>
                            <td className={cn('py-2 px-3 text-right font-mono font-bold', mov.saldo <= 0.01 ? 'text-emerald-600' : 'text-gray-800')}>
                              {formatCurrency(Math.max(0, mov.saldo))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                          <td colSpan={3} className="py-2 px-3 text-xs font-semibold text-gray-500">SALDO ACTUAL</td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-gray-700">{formatCurrency(data.totales.presupuestado)}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">{formatCurrency(data.totales.cobrado)}</td>
                          <td className={cn('py-2 px-3 text-right font-mono font-bold text-sm', saldado ? 'text-emerald-600' : 'text-amber-600')}>
                            {formatCurrency(Math.max(0, saldo))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Compromisos */}
              {data.compromisos.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Compromisos de pago</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {data.compromisos.map(comp => {
                      const vencido = comp.estado === 'pendiente' && isVencidoM(comp.fecha_vencimiento);
                      return (
                        <div key={comp.id} className={cn('flex items-center gap-3 px-4 py-2.5', vencido && 'bg-red-50')}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-gray-800">{COMP_TIPO_M[comp.tipo] ?? comp.tipo}</span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', COMP_ESTADO_COLOR_M[comp.estado])}>
                                {comp.estado === 'vencido' || vencido ? 'VENCIDO' : comp.estado}
                              </span>
                              {comp.operacion && <span className="text-[10px] text-gray-400">{comp.operacion.numero}</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                              <span>{formatDate(comp.fecha_vencimiento)}</span>
                              {comp.descripcion && <span>{comp.descripcion}</span>}
                              {comp.banco && <span>{comp.banco}</span>}
                              {comp.numero_cheque && <span>Ch. {comp.numero_cheque}</span>}
                            </div>
                          </div>
                          <p className={cn('text-sm font-bold font-mono shrink-0', comp.estado === 'cobrado' ? 'text-emerald-600' : vencido ? 'text-red-600' : 'text-gray-800')}>
                            {formatCurrency(Number(comp.monto))}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {compPendientes.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {compPendientes.length} pendiente{compPendientes.length !== 1 ? 's' : ''}
                        {compVencidos.length > 0 && <span className="ml-2 text-red-600 font-semibold">({compVencidos.length} vencido{compVencidos.length !== 1 ? 's' : ''})</span>}
                      </span>
                      <span className="text-xs font-bold text-gray-700 font-mono">{formatCurrency(totalCompromisos)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Detalle por operación */}
              {data.operaciones.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Detalle por operación</p>
                  <div className="space-y-2">
                    {data.operaciones.map(op => <OpCardM key={op.id} op={op} />)}
                  </div>
                </div>
              )}

              {ledger.length === 0 && data.compromisos.length === 0 && (
                <div className="text-center py-10">
                  <Clock size={24} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Sin movimientos financieros todavía.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type FiltroRapido = 'todos' | 'vencidos' | 'hoy' | 'semana' | 'sin_vencer';
type OrdenLocal = 'prioridad' | 'mayor_deuda' | 'dias_vencido' | 'vencimiento' | 'actividad' | 'nombre';

export function EstadoCuentaGlobal() {
  const navigate = useNavigate();
  const [clientes, setClientes]             = useState<ClienteResumen[]>([]);
  const [totales,  setTotales]              = useState<Totales | null>(null);
  const [cobros,   setCobros]               = useState<ClienteResumen[]>([]);
  const [loading,  setLoading]              = useState(true);
  const [busqueda, setBusqueda]             = useState('');
  const [filtroRapido, setFiltroRapido]     = useState<FiltroRapido>('todos');
  const [ordenLocal,   setOrdenLocal]       = useState<OrdenLocal>('prioridad');
  const [expandedId,   setExpandedId]       = useState<string | null>(null);
  const [modal, setModal]                   = useState<{ clienteId: string; nombre: string } | null>(null);
  const [detalleClienteId, setDetalleClienteId] = useState<string | null>(null);
  const [enviandoWaIds, setEnviandoWaIds] = useState<Set<string>>(new Set());

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ clientes: ClienteResumen[]; totales: Totales; cobros_prioritarios: ClienteResumen[] }>(
        '/estado-cuenta'
      );
      setClientes(d.clientes);
      setTotales(d.totales);
      setCobros(d.cobros_prioritarios);
    } catch { toast.error('Error al cargar estado de cuenta'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrado = useMemo(() => {
    let result = clientes;

    if (filtroRapido === 'vencidos')    result = result.filter(c => c.estado_cobro === 'vencido');
    else if (filtroRapido === 'hoy')    result = result.filter(c => c.proximo_vencimiento && diasHasta(c.proximo_vencimiento) === 0);
    else if (filtroRapido === 'semana') result = result.filter(c => c.proximo_vencimiento && diasHasta(c.proximo_vencimiento) >= 0 && diasHasta(c.proximo_vencimiento) <= 7);
    else if (filtroRapido === 'sin_vencer') result = result.filter(c => ['al_dia','saldado'].includes(c.estado_cobro));

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      result = result.filter(c =>
        nombreCliente(c).toLowerCase().includes(q) ||
        (c.telefono ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      );
    }

    const PRIO_ORD: Record<EstadoCobro, number> = { vencido: 0, por_vencer: 1, al_dia: 2, saldado: 3 };
    if (ordenLocal === 'prioridad')     result = [...result].sort((a, b) => PRIO_ORD[a.estado_cobro] - PRIO_ORD[b.estado_cobro] || Number(b.saldo) - Number(a.saldo));
    else if (ordenLocal === 'mayor_deuda')  result = [...result].sort((a, b) => Number(b.saldo) - Number(a.saldo));
    else if (ordenLocal === 'dias_vencido') result = [...result].sort((a, b) => Number(b.dias_vencido_oldest) - Number(a.dias_vencido_oldest));
    else if (ordenLocal === 'vencimiento')  result = [...result].sort((a, b) => {
      const da = a.proximo_vencimiento ? new Date(a.proximo_vencimiento).getTime() : 9e15;
      const db = b.proximo_vencimiento ? new Date(b.proximo_vencimiento).getTime() : 9e15;
      return da - db;
    });
    else if (ordenLocal === 'actividad') result = [...result].sort((a, b) => (Number(a.dias_desde_ultima_compra) ?? 999) - (Number(b.dias_desde_ultima_compra) ?? 999));
    else result = [...result].sort((a, b) => nombreCliente(a).localeCompare(nombreCliente(b)));

    return result;
  }, [clientes, filtroRapido, busqueda, ordenLocal]);

  const t = totales;

  const ORDENES: { value: OrdenLocal; label: string }[] = [
    { value: 'prioridad',   label: 'Prioridad' },
    { value: 'mayor_deuda', label: 'Mayor deuda' },
    { value: 'dias_vencido', label: 'Más días vencido' },
    { value: 'vencimiento', label: 'Vencimiento' },
    { value: 'actividad',   label: 'Actividad' },
    { value: 'nombre',      label: 'Nombre' },
  ];

  const FILTROS_RAPIDOS: { value: FiltroRapido; label: string; dot?: string }[] = [
    { value: 'vencidos',   label: 'Vencidos',     dot: 'bg-red-500' },
    { value: 'hoy',        label: 'Vence hoy',    dot: 'bg-amber-500' },
    { value: 'semana',     label: 'Esta semana',  dot: 'bg-amber-300' },
    { value: 'sin_vencer', label: 'Sin vencer',   dot: 'bg-emerald-500' },
  ];

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-[1340px] mx-auto page-enter space-y-4" data-section="estado">
      <SectionHero
        section="estado"
        icon={BookOpen}
        title="Estado de Cuenta"
        sub="Control de saldos y gestión de cobranzas"
        actions={<>
          <button onClick={load} className="p-2 hover:bg-white/70 rounded-lg transition-colors">
            <RefreshCw size={15} className="text-gray-500" />
          </button>
          <button onClick={() => navigate('/recibos/nuevo')}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md transition-colors">
            <Plus size={15} /> Nuevo cobro
          </button>
        </>}
      />

      {t && (
        <CompactStatsBar items={[
          { value: formatCurrency(t.saldo),        label: 'saldo total a cobrar',  color: '#f87171' },
          { value: formatCurrency(t.cobrado),       label: 'cobrado',               color: '#34d399' },
          { value: formatCurrency(t.vencidos_monto),label: 'vencido',               color: '#fbbf24' },
          { value: formatCurrency(t.compromisos),   label: 'comprometido',          color: '#818cf8' },
          { value: `${t.clientes_con_saldo}`,       label: `de ${t.total_clientes} clientes`, color: '#ffffff' },
        ]} />
      )}

      {/* Cobros prioritarios */}
      {!loading && cobros.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-300 shadow-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={15} className="text-red-500" />
            <span className="text-sm font-bold text-gray-800">Cobros prioritarios del día</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold">{cobros.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {cobros.map((c, i) => {
              const vc = fmtVencimiento(c);
              const esVencido = c.estado_cobro === 'vencido';
              return (
                <div key={c.id} className={cn(
                  'rounded-xl border p-3 flex flex-col gap-2',
                  esVencido ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
                        esVencido ? 'bg-red-500' : 'bg-amber-500'
                      )}>{i + 1}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-800 leading-tight">{nombreCliente(c)}</p>
                        {vc && (
                          <p className={cn('text-[10px] font-semibold', esVencido ? 'text-red-500' : 'text-amber-600')}>
                            {vc.text.replace('\n', ' ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-lg font-bold text-gray-900 shrink-0">{formatCurrency(Number(c.saldo))}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setModal({ clienteId: c.id, nombre: nombreCliente(c) })}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors',
                        esVencido ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
                      )}>
                      Cobrar ahora
                    </button>
                    {c.telefono && (
                      <button
                        onClick={(e) => { e.stopPropagation(); enviarMensajeWa(c.id, `Hola ${nombreCliente(c)}, te recordamos el saldo pendiente de ${formatCurrency(Number(c.saldo))}.`); }}
                        disabled={enviandoWaIds.has(c.id)}
                        className="w-8 h-8 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-60 flex items-center justify-center transition-colors">
                        {enviandoWaIds.has(c.id)
                          ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                          : <MessageSquare size={14} className="text-white" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente por nombre, teléfono, DNI/CUIT..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium">Filtros rápidos:</span>
          {FILTROS_RAPIDOS.map(f => (
            <button key={f.value} onClick={() => setFiltroRapido(filtroRapido === f.value ? 'todos' : f.value)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
                filtroRapido === f.value
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}>
              {f.dot && <span className={cn('w-1.5 h-1.5 rounded-full', f.dot)} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ordenar por */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Ordenar por</span>
        {ORDENES.map(o => (
          <button key={o.value} onClick={() => setOrdenLocal(o.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
              ordenLocal === o.value
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
            )}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex gap-4 items-start">
        {/* Table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
          <div className="min-w-[997px]">
            {/* Table header */}
            <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-wider gap-x-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50"
              style={{ gridTemplateColumns: '220px 108px 108px 117px 96px 90px 85px 85px' }}>
              <span className="whitespace-nowrap">Cliente</span>
              <span className="whitespace-nowrap">Última compra</span>
              <span className="text-right whitespace-nowrap">Total comprado</span>
              <span className="text-right whitespace-nowrap">Cobrado</span>
              <span className="text-right whitespace-nowrap">Saldo</span>
              <span className="whitespace-nowrap">Estado</span>
              <span className="whitespace-nowrap">Días vencido</span>
              <span className="text-right whitespace-nowrap">Acciones</span>
            </div>

            {loading ? (
              <div className="divide-y divide-gray-50">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="px-4 py-3 animate-pulse flex gap-4">
                    <div className="w-8 h-8 bg-gray-100 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                      <div className="h-2 bg-gray-100 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtrado.length === 0 ? (
              <div className="py-16 text-center">
                <Users size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Sin clientes con actividad</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtrado.map(c => {
                  const cfg = ESTADO_COBRO_CFG[c.estado_cobro];
                  const seg = segmento(c);
                  const vc  = fmtVencimiento(c);
                  const isExpanded = expandedId === c.id;

                  return (
                    <div key={c.id}>
                      <div
                        className={cn(
                          'grid items-center gap-x-2 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 group',
                          cfg.border
                        )}
                        style={{ gridTemplateColumns: '220px 108px 108px 117px 96px 90px 85px 85px' }}
                        onClick={() => setDetalleClienteId(c.id)}
                      >
                        {/* Cliente */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', avatarColor(c))}>
                            {initials(c)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{nombreCliente(c)}</p>
                            {c.telefono && <p className="text-[11px] text-gray-400">{c.telefono}</p>}
                            {seg && (
                              <span className={cn('inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5', seg.cls)}>{seg.label}</span>
                            )}
                          </div>
                        </div>

                        {/* Última compra */}
                        <div>
                          <p className="text-xs text-gray-700">{formatDate(c.ultima_compra_fecha)}</p>
                          <p className="text-[11px] text-gray-400">{fmtDiasRelativo(c.dias_desde_ultima_compra ?? null)}</p>
                          <p className="text-[11px] text-gray-400">{c.operaciones_count} compra{c.operaciones_count !== 1 ? 's' : ''}</p>
                        </div>

                        {/* Total comprado */}
                        <div className="text-right">
                          <p className="text-xs font-semibold text-gray-700">{formatCurrency(Number(c.total_presupuestado))}</p>
                        </div>

                        {/* Cobrado */}
                        <div className="text-right">
                          <p className="text-xs font-semibold text-gray-700">{formatCurrency(Number(c.total_cobrado))}</p>
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full', c.pct_cobrado >= 100 ? 'bg-emerald-500' : c.pct_cobrado > 50 ? 'bg-blue-500' : 'bg-amber-400')}
                                style={{ width: `${c.pct_cobrado}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-400">{c.pct_cobrado}%</span>
                          </div>
                        </div>

                        {/* Saldo */}
                        <div className="text-right">
                          <p className={cn('text-sm font-bold',
                            Number(c.saldo) <= 0.01 ? 'text-emerald-600' :
                            Number(c.saldo) > 100000 ? 'text-red-600' : 'text-amber-600')}>
                            {formatCurrency(Number(c.saldo))}
                          </p>
                        </div>

                        {/* Estado */}
                        <div>
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', cfg.bg, cfg.text)}>
                            {c.estado_cobro === 'por_vencer' && c.proximo_vencimiento && diasHasta(c.proximo_vencimiento) === 0
                              ? 'Vence hoy'
                              : c.estado_cobro === 'por_vencer' && c.proximo_vencimiento
                              ? `En ${diasHasta(c.proximo_vencimiento)} días`
                              : cfg.label}
                          </span>
                        </div>

                        {/* Días vencido */}
                        <div>
                          {c.estado_cobro === 'vencido' ? (
                            <div>
                              <p className="text-xs font-bold text-red-600">{c.dias_vencido_oldest} días</p>
                              <p className="text-[10px] text-red-400">Vencido</p>
                            </div>
                          ) : c.estado_cobro === 'por_vencer' && c.proximo_vencimiento ? (
                            <div>
                              <p className={cn('text-xs font-semibold', diasHasta(c.proximo_vencimiento) === 0 ? 'text-amber-600' : 'text-amber-500')}>
                                {diasHasta(c.proximo_vencimiento) === 0 ? 'Hoy' : `En ${diasHasta(c.proximo_vencimiento)} días`}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
                          {c.telefono && (
                            <>
                              <button
                                onClick={() => enviarMensajeWa(c.id, `Hola ${nombreCliente(c)}, te contactamos por el saldo pendiente de ${formatCurrency(Number(c.saldo))}.`)}
                                disabled={enviandoWaIds.has(c.id)}
                                className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 disabled:opacity-60 flex items-center justify-center transition-colors" title="Enviar WhatsApp">
                                {enviandoWaIds.has(c.id)
                                  ? <span className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin inline-block" />
                                  : <MessageSquare size={12} className="text-green-600" />}
                              </button>
                              <a href={`tel:${c.telefono}`}
                                className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors" title="Llamar">
                                <Phone size={12} className="text-blue-600" />
                              </a>
                            </>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`}
                              className="w-7 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 flex items-center justify-center transition-colors" title="Email">
                              <Mail size={12} className="text-violet-600" />
                            </a>
                          )}
                          <button onClick={() => setDetalleClienteId(c.id)}
                            className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors" title="Ver estado de cuenta">
                            <BookOpen size={12} className="text-gray-400" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded compromisos */}
                      {isExpanded && (
                        <ExpandedRow
                          cliente={c}
                          onNuevoCompromiso={(id, n) => setModal({ clienteId: id, nombre: n })}
                          onRefresh={load}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer totales */}
            {!loading && t && filtrado.length > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <div className="grid text-xs gap-x-2" style={{ gridTemplateColumns: '220px 108px 108px 117px 96px 90px 85px 85px' }}>
                  <span className="text-gray-500">Mostrando {filtrado.length} de {clientes.length} clientes</span>
                  <span />
                  <span className="text-right font-bold text-gray-700">{formatCurrency(t.presupuestado)}</span>
                  <span className="text-right font-bold text-emerald-600">{formatCurrency(t.cobrado)}</span>
                  <span className="text-right font-bold text-red-600">{formatCurrency(t.saldo)}</span>
                  <span />
                  <span className="font-bold text-blue-600">{formatCurrency(t.compromisos)}</span>
                  <span />
                </div>
              </div>
            )}
          </div>
          </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0 space-y-4">
          {/* Resumen de saldos */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Resumen de saldos</p>
            {t && (
              <div className="flex items-center gap-3">
                <DonutChart segments={[
                  { value: t.vencidos_monto,    color: '#ef4444' },
                  { value: t.por_vencer_monto,  color: '#f59e0b' },
                  { value: t.al_dia_monto,      color: '#10b981' },
                ]} />
                <div className="space-y-2 flex-1">
                  {[
                    { label: 'Vencidos',    val: t.vencidos_monto,   color: 'bg-red-500' },
                    { label: 'Por vencer',  val: t.por_vencer_monto, color: 'bg-amber-400' },
                    { label: 'Al día',      val: t.al_dia_monto,     color: 'bg-emerald-500' },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', row.color)} />
                        <span className="text-[11px] text-gray-600 flex-1">{row.label}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 ml-3.5">{formatCurrency(row.val)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Análisis de cobranzas */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Análisis de cobranzas</p>
            {t && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">% de deuda vencida</span>
                  <span className="text-xs font-bold text-red-600">
                    {t.saldo > 0 ? Math.round(t.vencidos_monto / t.saldo * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Promedio días de atraso</span>
                  <span className="text-xs font-bold text-gray-800">{t.dias_promedio_atraso} días</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Clientes con deuda</span>
                  <span className="text-xs font-bold text-gray-800">{t.clientes_con_saldo} de {t.total_clientes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Tendencia (30 días)</span>
                  <span className={cn('text-xs font-bold flex items-center gap-0.5',
                    t.tendencia_30d >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {t.tendencia_30d >= 0
                      ? <TrendingUp size={11} />
                      : <TrendingDown size={11} />}
                    {t.tendencia_30d >= 0 ? '+' : ''}{t.tendencia_30d}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-lg p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Acciones rápidas</p>
            <div className="space-y-1.5">
              {[
                { icon: MessageSquare, color: 'bg-green-100 text-green-600', label: 'Enviar recordatorios a vencidos', sub: 'WhatsApp masivo' },
                { icon: DollarSign,    color: 'bg-blue-100 text-blue-600',   label: 'Generar reporte de deudas',    sub: 'Ver detalle completo' },
                { icon: Calendar,      color: 'bg-violet-100 text-violet-600', label: 'Registrar promesa de pago',  sub: 'Comprometer un cobro' },
                { icon: ExternalLink,  color: 'bg-gray-100 text-gray-600',   label: 'Ver historial de cobranzas',  sub: 'Movimientos y pagos' },
              ].map((a, i) => (
                <button key={i} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  onClick={a.label.includes('promesa') ? () => setModal(null) : undefined}>
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', a.color)}>
                    <a.icon size={13} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-700 font-medium leading-tight">{a.label}</p>
                    <p className="text-[10px] text-gray-400">{a.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <ModalNuevoCompromiso
          clienteId={modal.clienteId}
          clienteNombre={modal.nombre}
          onClose={() => setModal(null)}
          onCreated={load}
        />
      )}

      {detalleClienteId && (
        <ModalDetalleEstadoCuenta
          clienteId={detalleClienteId}
          onClose={() => setDetalleClienteId(null)}
        />
      )}
    </div>
  );
}
