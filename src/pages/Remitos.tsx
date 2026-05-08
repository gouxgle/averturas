import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck, Plus, RefreshCw, Package, CheckCircle2, Clock,
  XCircle, AlertTriangle, ChevronRight, Eye, Phone,
  MessageCircle, Building2, DollarSign, BarChart3, Zap,
  PrinterIcon, FileText, CalendarClock, Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Tipos ────────────────────────────────────────────────────────────

interface RStats { pendientes: number; para_hoy: number; atrasados: number; entregados_mes: number; valor_pendiente: number }
interface RCliente { id?: string; nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string; telefono?: string | null }
interface ItemResumen { descripcion: string; cantidad: number }

interface Remito {
  id: string; numero: string; estado: 'borrador' | 'emitido' | 'entregado' | 'cancelado';
  medio_envio: string; transportista: string | null; nro_seguimiento: string | null;
  direccion_entrega: string | null; fecha_emision: string;
  fecha_entrega_est: string | null; fecha_entrega_real: string | null;
  notas: string | null; stock_descontado: boolean;
  valor_total: number; items_resumen: ItemResumen[] | null;
  cliente: RCliente & { telefono: string | null };
  operacion: { id: string; numero: string } | null;
}

interface ProximaEntrega { id: string; numero: string; fecha_entrega_est: string; valor_total: number; cliente: RCliente }
interface MetodoEnvio { medio_envio: string; n: number; pct: number }
interface Metricas { tiempo_promedio: number; pct_a_tiempo: number; valor_entregado_mes: number; entregados_mes: number }

interface TableroData {
  stats: RStats;
  remitos: Remito[];
  entregas_hoy: ProximaEntrega[];
  entregas_atrasadas: ProximaEntrega[];
  metodos_envio: MetodoEnvio[];
  metricas: Metricas;
}

// ── Helpers ──────────────────────────────────────────────────────────

function ncl(c: RCliente) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(' ') || '—';
}

function diasHasta(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  const h = new Date(); h.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - h.getTime()) / 86_400_000);
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

type UrgState = 'atrasado' | 'para_hoy' | 'pendiente' | 'entregado' | 'cancelado';

function urgState(r: Remito): UrgState {
  if (r.estado === 'entregado') return 'entregado';
  if (r.estado === 'cancelado') return 'cancelado';
  const d = diasHasta(r.fecha_entrega_est);
  if (d === null) return 'pendiente';
  if (d < 0) return 'atrasado';
  if (d === 0) return 'para_hoy';
  return 'pendiente';
}

const URG_BORDER: Record<UrgState, string> = {
  atrasado:  'border-l-4 border-l-red-400',
  para_hoy:  'border-l-4 border-l-orange-400',
  pendiente: 'border-l-4 border-l-gray-200',
  entregado: 'border-l-4 border-l-emerald-400',
  cancelado: 'border-l-4 border-l-gray-100',
};

const ESTADO_BADGE: Record<UrgState, { label: string; cls: string }> = {
  atrasado:  { label: 'Atrasado',  cls: 'bg-red-100 text-red-700' },
  para_hoy:  { label: 'Para hoy',  cls: 'bg-orange-100 text-orange-700' },
  pendiente: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' },
  entregado: { label: 'Entregado', cls: 'bg-emerald-100 text-emerald-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
};

const ENTREGA_FECHA_BADGE: Record<string, { label: string; cls: string }> = {
  entregado:  { label: 'Entregado', cls: 'text-emerald-600 font-semibold' },
  cancelado:  { label: 'Cancelado', cls: 'text-gray-400' },
};

const MEDIOS_TIPO: Record<string, { tipo: string; sub: (t: string | null) => string; envio: boolean }> = {
  retiro_local:     { tipo: 'Retiro en taller', sub: () => 'Cliente retira',        envio: false },
  encomienda:       { tipo: 'Envío',            sub: () => 'Encomienda',             envio: true  },
  flete_propio:     { tipo: 'Envío',            sub: t => t ?? 'Transporte propio',  envio: true  },
  flete_tercero:    { tipo: 'Envío',            sub: () => 'Flete tercerizado',      envio: true  },
  correo_argentino: { tipo: 'Envío',            sub: () => 'Correo Argentino',       envio: true  },
  otro:             { tipo: 'Envío',            sub: t => t ?? 'Otro',              envio: true  },
};

// ── Modal de estado (reutilizado) ────────────────────────────────────

function ModalEstado({ remito, onClose, onSaved }: { remito: Remito; onClose: () => void; onSaved: () => void }) {
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [fechaReal, setFechaReal] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const TRANS: Record<string, { value: string; label: string; desc: string; cls: string }[]> = {
    borrador: [
      { value: 'emitido',   label: 'Emitir remito',    desc: 'Descuenta stock automáticamente', cls: 'border-blue-300 bg-blue-50 text-blue-700' },
      { value: 'cancelado', label: 'Cancelar',          desc: 'Sin efecto en stock',              cls: 'border-red-300 bg-red-50 text-red-700' },
    ],
    emitido: [
      { value: 'entregado', label: 'Marcar entregado',  desc: 'Confirma la entrega al cliente',   cls: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
      { value: 'cancelado', label: 'Cancelar',          desc: 'Revierte stock descontado',        cls: 'border-red-300 bg-red-50 text-red-700' },
    ],
    entregado: [
      { value: 'cancelado', label: 'Cancelar',          desc: 'Revierte stock y marca cancelado', cls: 'border-red-300 bg-red-50 text-red-700' },
    ],
  };

  async function confirmar() {
    if (!nuevoEstado) { toast.error('Seleccioná un estado'); return; }
    setSaving(true);
    try {
      await api.patch(`/remitos/${remito.id}/estado`, {
        estado: nuevoEstado,
        fecha_entrega_real: nuevoEstado === 'entregado' ? fechaReal : undefined,
      });
      toast.success('Estado actualizado');
      onSaved();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Error'); setSaving(false);
    }
  }

  const opciones = TRANS[remito.estado] ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Cambiar estado</h2>
          <p className="text-xs text-gray-500 mt-0.5">{remito.numero}</p>
        </div>
        <div className="p-5 space-y-2">
          {opciones.map(op => (
            <button key={op.value} type="button" onClick={() => setNuevoEstado(op.value)}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${nuevoEstado === op.value ? op.cls : 'border-gray-100 hover:border-gray-200'}`}>
              <p className="font-semibold text-sm">{op.label}</p>
              <p className="text-xs opacity-70 mt-0.5">{op.desc}</p>
            </button>
          ))}
          {nuevoEstado === 'entregado' && (
            <div className="pt-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha real de entrega</label>
              <input type="date" value={fechaReal} onChange={e => setFechaReal(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          )}
          {nuevoEstado === 'emitido' && (
            <div className="flex gap-2 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 border border-amber-200">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              Se descontará el stock de los ítems con producto vinculado.
            </div>
          )}
          {nuevoEstado === 'cancelado' && remito.stock_descontado && (
            <div className="flex gap-2 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 border border-amber-200">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              Se revertirá el stock descontado.
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={saving || !nuevoEstado}
            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <RefreshCw size={13} className="animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DonutChart (reutilizado de Operaciones) ──────────────────────────

function DonutChart({ segs }: { segs: { v: number; color: string }[] }) {
  const total = segs.reduce((s, x) => s + x.v, 0) || 1;
  const r = 28; const cx = 36; const cy = 36;
  const circ = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
      {segs.filter(s => s.v > 0).map((seg, i) => {
        const pct = seg.v / total;
        const dash = pct * circ;
        const rot = off * 360 - 90;
        off += pct;
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="12"
          strokeDasharray={`${dash} ${circ - dash}`} transform={`rotate(${rot} ${cx} ${cy})`} />;
      })}
    </svg>
  );
}

// ── Página principal ─────────────────────────────────────────────────

type Filtro = 'todos' | 'pendientes' | 'para_hoy' | 'atrasados' | 'entregados' | 'cancelados';

export function Remitos() {
  const navigate = useNavigate();
  const [data, setData] = useState<TableroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [estadoModal, setEstadoModal] = useState<Remito | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const d = await api.get<TableroData>('/remitos/tablero');
      setData(d);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPage(1); }, [filtro, search]);

  const filtrado = useMemo(() => {
    if (!data) return [];
    let list = data.remitos;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.numero.toLowerCase().includes(q) ||
        ncl(r.cliente).toLowerCase().includes(q) ||
        r.items_resumen?.some(i => i.descripcion.toLowerCase().includes(q))
      );
    }
    switch (filtro) {
      case 'pendientes':  return list.filter(r => ['borrador','emitido'].includes(r.estado));
      case 'para_hoy':    return list.filter(r => r.fecha_entrega_est?.slice(0,10) === todayStr && !['entregado','cancelado'].includes(r.estado));
      case 'atrasados':   return list.filter(r => r.fecha_entrega_est && r.fecha_entrega_est.slice(0,10) < todayStr && !['entregado','cancelado'].includes(r.estado));
      case 'entregados':  return list.filter(r => r.estado === 'entregado');
      case 'cancelados':  return list.filter(r => r.estado === 'cancelado');
      default:            return list;
    }
  }, [data, filtro, search, todayStr]);

  const paginated  = filtrado.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filtrado.length / perPage);

  const cntPendientes = data?.remitos.filter(r => ['borrador','emitido'].includes(r.estado)).length ?? 0;
  const cntParaHoy    = data?.remitos.filter(r => r.fecha_entrega_est?.slice(0,10) === todayStr && !['entregado','cancelado'].includes(r.estado)).length ?? 0;
  const cntAtrasados  = data?.remitos.filter(r => r.fecha_entrega_est && r.fecha_entrega_est.slice(0,10) < todayStr && !['entregado','cancelado'].includes(r.estado)).length ?? 0;
  const cntEntregados = data?.remitos.filter(r => r.estado === 'entregado').length ?? 0;
  const cntCancelados = data?.remitos.filter(r => r.estado === 'cancelado').length ?? 0;

  const now = new Date();
  const fechaHoyLabel = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
            <Truck size={22} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Remitos</h1>
            <p className="text-sm text-gray-500 mt-0.5">Control de entregas y logística</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={cargar} className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <RefreshCw size={16} className={cn('text-gray-500', loading && 'animate-spin')} />
          </button>
          <Link to="/remitos/nuevo"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 bg-teal-600">
            <Plus size={15} /> Nuevo remito
          </Link>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex gap-5">
          <div className="flex-1 space-y-4">
            {[80, 60, 400, 80].map((h, i) => <div key={i} className="animate-pulse bg-gray-100 rounded-2xl" style={{ height: h }} />)}
          </div>
          <div className="w-72 space-y-4 shrink-0">
            {[160, 160, 140, 120].map((h, i) => <div key={i} className="animate-pulse bg-gray-100 rounded-2xl" style={{ height: h }} />)}
          </div>
        </div>
      ) : data && (
        <div className="flex gap-5 items-start">

          {/* Columna principal */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* KPIs */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { icon: Truck,        bg: 'bg-teal-100',    cl: 'text-teal-600',   label: 'Pendientes',          val: data.stats.pendientes,     sub: 'Para entregar',        subCl: '' },
                { icon: Clock,        bg: 'bg-orange-100',  cl: 'text-orange-600', label: 'Para hoy',            val: data.stats.para_hoy,       sub: 'Entregas programadas',  subCl: '' },
                { icon: AlertTriangle,bg: 'bg-red-100',     cl: 'text-red-500',    label: 'Atrasados',           val: data.stats.atrasados,      sub: 'Requieren atención',    subCl: 'text-red-500 font-semibold' },
                { icon: CheckCircle2, bg: 'bg-emerald-100', cl: 'text-emerald-600',label: 'Entregados (mes)',     val: data.stats.entregados_mes, sub: 'Este mes',              subCl: '' },
                { icon: DollarSign,   bg: 'bg-blue-100',    cl: 'text-blue-600',   label: 'Valor total pendiente',val: formatCurrency(data.stats.valor_pendiente), sub: 'En mercadería', subCl: '' },
              ].map(({ icon: Icon, bg, cl, label, val, sub, subCl }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bg}`}>
                      <Icon size={16} className={cl} />
                    </div>
                    <p className="text-[11px] font-medium text-gray-500 leading-tight">{label}</p>
                  </div>
                  <p className="text-2xl font-extrabold text-gray-900 tabular-nums leading-none">{val}</p>
                  <p className={`text-[11px] mt-1 ${subCl || 'text-gray-400'}`}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Filtros + búsqueda */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {([
                  { key: 'todos',      label: 'Todos',      count: data.remitos.length },
                  { key: 'pendientes', label: 'Pendientes', count: cntPendientes },
                  { key: 'para_hoy',   label: 'Para hoy',   count: cntParaHoy },
                  { key: 'atrasados',  label: 'Atrasados',  count: cntAtrasados },
                  { key: 'entregados', label: 'Entregados', count: cntEntregados },
                  { key: 'cancelados', label: 'Cancelados', count: cntCancelados },
                ] as { key: Filtro; label: string; count: number }[]).map(f => (
                  <button key={f.key} type="button" onClick={() => setFiltro(f.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                      filtro === f.key
                        ? f.key === 'atrasados' ? 'bg-red-600 text-white border-red-600' : 'bg-teal-600 text-white border-teal-600'
                        : f.key === 'atrasados' && cntAtrasados > 0
                        ? 'bg-white border-red-200 text-red-600 hover:bg-red-50'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-700'
                    )}>
                    {f.label}
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                      filtro === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    )}>{f.count}</span>
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                    Filtros
                  </button>
                  <button type="button" className="p-1.5 text-gray-400 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                    <CalendarClock size={14} />
                  </button>
                </div>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por número, cliente o producto..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50"
                />
              </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {filtrado.length === 0 ? (
                <div className="py-16 text-center">
                  <Package size={28} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm text-gray-400">Sin remitos en esta vista</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/60">
                          {['Remito', 'Cliente', 'Productos', 'Entrega', 'Estado', 'F. entrega', 'Valor', 'Acciones'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginated.map(r => {
                          const urg = urgState(r);
                          const badge = ESTADO_BADGE[urg];
                          const medio = MEDIOS_TIPO[r.medio_envio] ?? { tipo: r.medio_envio, sub: (t: string | null) => t ?? '', envio: true };
                          const waLink = r.cliente.telefono ? `https://wa.me/${r.cliente.telefono.replace(/\D/g, '')}` : null;
                          const dias = diasHasta(r.fecha_entrega_est);

                          return (
                            <tr key={r.id} className={cn('hover:bg-gray-50/80 transition-colors', URG_BORDER[urg])}>
                              <td className="px-4 py-3">
                                <p className="text-[12px] font-mono font-bold text-blue-600">{r.numero}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{fmtFecha(r.fecha_emision)}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-[12px] font-semibold text-gray-800 whitespace-nowrap">{ncl(r.cliente)}</p>
                                {r.cliente.telefono && <p className="text-[10px] text-gray-400">{r.cliente.telefono}</p>}
                              </td>
                              <td className="px-4 py-3 max-w-[180px]">
                                {r.items_resumen?.slice(0, 1).map((it, i) => (
                                  <div key={i} className="flex items-start gap-1.5">
                                    <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                                      <Package size={11} className="text-gray-400" />
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold text-gray-800 leading-tight">{it.cantidad} {it.descripcion.slice(0, 30)}{it.descripcion.length > 30 ? '…' : ''}</p>
                                    </div>
                                  </div>
                                ))}
                                {(r.items_resumen?.length ?? 0) > 1 && (
                                  <p className="text-[10px] text-gray-400 mt-0.5 ml-6">+ {(r.items_resumen?.length ?? 0) - 1} más</p>
                                )}
                                {!r.items_resumen?.length && <p className="text-[11px] text-gray-400">—</p>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  {medio.envio
                                    ? <Truck size={13} className="text-blue-400 shrink-0" />
                                    : <Building2 size={13} className="text-teal-400 shrink-0" />
                                  }
                                  <div>
                                    <p className="text-[11px] font-semibold text-gray-700">{medio.tipo}</p>
                                    <p className="text-[10px] text-gray-400">{medio.sub(r.transportista)}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', badge.cls)}>
                                    {badge.label}
                                  </span>
                                  {urg === 'entregado' && r.fecha_entrega_real && (
                                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtFecha(r.fecha_entrega_real)}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {r.fecha_entrega_est ? (
                                  <>
                                    <p className="text-[11px] text-gray-600">{fmtFecha(r.fecha_entrega_est)}</p>
                                    {urg === 'entregado' && <p className="text-[10px] text-emerald-600 font-semibold">Entregado</p>}
                                    {urg === 'cancelado' && <p className="text-[10px] text-gray-400">Cancelado</p>}
                                    {urg === 'atrasado' && <p className="text-[10px] text-red-600 font-semibold">Vencida</p>}
                                    {urg === 'para_hoy' && <p className="text-[10px] text-orange-600 font-semibold">Hoy</p>}
                                    {urg === 'pendiente' && dias !== null && <p className="text-[10px] text-gray-400">{dias === 1 ? 'Mañana' : `En ${dias} días`}</p>}
                                  </>
                                ) : <p className="text-[11px] text-gray-400">—</p>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <p className="text-[13px] font-extrabold text-gray-900 tabular-nums">{formatCurrency(Number(r.valor_total))}</p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  {waLink && (
                                    <a href={waLink} target="_blank" rel="noopener noreferrer"
                                      className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 flex items-center justify-center transition-colors">
                                      <MessageCircle size={13} className="text-green-600" />
                                    </a>
                                  )}
                                  {r.cliente.telefono && (
                                    <a href={`tel:${r.cliente.telefono}`}
                                      className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center justify-center transition-colors">
                                      <Phone size={13} className="text-blue-600" />
                                    </a>
                                  )}
                                  <button type="button"
                                    onClick={() => r.operacion ? navigate(`/operaciones/${r.operacion.id}`) : setEstadoModal(r)}
                                    className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center transition-colors">
                                    <Eye size={13} className="text-gray-600" />
                                  </button>
                                  {r.estado !== 'cancelado' && (
                                    <button type="button" onClick={() => setEstadoModal(r)}
                                      className="w-7 h-7 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 flex items-center justify-center transition-colors">
                                      <ChevronRight size={13} className="text-teal-600" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400">
                      Mostrando {Math.min((page - 1) * perPage + 1, filtrado.length)} a {Math.min(page * perPage, filtrado.length)} de {filtrado.length} remito{filtrado.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 disabled:opacity-40">
                        ‹
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                        <button key={p} type="button" onClick={() => setPage(p)}
                          className={cn(
                            'w-8 h-8 rounded-lg border text-[12px] font-semibold',
                            page === p ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          )}>
                          {p}
                        </button>
                      ))}
                      <button type="button" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 disabled:opacity-40">
                        ›
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom bar de métricas */}
            <div className="grid grid-cols-4 gap-3">
              {/* Métodos de entrega */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Truck size={14} className="text-blue-600" />
                  </div>
                  <p className="text-[11px] font-semibold text-gray-600">Métodos de entrega</p>
                </div>
                {data.metodos_envio.slice(0, 3).map(m => {
                  const tipo = MEDIOS_TIPO[m.medio_envio]?.tipo ?? m.medio_envio;
                  return (
                    <div key={m.medio_envio} className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-gray-600">{tipo === 'Envío' ? 'Envío' : 'Retiro'}</span>
                      <span className="font-bold text-gray-800">{m.n} ({m.pct}%)</span>
                    </div>
                  );
                })}
              </div>

              {/* Tiempo promedio */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                    <Clock size={14} className="text-teal-600" />
                  </div>
                  <p className="text-[11px] font-semibold text-gray-600">Tiempo promedio de entrega</p>
                </div>
                <p className="text-2xl font-extrabold text-gray-900 mt-1">{data.metricas.tiempo_promedio || '—'} <span className="text-sm font-medium text-gray-400">días</span></p>
                <p className="text-[11px] text-gray-400 mt-0.5">Este mes</p>
              </div>

              {/* % a tiempo */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                  </div>
                  <p className="text-[11px] font-semibold text-gray-600">Remitos entregados a tiempo</p>
                </div>
                <p className="text-2xl font-extrabold text-gray-900 mt-1">{data.metricas.pct_a_tiempo}%</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Este mes</p>
              </div>

              {/* Valor entregado */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign size={14} className="text-green-600" />
                  </div>
                  <p className="text-[11px] font-semibold text-gray-600">Valor entregado (mes)</p>
                </div>
                <p className="text-xl font-extrabold text-gray-900 mt-1 tabular-nums">{formatCurrency(data.metricas.valor_entregado_mes)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">En {data.metricas.entregados_mes} remitos</p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-[280px] shrink-0 space-y-4">

            {/* Entregas del día */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock size={14} className="text-blue-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Entregas del día</h2>
              </div>
              <p className="text-[11px] text-gray-400 mb-3 capitalize">{fechaHoyLabel}</p>
              {data.entregas_hoy.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">Sin entregas programadas para hoy</p>
              ) : (
                <>
                  {data.entregas_hoy.map(e => (
                    <Link key={e.id} to={`/remitos`}
                      className="flex items-start justify-between py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-[11px] font-mono font-bold text-blue-600">{e.numero}</p>
                        <p className="text-[11px] text-gray-700 truncate max-w-[130px]">{ncl(e.cliente)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-bold text-gray-800 tabular-nums">{formatCurrency(Number(e.valor_total))}</p>
                        <p className="text-[10px] text-orange-500 font-semibold">Hoy</p>
                      </div>
                    </Link>
                  ))}
                  {data.entregas_hoy.length > 3 && (
                    <button type="button" className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 px-2">
                      Ver todas ({data.entregas_hoy.length}) <ChevronRight size={11} />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Entregas atrasadas */}
            {data.entregas_atrasadas.length > 0 && (
              <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className="text-red-500" />
                  <h2 className="text-xs font-bold text-red-700 uppercase tracking-wider">Entregas atrasadas</h2>
                </div>
                {data.entregas_atrasadas.map(e => (
                  <Link key={e.id} to={`/remitos`}
                    className="flex items-start justify-between py-2 px-2 rounded-lg hover:bg-red-50 transition-colors">
                    <div>
                      <p className="text-[11px] font-mono font-bold text-blue-600">{e.numero}</p>
                      <p className="text-[11px] text-gray-700 truncate max-w-[110px]">{ncl(e.cliente)}</p>
                      <p className="text-[10px] text-red-600 font-semibold">Vencida {fmtFecha(e.fecha_entrega_est)}</p>
                    </div>
                    <p className="text-[11px] font-bold text-gray-800 tabular-nums shrink-0">{formatCurrency(Number(e.valor_total))}</p>
                  </Link>
                ))}
                {data.entregas_atrasadas.length > 3 && (
                  <button type="button" className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-red-600 hover:text-red-700 px-2">
                    Ver todas ({data.entregas_atrasadas.length}) <ChevronRight size={11} />
                  </button>
                )}
              </div>
            )}

            {/* Resumen logístico */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={14} className="text-teal-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Resumen logístico</h2>
              </div>
              <div className="flex items-center gap-3">
                <DonutChart segs={[
                  { v: cntEntregados, color: '#10b981' },
                  { v: cntPendientes, color: '#3b82f6' },
                  { v: cntParaHoy,   color: '#f97316' },
                  { v: cntAtrasados, color: '#ef4444' },
                ]} />
                <div className="space-y-1.5">
                  {[
                    { label: 'Entregados', count: cntEntregados, color: 'bg-emerald-400' },
                    { label: 'Pendientes', count: cntPendientes, color: 'bg-blue-400' },
                    { label: 'Para hoy',   count: cntParaHoy,   color: 'bg-orange-400' },
                    { label: 'Atrasados',  count: cntAtrasados, color: 'bg-red-400' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${color}`} />
                      <span className="text-[11px] text-gray-600 flex-1">{label}</span>
                      <span className="text-[11px] font-bold text-gray-800">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-violet-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones rápidas</h2>
              </div>
              <div className="space-y-2">
                {[
                  { icon: Plus,         label: 'Nuevo remito',        href: '/remitos/nuevo',   cl: 'text-teal-600 bg-teal-50 border-teal-200' },
                  { icon: PrinterIcon,  label: 'Imprimir remito',     href: '/remitos',          cl: 'text-blue-600 bg-blue-50 border-blue-200' },
                  { icon: FileText,     label: 'Reporte de entregas', href: '/reportes',         cl: 'text-violet-600 bg-violet-50 border-violet-200' },
                  { icon: CalendarClock,label: 'Historial de entregas',href: '/remitos',         cl: 'text-gray-600 bg-gray-50 border-gray-200' },
                ].map(({ icon: Icon, label, href, cl }) => (
                  <Link key={label} to={href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all hover:opacity-80 ${cl}`}>
                    <Icon size={13} /> {label}
                    <ChevronRight size={11} className="ml-auto" />
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {estadoModal && (
        <ModalEstado remito={estadoModal} onClose={() => setEstadoModal(null)} onSaved={() => { setEstadoModal(null); cargar(); }} />
      )}
    </div>
  );
}
