import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Plus, Calendar, CreditCard,
  Banknote, Clock, XCircle, CheckCheck, Trash2, Users,
  ArrowUpDown, Filter, ExternalLink, DollarSign
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Tipos ───────────────────────────────────────────────────────────────────

interface ClienteResumen {
  id: string;
  nombre: string;
  apellido: string;
  razon_social: string;
  tipo_persona: string;
  telefono: string;
  email: string;
  operaciones_count: number;
  total_presupuestado: number;
  total_cobrado: number;
  saldo: number;
  compromisos_pendientes: number;
  proximo_vencimiento: string | null;
  compromisos_vencidos: number;
  ultima_actividad: string;
}

interface Totales {
  presupuestado: number;
  cobrado: number;
  saldo: number;
  compromisos: number;
  clientes_con_saldo: number;
  compromisos_vencidos: number;
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

interface NuevoCompromisoForm {
  tipo: string;
  monto: string;
  fecha_vencimiento: string;
  descripcion: string;
  numero_cheque: string;
  banco: string;
  notas: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function nombreCliente(c: Pick<ClienteResumen, 'nombre' | 'apellido' | 'razon_social'>) {
  if (c.razon_social) return c.razon_social;
  return [c.apellido, c.nombre].filter(Boolean).join(', ');
}

function formatDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
}

function diasHasta(dateStr: string): number {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d.getTime() - hoy.getTime()) / 86400000);
}

const TIPO_ICON: Record<string, React.ElementType> = {
  cuota: Calendar,
  cheque: CreditCard,
  efectivo_futuro: Banknote,
  transferencia: ArrowUpDown,
};

const TIPO_LABEL: Record<string, string> = {
  cuota: 'Cuota', cheque: 'Cheque', efectivo_futuro: 'Efectivo futuro', transferencia: 'Transferencia',
};

const ESTADO_COMPROMISO: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  cobrado:   { label: 'Cobrado',   cls: 'bg-emerald-100 text-emerald-700' },
  rechazado: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
  vencido:   { label: 'Vencido',   cls: 'bg-red-200 text-red-800' },
};

// ── Modal Nuevo Compromiso ───────────────────────────────────────────────────

function ModalNuevoCompromiso({
  clienteId, clienteNombre, onClose, onCreated,
}: {
  clienteId: string;
  clienteNombre: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<NuevoCompromisoForm>({
    tipo: 'cuota',
    monto: '',
    fecha_vencimiento: '',
    descripcion: '',
    numero_cheque: '',
    banco: '',
    notas: '',
  });
  const [saving, setSaving] = useState(false);

  function upd(k: keyof NuevoCompromisoForm, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.monto || !form.fecha_vencimiento) {
      toast.error('Completá monto y fecha');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/estado-cuenta/${clienteId}/compromisos`, {
        tipo:              form.tipo,
        monto:             parseFloat(form.monto),
        fecha_vencimiento: form.fecha_vencimiento,
        descripcion:       form.descripcion || null,
        numero_cheque:     form.numero_cheque || null,
        banco:             form.banco || null,
        notas:             form.notas || null,
      });
      toast.success('Compromiso registrado');
      onCreated();
      onClose();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">Nuevo compromiso de pago</h3>
            <p className="text-xs text-slate-500 mt-0.5">{clienteNombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <XCircle size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(['cuota','cheque','efectivo_futuro','transferencia'] as const).map(t => {
                const Icon = TIPO_ICON[t];
                return (
                  <button key={t} type="button"
                    onClick={() => upd('tipo', t)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all',
                      form.tipo === t
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}>
                    <Icon size={14} />{TIPO_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monto + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Monto *</label>
              <input
                type="number" step="0.01" min="0.01" required
                value={form.monto} onChange={e => upd('monto', e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Vencimiento *</label>
              <input
                type="date" required
                value={form.fecha_vencimiento} onChange={e => upd('fecha_vencimiento', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
            <input
              type="text" value={form.descripcion} onChange={e => upd('descripcion', e.target.value)}
              placeholder={form.tipo === 'cuota' ? 'Ej: Cuota 2 de 6' : form.tipo === 'cheque' ? 'Ej: Cheque N° 001234' : ''}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cheque extra */}
          {form.tipo === 'cheque' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">N° Cheque</label>
                <input type="text" value={form.numero_cheque} onChange={e => upd('numero_cheque', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Banco</label>
                <input type="text" value={form.banco} onChange={e => upd('banco', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => upd('notas', e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-700 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm disabled:opacity-60">
              {saving ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Fila expandible del cliente ──────────────────────────────────────────────

function ClienteRow({
  cliente, onNuevoCompromiso, onRefresh,
}: {
  cliente: ClienteResumen;
  onNuevoCompromiso: (id: string, nombre: string) => void;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [compromisos, setCompromisos] = useState<Compromiso[]>([]);
  const [loadingComp, setLoadingComp] = useState(false);

  const pct = cliente.total_presupuestado > 0
    ? Math.min(100, (cliente.total_cobrado / cliente.total_presupuestado) * 100)
    : 0;

  const nombre = nombreCliente(cliente);
  const saldo  = Number(cliente.saldo);
  const vencidos = Number(cliente.compromisos_vencidos ?? 0);

  async function toggleExpand() {
    if (!expanded && compromisos.length === 0) {
      setLoadingComp(true);
      try {
        const data = await api.get<Compromiso[]>(`/estado-cuenta/${cliente.id}/compromisos`);
        setCompromisos(data);
      } catch { /* silencioso */ }
      finally { setLoadingComp(false); }
    }
    setExpanded(e => !e);
  }

  async function cambiarEstadoCompromiso(id: string, estado: string) {
    try {
      await api.patch(`/estado-cuenta/compromisos/${id}`, { estado });
      setCompromisos(prev => prev.map(c => c.id === id ? { ...c, estado: estado as Compromiso['estado'] } : c));
      onRefresh();
      toast.success(`Compromiso marcado como ${estado}`);
    } catch { toast.error('Error al actualizar'); }
  }

  async function eliminarCompromiso(id: string) {
    try {
      await api.delete(`/estado-cuenta/compromisos/${id}`);
      setCompromisos(prev => prev.filter(c => c.id !== id));
      onRefresh();
      toast.success('Compromiso eliminado');
    } catch { toast.error('Error al eliminar'); }
  }

  return (
    <>
      {/* Fila principal */}
      <tr
        className={cn(
          'border-b transition-colors cursor-pointer select-none',
          expanded ? 'bg-blue-50 border-blue-100' : 'hover:bg-slate-50 border-slate-100'
        )}
        onClick={toggleExpand}
      >
        {/* Expand */}
        <td className="px-3 py-3 w-8">
          <span className="text-slate-400">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </td>

        {/* Cliente */}
        <td className="px-3 py-3">
          <div className="font-semibold text-slate-800 text-sm">{nombre}</div>
          {cliente.telefono && (
            <div className="text-xs text-slate-400 mt-0.5">{cliente.telefono}</div>
          )}
        </td>

        {/* Ops */}
        <td className="px-3 py-3 text-center">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
            {cliente.operaciones_count}
          </span>
        </td>

        {/* Presupuestado */}
        <td className="px-3 py-3 text-right">
          <span className="text-sm text-slate-700 font-medium">
            {formatCurrency(Number(cliente.total_presupuestado))}
          </span>
        </td>

        {/* Cobrado + barra */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-2 justify-end">
            <div className="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn('h-1.5 rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : 'bg-amber-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-slate-700 font-medium w-24 text-right">
              {formatCurrency(Number(cliente.total_cobrado))}
            </span>
          </div>
        </td>

        {/* Saldo */}
        <td className="px-3 py-3 text-right">
          <span className={cn(
            'text-sm font-bold',
            saldo <= 0 ? 'text-emerald-600' : saldo > 50000 ? 'text-red-600' : 'text-amber-600'
          )}>
            {formatCurrency(saldo)}
          </span>
        </td>

        {/* Compromisos */}
        <td className="px-3 py-3 text-right">
          {Number(cliente.compromisos_pendientes) > 0 ? (
            <div className="text-right">
              <span className={cn(
                'text-sm font-semibold',
                vencidos > 0 ? 'text-red-600' : 'text-blue-600'
              )}>
                {formatCurrency(Number(cliente.compromisos_pendientes))}
              </span>
              {vencidos > 0 && (
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <AlertTriangle size={10} className="text-red-500" />
                  <span className="text-[10px] text-red-500 font-medium">{vencidos} vencido{vencidos > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>

        {/* Próx. vencimiento */}
        <td className="px-3 py-3 text-center">
          {cliente.proximo_vencimiento ? (() => {
            const dias = diasHasta(cliente.proximo_vencimiento);
            const cls = dias < 0 ? 'bg-red-100 text-red-700' : dias <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
            const label = dias < 0 ? `Hace ${Math.abs(dias)}d` : dias === 0 ? 'Hoy' : `${dias}d`;
            return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', cls)}>{label}</span>;
          })() : <span className="text-xs text-slate-300">—</span>}
        </td>

        {/* Acciones */}
        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => onNuevoCompromiso(cliente.id, nombre)}
              title="Nuevo compromiso"
              className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors">
              <Plus size={14} />
            </button>
            <button
              onClick={() => navigate(`/clientes/${cliente.id}/estado-cuenta`)}
              title="Ver estado de cuenta detallado"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <ExternalLink size={14} />
            </button>
          </div>
        </td>
      </tr>

      {/* Fila expandida — compromisos */}
      {expanded && (
        <tr className="bg-blue-50/60 border-b border-blue-100">
          <td colSpan={9} className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                Compromisos de pago
              </h4>
              <button
                onClick={() => onNuevoCompromiso(cliente.id, nombre)}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                <Plus size={12} /> Nuevo compromiso
              </button>
            </div>

            {loadingComp ? (
              <p className="text-xs text-slate-400 py-2">Cargando...</p>
            ) : compromisos.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 italic">Sin compromisos registrados.</p>
            ) : (
              <div className="space-y-2">
                {compromisos.map(comp => {
                  const Icon = TIPO_ICON[comp.tipo] ?? Calendar;
                  const est  = ESTADO_COMPROMISO[comp.estado] ?? ESTADO_COMPROMISO.pendiente;
                  const dias = comp.estado === 'pendiente' ? diasHasta(comp.fecha_vencimiento) : null;
                  return (
                    <div key={comp.id} className={cn(
                      'flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border',
                      comp.estado === 'pendiente' && dias !== null && dias < 0
                        ? 'border-red-200' : 'border-slate-100'
                    )}>
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                        comp.estado === 'cobrado' ? 'bg-emerald-100' : comp.estado === 'rechazado' ? 'bg-red-100' : 'bg-blue-100'
                      )}>
                        <Icon size={13} className={
                          comp.estado === 'cobrado' ? 'text-emerald-600' : comp.estado === 'rechazado' ? 'text-red-500' : 'text-blue-600'
                        } />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {formatCurrency(Number(comp.monto))}
                          </span>
                          {comp.descripcion && (
                            <span className="text-xs text-slate-500">{comp.descripcion}</span>
                          )}
                          {comp.numero_cheque && (
                            <span className="text-xs text-slate-400">#{comp.numero_cheque}{comp.banco ? ` · ${comp.banco}` : ''}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{formatDate(comp.fecha_vencimiento)}</span>
                          {comp.operacion && (
                            <span className="text-xs text-slate-400">· Op. {comp.operacion.numero}</span>
                          )}
                        </div>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0', est.cls)}>
                        {est.label}
                      </span>
                      {comp.estado === 'pendiente' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => cambiarEstadoCompromiso(comp.id, 'cobrado')}
                            title="Marcar cobrado"
                            className="p-1.5 rounded-lg hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors">
                            <CheckCheck size={14} />
                          </button>
                          <button
                            onClick={() => cambiarEstadoCompromiso(comp.id, 'rechazado')}
                            title="Marcar rechazado"
                            className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors">
                            <XCircle size={14} />
                          </button>
                          <button
                            onClick={() => eliminarCompromiso(comp.id)}
                            title="Eliminar"
                            className="p-1.5 rounded-lg hover:bg-red-100 text-slate-300 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export function EstadoCuentaGlobal() {
  const [clientes, setClientes] = useState<ClienteResumen[]>([]);
  const [totales,  setTotales]  = useState<Totales | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [sort,     setSort]     = useState('saldo_desc');
  const [filtro,   setFiltro]   = useState('todos');

  // Modal
  const [modal, setModal] = useState<{ clienteId: string; nombre: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, filtro });
      if (search) params.set('search', search);
      const data = await api.get<{ clientes: ClienteResumen[]; totales: Totales }>(
        `/estado-cuenta?${params}`
      );
      setClientes(data.clientes);
      setTotales(data.totales);
    } catch { toast.error('Error al cargar estado de cuenta'); }
    finally { setLoading(false); }
  }, [sort, filtro, search]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  function SortBtn({ value, label }: { value: string; label: string }) {
    return (
      <button
        onClick={() => setSort(value)}
        className={cn(
          'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
          sort === value ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
        )}>
        {label}
      </button>
    );
  }

  function FiltroBtn({ value, label }: { value: string; label: string }) {
    return (
      <button
        onClick={() => setFiltro(value)}
        className={cn(
          'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
          filtro === value ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
        )}>
        {label}
      </button>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Estado de Cuenta</h1>
          <p className="text-sm text-slate-500 mt-0.5">Clientes con actividad económica · Compromisos y saldos</p>
        </div>
      </div>

      {/* KPIs */}
      {totales && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
                <TrendingDown size={16} className="text-red-500" />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saldo total</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totales.saldo)}</p>
            <p className="text-xs text-slate-400 mt-1">{totales.clientes_con_saldo} clientes con deuda</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                <TrendingUp size={16} className="text-emerald-500" />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total cobrado</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totales.cobrado)}</p>
            <p className="text-xs text-slate-400 mt-1">
              {totales.presupuestado > 0
                ? `${Math.round((totales.cobrado / totales.presupuestado) * 100)}% del presupuestado`
                : '—'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
                <Calendar size={16} className="text-blue-500" />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Comprometido</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totales.compromisos)}</p>
            <p className="text-xs text-slate-400 mt-1">Cuotas y cheques pendientes</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center',
                totales.compromisos_vencidos > 0 ? 'bg-red-50' : 'bg-slate-50')}>
                <AlertTriangle size={16} className={totales.compromisos_vencidos > 0 ? 'text-red-500' : 'text-slate-300'} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vencidos</span>
            </div>
            <p className={cn('text-2xl font-bold', totales.compromisos_vencidos > 0 ? 'text-red-600' : 'text-slate-300')}>
              {totales.compromisos_vencidos}
            </p>
            <p className="text-xs text-slate-400 mt-1">Compromisos sin cobrar</p>
          </div>
        </div>
      )}

      {/* Barra de controles */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-slate-400 font-medium"><Filter size={11} /> Filtrar:</span>
            <FiltroBtn value="todos"           label="Todos" />
            <FiltroBtn value="con_saldo"       label="Con saldo" />
            <FiltroBtn value="con_compromisos" label="Con compromisos" />
            <FiltroBtn value="saldados"        label="Saldados" />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-slate-400 font-medium"><ArrowUpDown size={11} /> Ordenar:</span>
            <SortBtn value="saldo_desc"  label="Mayor deuda" />
            <SortBtn value="saldo_asc"   label="Menor deuda" />
            <SortBtn value="vencimiento" label="Vencimiento" />
            <SortBtn value="actividad"   label="Actividad" />
            <SortBtn value="nombre"      label="Nombre" />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Cargando...</div>
        ) : clientes.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={36} className="mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500 font-medium">Sin clientes con actividad</p>
            <p className="text-xs text-slate-400 mt-1">Cambiá el filtro o revisá que haya operaciones cargadas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="w-8" />
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">Ops.</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Presupuestado</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cobrado</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <span className="flex items-center justify-end gap-1"><DollarSign size={11} />Saldo</span>
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comprometido</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Próx. vcto.</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {clientes.map(c => (
                  <ClienteRow
                    key={c.id}
                    cliente={c}
                    onNuevoCompromiso={(id, nombre) => setModal({ clienteId: id, nombre })}
                    onRefresh={load}
                  />
                ))}
              </tbody>
            </table>

            {/* Footer totales */}
            {totales && clientes.length > 1 && (
              <div className="flex items-center justify-end gap-8 px-4 py-3 bg-slate-50 border-t border-slate-100 text-sm">
                <span className="text-xs text-slate-500">{clientes.length} clientes</span>
                <span className="font-semibold text-slate-600">{formatCurrency(totales.presupuestado)}</span>
                <span className="font-semibold text-emerald-600 w-36 text-right">{formatCurrency(totales.cobrado)}</span>
                <span className={cn('font-bold w-24 text-right', totales.saldo > 0 ? 'text-red-600' : 'text-emerald-600')}>
                  {formatCurrency(totales.saldo)}
                </span>
                <span className="font-semibold text-blue-600 w-28 text-right">{formatCurrency(totales.compromisos)}</span>
                <span className="w-20" />
                <span className="w-20" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ModalNuevoCompromiso
          clienteId={modal.clienteId}
          clienteNombre={modal.nombre}
          onClose={() => setModal(null)}
          onCreated={load}
        />
      )}
    </div>
  );
}
