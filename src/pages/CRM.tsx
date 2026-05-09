import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  Users, TrendingUp, TrendingDown, DollarSign, Target, CheckCircle2,
  Clock, Phone, MessageCircle, Plus, ChevronRight, MoreVertical,
  X, Check, AlertCircle, Flame, Snowflake, Star, RefreshCw,
  Mail, Globe, UserCheck, Trophy, FileText, Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ClientePipeline {
  id: string;
  nombre: string;
  apellido: string | null;
  razon_social: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  crm_etapa: string;
  interes: string;
  producto_interes: string | null;
  monto_estimado: number | null;
  probabilidad: number;
  motivo_perdida: string | null;
  ultima_interaccion: string | null;
  dias_sin_contacto: number;
  valor_total_historico: number;
  proxima_accion: string | null;
  proxima_accion_fecha: string | null;
  asignado_nombre: string | null;
  ultimo_op_monto: number | null;
  ultimo_op_estado: string | null;
  ultimo_op_fecha: string | null;
  ultimo_op_validez: string | null;
}

interface TareaHoy {
  id: string;
  descripcion: string;
  tipo_accion: string | null;
  hora: string | null;
  prioridad: string;
  nombre: string;
  apellido: string | null;
  razon_social: string | null;
  cliente_id: string;
}

interface TableroData {
  kpis: {
    leads_nuevos: number;
    leads_nuevos_vs: number;
    en_seguimiento: number;
    presupuestados: number;
    ventas_cerradas: number;
    tasa_cierre: number;
    ventas_totales: number;
    ventas_vs_anterior: number;
  };
  pipeline: {
    nuevo: ClientePipeline[];
    en_contacto: ClientePipeline[];
    presupuestado: ClientePipeline[];
    en_decision: ClientePipeline[];
    cerrado: ClientePipeline[];
  };
  embudo: Array<{ etapa: string; count: number; pct: number }>;
  seguimientos_hoy: TareaHoy[];
  origen_leads: Array<{ origen: string; cant: number }>;
  top_productos: Array<{ producto: string; cant: number }>;
  top_clientes: Array<{ id: string; nombre: string; apellido: string; razon_social: string; valor_total_historico: number; operaciones_count: number }>;
  evolucion: Array<{ fecha: string; actual: number; anterior: number }>;
  ultimas_oportunidades: ClientePipeline[];
  total_pipeline: number;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'nuevo',         label: 'Nuevos',         dotColor: '#3B82F6', headerBg: 'bg-blue-50',   headerBorder: 'border-blue-200' },
  { key: 'en_contacto',   label: 'En Contacto',    dotColor: '#8B5CF6', headerBg: 'bg-violet-50', headerBorder: 'border-violet-200' },
  { key: 'presupuestado', label: 'Presupuestados',  dotColor: '#F59E0B', headerBg: 'bg-amber-50',  headerBorder: 'border-amber-200' },
  { key: 'en_decision',   label: 'En Decisión',    dotColor: '#F97316', headerBg: 'bg-orange-50', headerBorder: 'border-orange-200' },
  { key: 'cerrado',       label: 'Cerrados',        dotColor: '#10B981', headerBg: 'bg-green-50',  headerBorder: 'border-green-200' },
] as const;

const ETAPA_LABELS: Record<string, string> = {
  nuevo: 'Nuevos', en_contacto: 'En Contacto', presupuestado: 'Presupuestados',
  en_decision: 'En Decisión', cerrado_ganado: 'Cerrado ✓', cerrado_perdido: 'Perdido',
};

const ORIGEN_CFG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  whatsapp:      { label: 'WhatsApp',  bg: 'bg-green-100',  text: 'text-green-700',  icon: MessageCircle },
  facebook:      { label: 'Facebook',  bg: 'bg-blue-100',   text: 'text-blue-700',   icon: Globe },
  instagram:     { label: 'Instagram', bg: 'bg-pink-100',   text: 'text-pink-700',   icon: Globe },
  recomendacion: { label: 'Recom.',    bg: 'bg-purple-100', text: 'text-purple-700', icon: UserCheck },
  web:           { label: 'Web',       bg: 'bg-gray-100',   text: 'text-gray-700',   icon: Globe },
  otro:          { label: 'Otro',      bg: 'bg-gray-100',   text: 'text-gray-600',   icon: Users },
};

const INTERES_CFG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  caliente: { label: 'Caliente', bg: 'bg-red-100',    text: 'text-red-600',    icon: Flame     },
  medio:    { label: 'Medio',    bg: 'bg-amber-100',  text: 'text-amber-600',  icon: Star      },
  frio:     { label: 'Frío',     bg: 'bg-blue-100',   text: 'text-blue-600',   icon: Snowflake },
};

const COLORES_PIE = ['#25D366','#1877F2','#E1306C','#8B5CF6','#6B7280','#F59E0B'];

const ETAPAS_SIGUIENTE: Record<string, string> = {
  nuevo: 'en_contacto', en_contacto: 'presupuestado', presupuestado: 'en_decision',
  en_decision: 'cerrado_ganado',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtM = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('es-AR')}`;
};

const clienteNombre = (c: { nombre: string; apellido?: string | null; razon_social?: string | null }) =>
  c.razon_social || `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}`;

const diasBadge = (dias: number) => {
  if (dias >= 999) return { text: 'Sin contacto', bg: 'bg-gray-100', txt: 'text-gray-500' };
  if (dias === 0)  return { text: 'Hoy',          bg: 'bg-green-100', txt: 'text-green-700' };
  if (dias === 1)  return { text: 'Ayer',          bg: 'bg-yellow-100', txt: 'text-yellow-700' };
  if (dias <= 7)   return { text: `${dias} días`,  bg: 'bg-orange-100', txt: 'text-orange-700' };
  return               { text: `${dias} días`,     bg: 'bg-red-100',   txt: 'text-red-600' };
};

const fmtChartDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
};

const diasHastaVencimiento = (fechaStr: string | null) => {
  if (!fechaStr) return null;
  const dias = Math.ceil((new Date(fechaStr + 'T12:00:00').getTime() - Date.now()) / 86400000);
  return dias;
};

// ── Sub-componentes ───────────────────────────────────────────────────────────

function VsAnterior({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const sube = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${sube ? 'text-green-600' : 'text-red-500'}`}>
      {sube ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {sube ? '+' : ''}{pct}% vs mes ant.
    </span>
  );
}

function KpiCard({ icon, color, label, value, sub }: {
  icon: React.ReactNode; color: string; label: string; value: string; sub?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex flex-col gap-1">
      <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center`}>{icon}</div>
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">{label}</div>
      <div className="text-xl font-bold text-gray-900 leading-none">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function OrigenBadge({ origen }: { origen: string | null }) {
  const cfg = ORIGEN_CFG[origen ?? 'otro'] ?? ORIGEN_CFG['otro'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

function InteresBadge({ interes }: { interes: string }) {
  const cfg = INTERES_CFG[interes] ?? INTERES_CFG['medio'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

// ── Card de pipeline ──────────────────────────────────────────────────────────

function PipelineCard({
  cliente, onMoverEtapa, onRegistrarContacto,
}: {
  cliente: ClientePipeline;
  onMoverEtapa: (c: ClientePipeline) => void;
  onRegistrarContacto: (c: ClientePipeline) => void;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const db = diasBadge(cliente.dias_sin_contacto);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    };
    if (menuAbierto) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuAbierto]);

  // Badges específicos por etapa
  const renderEtapaBadge = () => {
    if (cliente.crm_etapa === 'presupuestado' && cliente.ultimo_op_monto) {
      const diasVence = diasHastaVencimiento(cliente.ultimo_op_validez);
      if (diasVence !== null && diasVence <= 7 && diasVence >= 0) {
        return <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Vence en {diasVence}d</span>;
      }
      if (cliente.ultimo_op_estado === 'enviado') {
        return <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Sin respuesta</span>;
      }
      return <span className="text-[10px] font-semibold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Visto</span>;
    }
    if (cliente.crm_etapa === 'en_decision') {
      const prob = cliente.probabilidad ?? 50;
      if (prob >= 70) return <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Alta prob.</span>;
      if (prob >= 40) return <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Media prob.</span>;
      return <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">Duda</span>;
    }
    if (cliente.crm_etapa === 'cerrado_ganado') return <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Ganado ✓</span>;
    if (cliente.crm_etapa === 'cerrado_perdido') return <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Perdido</span>;
    return null;
  };

  const monto = cliente.ultimo_op_monto ?? cliente.monto_estimado;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <span
          className="text-xs font-bold text-gray-800 leading-tight cursor-pointer hover:text-blue-600 flex-1 mr-1"
          onClick={() => navigate(`/clientes/${cliente.id}`)}
        >
          {clienteNombre(cliente)}
        </span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuAbierto(v => !v)}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400"
          >
            <MoreVertical size={13} />
          </button>
          {menuAbierto && (
            <div className="absolute right-0 top-6 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 text-xs">
              {ETAPAS_SIGUIENTE[cliente.crm_etapa] && (
                <button
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-600 font-medium flex items-center gap-2"
                  onClick={() => { setMenuAbierto(false); onMoverEtapa(cliente); }}
                >
                  <ChevronRight size={12} />
                  Mover a siguiente etapa
                </button>
              )}
              <button
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                onClick={() => { setMenuAbierto(false); onRegistrarContacto(cliente); }}
              >
                <MessageCircle size={12} />
                Registrar contacto
              </button>
              <button
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                onClick={() => { setMenuAbierto(false); navigate(`/clientes/${cliente.id}`); }}
              >
                <Users size={12} />
                Ver ficha cliente
              </button>
              {cliente.telefono && (
                <a
                  href={`https://wa.me/${cliente.telefono.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full text-left px-3 py-2 hover:bg-green-50 text-green-700 flex items-center gap-2"
                  onClick={() => setMenuAbierto(false)}
                >
                  <MessageCircle size={12} />
                  Abrir WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Origen + días */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {cliente.origen && <OrigenBadge origen={cliente.origen} />}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${db.bg} ${db.txt}`}>
          {db.text}
        </span>
      </div>

      {/* Producto */}
      {cliente.producto_interes && (
        <p className="text-[11px] text-gray-500 mb-1.5 leading-tight truncate">{cliente.producto_interes}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <InteresBadge interes={cliente.interes ?? 'medio'} />
        <div className="flex items-center gap-1">
          {monto && <span className="text-[11px] font-bold text-gray-700">{fmtM(monto)}</span>}
          {renderEtapaBadge()}
        </div>
      </div>
    </div>
  );
}

// ── Modal: Nuevo Lead ─────────────────────────────────────────────────────────

function ModalNuevoLead({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    nombre: '', apellido: '', telefono: '', origen: 'whatsapp',
    producto_interes: '', interes: 'medio', monto_estimado: '', notas: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('Nombre requerido'); return; }
    setSaving(true);
    try {
      await api.post('/crm/leads', {
        ...form,
        monto_estimado: form.monto_estimado ? parseFloat(form.monto_estimado) : null,
      });
      onSuccess();
    } catch {
      setError('Error al crear el lead');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <Plus size={16} className="text-blue-600" />
            </div>
            <h2 className="font-bold text-gray-900">Nuevo Lead</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Juan" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label>
              <input value={form.apellido} onChange={e => set('apellido', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="García" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
            <input value={form.telefono} onChange={e => set('telefono', e.target.value)} type="tel"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="+54 11 1234-5678" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Origen</label>
              <select value={form.origen} onChange={e => set('origen', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="whatsapp">WhatsApp</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="recomendacion">Recomendación</option>
                <option value="web">Web</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Interés</label>
              <select value={form.interes} onChange={e => set('interes', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="caliente">🔥 Caliente</option>
                <option value="medio">⭐ Medio</option>
                <option value="frio">❄️ Frío</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Producto de interés</label>
            <input value={form.producto_interes} onChange={e => set('producto_interes', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ej: Ventana corredera PVC" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto estimado</label>
            <input value={form.monto_estimado} onChange={e => set('monto_estimado', e.target.value)} type="number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Info adicional..." />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Agregar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Mover Etapa ────────────────────────────────────────────────────────

function ModalMoverEtapa({ cliente, onClose, onSuccess }: {
  cliente: ClientePipeline; onClose: () => void; onSuccess: () => void;
}) {
  const [etapa, setEtapa] = useState(ETAPAS_SIGUIENTE[cliente.crm_etapa] ?? 'cerrado_ganado');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const etapasDisponibles = [
    'nuevo','en_contacto','presupuestado','en_decision','cerrado_ganado','cerrado_perdido',
  ].filter(e => e !== cliente.crm_etapa);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/crm/clientes/${cliente.id}/etapa`, {
        etapa, motivo_perdida: etapa === 'cerrado_perdido' ? motivo : null,
      });
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm">Mover etapa</h2>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">Cliente: <strong>{clienteNombre(cliente)}</strong></p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nueva etapa</label>
            <select value={etapa} onChange={e => setEtapa(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              {etapasDisponibles.map(e => (
                <option key={e} value={e}>{ETAPA_LABELS[e]}</option>
              ))}
            </select>
          </div>
          {etapa === 'cerrado_perdido' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de pérdida</label>
              <select value={motivo} onChange={e => setMotivo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Sin especificar</option>
                <option value="precio">Precio muy alto</option>
                <option value="tiempo">Demora en entrega</option>
                <option value="competencia">Fue a la competencia</option>
                <option value="sin_respuesta">Sin respuesta</option>
                <option value="decision">Decisión del cliente</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50 ${etapa === 'cerrado_perdido' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {saving ? 'Guardando...' : 'Mover'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Registrar Contacto ─────────────────────────────────────────────────

function ModalRegistrarContacto({ cliente, onClose, onSuccess }: {
  cliente: ClientePipeline; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    tipo: 'whatsapp', descripcion: '', agregarTarea: false,
    tarea_descripcion: '', tarea_vencimiento: '', tarea_tipo: 'whatsapp', tarea_hora: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.descripcion.trim()) return;
    setSaving(true);
    try {
      await api.post('/crm/contacto', {
        cliente_id: cliente.id,
        tipo: form.tipo,
        descripcion: form.descripcion,
        tarea_descripcion: form.agregarTarea ? form.tarea_descripcion : null,
        tarea_vencimiento: form.agregarTarea ? form.tarea_vencimiento : null,
        tarea_tipo: form.agregarTarea ? form.tarea_tipo : null,
        tarea_hora: form.agregarTarea ? form.tarea_hora : null,
      });
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm">Registrar contacto</h2>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">Cliente: <strong>{clienteNombre(cliente)}</strong></p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Canal</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="whatsapp">WhatsApp</option>
              <option value="llamada">Llamada</option>
              <option value="email">Email</option>
              <option value="visita">Visita</option>
              <option value="nota">Nota interna</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="¿Qué pasó en el contacto?" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.agregarTarea} onChange={e => set('agregarTarea', e.target.checked)}
              className="rounded" />
            <span className="text-xs text-gray-600">Programar seguimiento</span>
          </label>
          {form.agregarTarea && (
            <div className="space-y-2 pl-4 border-l-2 border-blue-200">
              <input value={form.tarea_descripcion} onChange={e => set('tarea_descripcion', e.target.value)}
                placeholder="Descripción del seguimiento" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.tarea_vencimiento} onChange={e => set('tarea_vencimiento', e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                <input type="time" value={form.tarea_hora} onChange={e => set('tarea_hora', e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.descripcion.trim()}
              className="flex-1 bg-green-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CRM() {
  const [data, setData] = useState<TableroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalLead, setModalLead] = useState(false);
  const [modalEtapa, setModalEtapa] = useState<ClientePipeline | null>(null);
  const [modalContacto, setModalContacto] = useState<ClientePipeline | null>(null);
  const [columnExpanded, setColumnExpanded] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<TableroData>('/crm/tablero');
      setData(result);
    } catch {
      setError('Error al cargar los datos del CRM');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onModalSuccess = () => {
    setModalLead(false);
    setModalEtapa(null);
    setModalContacto(null);
    fetchData();
  };

  const completarTarea = async (tareaId: string) => {
    try {
      await api.patch(`/crm/tareas/${tareaId}/completar`, {});
      setData(prev => prev ? {
        ...prev,
        seguimientos_hoy: prev.seguimientos_hoy.filter(t => t.id !== tareaId),
      } : prev);
    } catch { /* noop */ }
  };

  const totalMetodos = useMemo(() =>
    data?.origen_leads.reduce((s, o) => s + o.cant, 0) ?? 0,
  [data]);

  const getPipelineList = (key: string): ClientePipeline[] => {
    if (!data) return [];
    if (key === 'cerrado') return data.pipeline.cerrado;
    return data.pipeline[key as keyof typeof data.pipeline] as ClientePipeline[] ?? [];
  };

  if (error) return (
    <div className="p-8 text-center">
      <AlertCircle size={32} className="text-red-400 mx-auto mb-2" />
      <p className="text-sm text-gray-600">{error}</p>
      <button onClick={fetchData} className="mt-3 text-sm text-blue-600 hover:underline">Reintentar</button>
    </div>
  );

  const kpis = data?.kpis;
  const EMBUDO_COLORS = ['#3B82F6','#8B5CF6','#F59E0B','#F97316','#10B981'];

  return (
    <div className="p-4 space-y-4 max-w-[1700px]">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">CRM — Gestión de Clientes</h1>
          <p className="text-xs text-gray-500">Gestioná todo el proceso comercial y cerrá más ventas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setModalLead(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
          >
            <Plus size={15} /> Nuevo Lead
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-100 h-24 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard icon={<Users size={15} className="text-blue-600" />} color="bg-blue-100"
            label="Leads nuevos" value={String(kpis?.leads_nuevos ?? 0)}
            sub={<VsAnterior pct={kpis?.leads_nuevos_vs ?? 0} />} />
          <KpiCard icon={<MessageCircle size={15} className="text-violet-600" />} color="bg-violet-100"
            label="En seguimiento" value={String(kpis?.en_seguimiento ?? 0)}
            sub="activos en pipeline" />
          <KpiCard icon={<FileText size={15} className="text-amber-600" />} color="bg-amber-100"
            label="Presupuestados" value={String(kpis?.presupuestados ?? 0)}
            sub="esperando respuesta" />
          <KpiCard icon={<CheckCircle2 size={15} className="text-green-600" />} color="bg-green-100"
            label="Ventas cerradas" value={String(kpis?.ventas_cerradas ?? 0)}
            sub="este período" />
          <KpiCard icon={<Target size={15} className="text-orange-500" />} color="bg-orange-100"
            label="Tasa de cierre" value={`${kpis?.tasa_cierre ?? 0}%`}
            sub="de oportunidades" />
          <KpiCard icon={<DollarSign size={15} className="text-emerald-600" />} color="bg-emerald-100"
            label="Ventas totales" value={fmtM(kpis?.ventas_totales ?? 0)}
            sub={<VsAnterior pct={kpis?.ventas_vs_anterior ?? 0} />} />
        </div>
      )}

      {/* ── Pipeline + Sidebar ── */}
      <div className="flex gap-4">

        {/* Pipeline kanban */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-800">Pipeline de ventas</h2>
            {data && <span className="text-xs text-gray-400">{data.total_pipeline} oportunidades activas</span>}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
            {PIPELINE_STAGES.map(stage => {
              const clientes = getPipelineList(stage.key);
              const expanded = columnExpanded[stage.key];
              const visible = expanded ? clientes : clientes.slice(0, 3);
              return (
                <div key={stage.key} className="min-w-[190px] w-[190px] shrink-0">
                  {/* Cabecera columna */}
                  <div className={`rounded-xl border ${stage.headerBg} ${stage.headerBorder} px-3 py-2 mb-2 flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: stage.dotColor }} />
                      <span className="text-xs font-bold text-gray-700">{stage.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-400">{clientes.length}</span>
                  </div>

                  {/* Tarjetas */}
                  <div className="space-y-2">
                    {loading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-100 h-20 animate-pulse" />
                      ))
                    ) : visible.length === 0 ? (
                      <div className="text-center py-6 text-xs text-gray-300">Sin leads</div>
                    ) : (
                      visible.map(c => (
                        <PipelineCard
                          key={c.id}
                          cliente={c}
                          onMoverEtapa={setModalEtapa}
                          onRegistrarContacto={setModalContacto}
                        />
                      ))
                    )}
                    {clientes.length > 3 && !loading && (
                      <button
                        onClick={() => setColumnExpanded(p => ({ ...p, [stage.key]: !p[stage.key] }))}
                        className="w-full text-xs text-center text-gray-400 hover:text-blue-600 py-1"
                      >
                        {expanded ? 'Ver menos' : `Ver todos (${clientes.length}) →`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar derecho */}
        <div className="w-60 shrink-0 space-y-3">

          {/* Seguimientos del día */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Clock size={12} className="text-blue-500" />
              Seguimientos de hoy
            </h3>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />)}
              </div>
            ) : (data?.seguimientos_hoy ?? []).length === 0 ? (
              <div className="text-center py-3">
                <CheckCircle2 size={20} className="text-green-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Sin seguimientos hoy</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(data?.seguimientos_hoy ?? []).map(t => {
                  const Icon = t.tipo_accion === 'llamada' ? Phone :
                               t.tipo_accion === 'email' ? Mail : MessageCircle;
                  return (
                    <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 group">
                      <Icon size={12} className="text-gray-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">
                          {t.razon_social || `${t.nombre}${t.apellido ? ' ' + t.apellido : ''}`}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">{t.descripcion}</p>
                        {t.hora && <p className="text-[10px] text-blue-500">{t.hora.slice(0, 5)}</p>}
                      </div>
                      <button
                        onClick={() => completarTarea(t.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-green-500 hover:bg-green-50"
                        title="Marcar como hecho"
                      >
                        <Check size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Acciones rápidas</h3>
            <div className="space-y-0.5">
              {[
                { label: 'Nuevo Lead', action: () => setModalLead(true), icon: Plus, color: 'text-blue-600 hover:bg-blue-50' },
                { label: 'Enviar presupuesto', action: () => window.location.href = '/presupuestos/nuevo', icon: FileText, color: 'text-violet-600 hover:bg-violet-50' },
                { label: 'Ver todos los clientes', action: () => window.location.href = '/clientes', icon: Users, color: 'text-gray-600 hover:bg-gray-50' },
                { label: 'Ver operaciones', action: () => window.location.href = '/operaciones', icon: CheckCircle2, color: 'text-green-600 hover:bg-green-50' },
              ].map(a => (
                <button key={a.label} onClick={a.action}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${a.color} group`}>
                  <a.icon size={12} />
                  <span className="flex-1 text-left">{a.label}</span>
                  <ChevronRight size={10} className="opacity-30 group-hover:opacity-60" />
                </button>
              ))}
            </div>
          </div>

          {/* Clientes por valor */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Trophy size={12} className="text-amber-500" />
              Clientes por valor (12m)
            </h3>
            {loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-50 animate-pulse rounded" />)}</div>
            ) : (
              <div className="space-y-1.5">
                {(data?.top_clientes ?? []).map((c, i) => (
                  <Link key={c.id} to={`/clientes/${c.id}`}
                    className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-1 py-0.5">
                    <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                    <span className="flex-1 text-xs text-gray-700 truncate">
                      {c.razon_social || `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}`}
                    </span>
                    <span className="text-xs font-bold text-gray-700">{fmtM(Number(c.valor_total_historico))}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Analytics bottom ── */}
      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-100 h-52 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">

          {/* Embudo */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-blue-500" /> Embudo de ventas
            </h3>
            <div className="space-y-2">
              {(data?.embudo ?? []).map((e, i) => (
                <div key={e.etapa}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-600">{e.etapa}</span>
                    <span className="font-semibold text-gray-700">{e.count} ({e.pct}%)</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${e.pct}%`, background: EMBUDO_COLORS[i] }} />
                  </div>
                </div>
              ))}
            </div>
            {data && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">Tasa de conversión global:
                  <strong className="text-gray-800 ml-1">{kpis?.tasa_cierre ?? 0}%</strong>
                </div>
              </div>
            )}
          </div>

          {/* Ventas por período */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <DollarSign size={12} className="text-green-500" /> Ventas por período
            </h3>
            <p className="text-xs text-gray-400 mb-2">
              Este mes: <strong className="text-gray-700">{fmtM(kpis?.ventas_totales ?? 0)}</strong>
              {' '}<span className={`text-xs ${(kpis?.ventas_vs_anterior ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {(kpis?.ventas_vs_anterior ?? 0) >= 0 ? '+' : ''}{kpis?.ventas_vs_anterior ?? 0}%
              </span>
            </p>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={data?.evolucion ?? []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="crmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="fecha" tickFormatter={fmtChartDate}
                  tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.ceil((data?.evolucion.length ?? 7) / 5) - 1)} />
                <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 9, fill: '#9CA3AF' }}
                  axisLine={false} tickLine={false} width={45} />
                <Tooltip formatter={(v: unknown) => fmtM(Number(v))}
                  labelFormatter={(l: unknown) => fmtChartDate(String(l))}
                  contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 11 }} />
                <Area type="monotone" dataKey="anterior" stroke="#E5E7EB" fill="none"
                  strokeWidth={1} strokeDasharray="3 3" dot={false} />
                <Area type="monotone" dataKey="actual" stroke="#3B82F6" fill="url(#crmGrad)"
                  strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Origen de leads */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Globe size={12} className="text-violet-500" /> Origen de leads
            </h3>
            {(data?.origen_leads ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>
            ) : (
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <ResponsiveContainer width={90} height={90}>
                    <PieChart>
                      <Pie data={data?.origen_leads.map((o, i) => ({ name: o.origen, value: o.cant, color: COLORES_PIE[i % COLORES_PIE.length] }))}
                        cx={40} cy={40} innerRadius={25} outerRadius={40} dataKey="value" paddingAngle={2}>
                        {(data?.origen_leads ?? []).map((_, i) => (
                          <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1">
                  {(data?.origen_leads ?? []).slice(0, 5).map((o, i) => (
                    <div key={o.origen} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-gray-600 truncate max-w-[80px]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORES_PIE[i % COLORES_PIE.length] }} />
                        {ORIGEN_CFG[o.origen]?.label ?? o.origen}
                      </span>
                      <span className="font-semibold">
                        {totalMetodos > 0 ? Math.round(o.cant / totalMetodos * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-2 text-right">Total leads: {totalMetodos}</p>
          </div>

          {/* Productos más consultados */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Star size={12} className="text-amber-500" /> Productos más consultados
            </h3>
            {(data?.top_productos ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {(data?.top_productos ?? []).map((p, i) => {
                  const max = data!.top_productos[0].cant;
                  const pct = max > 0 ? Math.round(p.cant / max * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-400">{i + 1}</span>
                          <span className="truncate max-w-[130px]">{p.producto}</span>
                        </span>
                        <span className="font-semibold">{p.cant}</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 pt-2 border-t border-gray-100">
              <Link to="/productos" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Ver todos los productos <ChevronRight size={10} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Últimas oportunidades ── */}
      {!loading && (data?.ultimas_oportunidades ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Últimas oportunidades</h3>
            <span className="text-xs text-gray-400">{data?.ultimas_oportunidades.length} activas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Cliente','Producto','Monto est.','Etapa','Último contacto','Próxima acción',''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-gray-400 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.ultimas_oportunidades ?? []).map(c => {
                  const db2 = diasBadge(c.dias_sin_contacto);
                  const stage = PIPELINE_STAGES.find(s => s.key === c.crm_etapa || (s.key === 'cerrado' && c.crm_etapa?.startsWith('cerrado')));
                  return (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <Link to={`/clientes/${c.id}`} className="font-semibold text-gray-800 hover:text-blue-600">
                          {clienteNombre(c)}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 max-w-[140px] truncate">{c.producto_interes ?? '—'}</td>
                      <td className="px-4 py-2.5 font-bold text-gray-700">
                        {c.monto_estimado ? fmtM(c.monto_estimado) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full font-semibold text-[10px]"
                          style={{ background: `${stage?.dotColor}20`, color: stage?.dotColor }}>
                          {ETAPA_LABELS[c.crm_etapa] ?? c.crm_etapa}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${db2.bg} ${db2.txt}`}>
                          {db2.text}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 max-w-[150px] truncate">{c.proxima_accion ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => setModalContacto(c)}
                          className="text-blue-600 hover:underline text-[10px]">Contactar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modales ── */}
      {modalLead && <ModalNuevoLead onClose={() => setModalLead(false)} onSuccess={onModalSuccess} />}
      {modalEtapa && <ModalMoverEtapa cliente={modalEtapa} onClose={() => setModalEtapa(null)} onSuccess={onModalSuccess} />}
      {modalContacto && <ModalRegistrarContacto cliente={modalContacto} onClose={() => setModalContacto(null)} onSuccess={onModalSuccess} />}
    </div>
  );
}
