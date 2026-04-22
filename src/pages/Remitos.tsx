import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Plus, Search, RefreshCw, Package, MapPin,
  CheckCircle2, Clock, XCircle, FileEdit, Trash2,
  ChevronRight, AlertTriangle, Calendar, Hash
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ── Tipos ─────────────────────────────────────────────────────
interface Remito {
  id: string;
  numero: string;
  estado: 'borrador' | 'emitido' | 'entregado' | 'cancelado';
  medio_envio: string;
  transportista: string | null;
  nro_seguimiento: string | null;
  direccion_entrega: string | null;
  fecha_emision: string;
  fecha_entrega_est: string | null;
  fecha_entrega_real: string | null;
  notas: string | null;
  stock_descontado: boolean;
  cliente: {
    id: string; nombre: string | null; apellido: string | null;
    razon_social: string | null; tipo_persona: string; telefono: string | null;
  };
  operacion: { id: string; numero: string; tipo: string } | null;
}

interface Conteos {
  borrador: number; emitido: number; entregado: number; cancelado: number;
}

// ── Helpers ───────────────────────────────────────────────────
const ESTADOS = {
  borrador:  { label: 'Borrador',  icon: FileEdit,     color: 'text-gray-600',    bg: 'bg-gray-100',    border: 'border-gray-200'  },
  emitido:   { label: 'Emitido',   icon: Clock,        color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-200'  },
  entregado: { label: 'Entregado', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200'},
  cancelado: { label: 'Cancelado', icon: XCircle,      color: 'text-red-500',     bg: 'bg-red-50',      border: 'border-red-200'   },
} as const;

const MEDIOS_LABEL: Record<string, string> = {
  retiro_local:     'Retiro en local',
  encomienda:       'Encomienda',
  flete_propio:     'Flete propio',
  flete_tercero:    'Flete tercerizado',
  correo_argentino: 'Correo Argentino',
  otro:             'Otro',
};

function clienteLabel(r: Remito) {
  const c = r.cliente;
  return c.tipo_persona === 'juridica'
    ? c.razon_social ?? ''
    : `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim();
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ── Modal de cambio de estado ─────────────────────────────────
function ModalEstado({
  remito, onClose, onSaved
}: { remito: Remito; onClose: () => void; onSaved: () => void }) {
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [fechaReal, setFechaReal]     = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving]           = useState(false);

  const TRANSICIONES: Record<string, { value: string; label: string; desc: string; color: string }[]> = {
    borrador: [
      { value: 'emitido',   label: 'Emitir remito',   desc: 'Descuenta stock automáticamente', color: 'border-blue-300 bg-blue-50 text-blue-700' },
      { value: 'cancelado', label: 'Cancelar',         desc: 'Sin efecto en stock',              color: 'border-red-300 bg-red-50 text-red-700'   },
    ],
    emitido: [
      { value: 'entregado', label: 'Marcar entregado', desc: 'Confirma la entrega',              color: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
      { value: 'cancelado', label: 'Cancelar',         desc: 'Revierte stock descontado',        color: 'border-red-300 bg-red-50 text-red-700' },
    ],
    entregado: [
      { value: 'cancelado', label: 'Cancelar',         desc: 'Revierte stock y marca cancelado', color: 'border-red-300 bg-red-50 text-red-700' },
    ],
  };

  const opciones = TRANSICIONES[remito.estado] ?? [];

  async function handleConfirm() {
    if (!nuevoEstado) { toast.error('Seleccioná un nuevo estado'); return; }
    setSaving(true);
    try {
      await api.patch(`/remitos/${remito.id}/estado`, {
        estado: nuevoEstado,
        fecha_entrega_real: nuevoEstado === 'entregado' ? fechaReal : undefined,
      });
      toast.success('Estado actualizado');
      onSaved();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Error');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Cambiar estado</h2>
          <p className="text-xs text-gray-500 mt-0.5">Remito {remito.numero}</p>
        </div>
        <div className="p-5 space-y-2">
          {opciones.map(op => (
            <button key={op.value} onClick={() => setNuevoEstado(op.value)}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                nuevoEstado === op.value ? op.color : 'border-gray-100 hover:border-gray-200'
              }`}>
              <p className="font-medium text-sm">{op.label}</p>
              <p className="text-xs opacity-70 mt-0.5">{op.desc}</p>
            </button>
          ))}

          {nuevoEstado === 'entregado' && (
            <div className="pt-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de entrega real</label>
              <input type="date" value={fechaReal} onChange={e => setFechaReal(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          )}

          {nuevoEstado === 'emitido' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 border border-amber-200">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
              Se descontará el stock de los ítems con producto vinculado.
            </div>
          )}

          {nuevoEstado === 'cancelado' && remito.stock_descontado && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 border border-amber-200">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
              Se revertirá el stock descontado al emitir.
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving || !nuevoEstado}
            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de remito ─────────────────────────────────────────
function RemitoCard({
  remito, onEstado, onEdit, onDelete
}: {
  remito: Remito;
  onEstado: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const est = ESTADOS[remito.estado];
  const EstIcon = est.icon;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${est.border}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-gray-900 text-sm">{remito.numero}</span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${est.bg} ${est.color}`}>
                <EstIcon size={10} /> {est.label}
              </span>
            </div>
            <p className="font-semibold text-gray-800 mt-0.5">{clienteLabel(remito)}</p>
            {remito.cliente.telefono && (
              <p className="text-xs text-gray-400">{remito.cliente.telefono}</p>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400">{fmtFecha(remito.fecha_emision)}</p>
            {remito.operacion && (
              <p className="text-xs text-gray-400 mt-0.5">Op. {remito.operacion.numero}</p>
            )}
          </div>
        </div>

        {/* Envío */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
            <Truck size={11} />
            {MEDIOS_LABEL[remito.medio_envio] ?? remito.medio_envio}
          </span>
          {remito.transportista && (
            <span className="text-xs text-gray-500">{remito.transportista}</span>
          )}
          {remito.nro_seguimiento && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Hash size={10} /> {remito.nro_seguimiento}
            </span>
          )}
          {remito.direccion_entrega && (
            <span className="flex items-center gap-1 text-xs text-gray-400 truncate max-w-[180px]">
              <MapPin size={10} /> {remito.direccion_entrega}
            </span>
          )}
        </div>

        {remito.fecha_entrega_est && remito.estado !== 'entregado' && remito.estado !== 'cancelado' && (
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
            <Calendar size={10} /> Entrega est.: {fmtFecha(remito.fecha_entrega_est)}
          </div>
        )}
        {remito.fecha_entrega_real && (
          <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
            <CheckCircle2 size={10} /> Entregado: {fmtFecha(remito.fecha_entrega_real)}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 px-4 pb-3">
        {remito.estado !== 'cancelado' && remito.estado !== 'entregado' && (
          <button onClick={onEstado}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium">
            <ChevronRight size={12} /> Avanzar estado
          </button>
        )}
        {remito.estado === 'borrador' && (
          <button onClick={onEdit}
            className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg">
            <FileEdit size={14} />
          </button>
        )}
        {remito.estado === 'borrador' && (
          <button onClick={onDelete}
            className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg">
            <Trash2 size={14} />
          </button>
        )}
        {(remito.estado === 'emitido' || remito.estado === 'entregado') && (
          <button onClick={onEstado}
            className="ml-auto p-1.5 hover:bg-gray-100 text-gray-400 rounded-lg" title="Cancelar remito">
            <XCircle size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export function Remitos() {
  const navigate = useNavigate();
  const [remitos, setRemitos]   = useState<Remito[]>([]);
  const [conteos, setConteos]   = useState<Conteos>({ borrador: 0, emitido: 0, entregado: 0, cancelado: 0 });
  const [filtro, setFiltro]     = useState<string>('todos');
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [estadoModal, setEstadoModal] = useState<Remito | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ estado: filtro === 'todos' ? '' : filtro, search }).toString();
      const [data, cnt] = await Promise.all([
        api.get<Remito[]>(`/remitos?${qs}`),
        api.get<Conteos>('/remitos/conteos'),
      ]);
      setRemitos(data);
      setConteos(cnt);
    } finally {
      setLoading(false);
    }
  }, [filtro, search]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleDelete(remito: Remito) {
    if (!window.confirm(`¿Eliminar remito ${remito.numero}?`)) return;
    try {
      await api.delete(`/remitos/${remito.id}`);
      toast.success('Remito eliminado');
      cargar();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Error');
    }
  }

  const FILTROS = [
    { key: 'todos',     label: 'Todos',     count: Object.values(conteos).reduce((a, b) => a + b, 0) },
    { key: 'borrador',  label: 'Borrador',  count: conteos.borrador  },
    { key: 'emitido',   label: 'Emitidos',  count: conteos.emitido   },
    { key: 'entregado', label: 'Entregados',count: conteos.entregado },
    { key: 'cancelado', label: 'Cancelados',count: conteos.cancelado },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
            <Truck size={20} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Remitos</h1>
            <p className="text-sm text-gray-500">
              {conteos.emitido > 0 && <>{conteos.emitido} emitido{conteos.emitido > 1 ? 's' : ''} · </>}
              {conteos.borrador > 0 && <>{conteos.borrador} borrador{conteos.borrador > 1 ? 'es' : ''}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => navigate('/remitos/nuevo')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold">
            <Plus size={14} /> Nuevo remito
          </button>
        </div>
      </div>

      {/* Buscador + filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número o cliente..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filtro === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {f.label}
              {f.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                  filtro === f.key ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'
                }`}>{f.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin text-gray-400" />
        </div>
      ) : remitos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <Package size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">
            {search || filtro !== 'todos' ? 'Sin resultados para ese filtro' : 'No hay remitos todavía'}
          </p>
          {filtro !== 'todos' && (
            <button onClick={() => setFiltro('todos')} className="mt-3 text-xs text-teal-600 hover:underline">
              Ver todos
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {remitos.map(r => (
            <RemitoCard
              key={r.id}
              remito={r}
              onEstado={() => setEstadoModal(r)}
              onEdit={() => navigate(`/remitos/${r.id}/editar`)}
              onDelete={() => handleDelete(r)}
            />
          ))}
        </div>
      )}

      {estadoModal && (
        <ModalEstado
          remito={estadoModal}
          onClose={() => setEstadoModal(null)}
          onSaved={() => { setEstadoModal(null); cargar(); }}
        />
      )}
    </div>
  );
}
