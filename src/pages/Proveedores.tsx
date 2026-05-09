import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Truck, Plus, Pencil, Check, X, ToggleLeft, ToggleRight, Globe,
  MapPin, Hash, Search, Star, AlertTriangle, TrendingUp, TrendingDown,
  RefreshCw, Phone, Mail, Package, ChevronLeft, ChevronRight,
  ShoppingCart, DollarSign, Clock, BarChart2, Zap
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Tipos ─────────────────────────────────────────────────────
interface Proveedor {
  id: string; nombre: string; tipo: string | null; contacto: string | null;
  telefono: string | null; email: string | null; cuit: string | null;
  direccion: string | null; localidad: string | null; provincia: string | null;
  web: string | null; materiales: string[]; notas: string | null; activo: boolean;
  forma_entrega: 'propia' | 'tercerizada' | 'retiro' | null;
  plazo_entrega_dias: number | null;
  costo_flete: number;
  calificacion: number | null;
  deuda_actual: number;
  es_principal: boolean;
  created_at: string;
  // computed from compras
  lotes_count_6m: number;
  compras_monto_6m: number;
  lotes_count_30d: number;
  ultima_compra_fecha: string | null;
  dias_sin_compra: number;
}

interface TableroData {
  proveedores: Proveedor[];
  stats: {
    activos_count: number;
    total_count: number;
    deuda_total: number;
    prom_plazo_dias: number;
    compras_mes_actual: number;
    tendencia_compras: number;
    forma_entrega_counts: Record<string, number>;
  };
  alertas: {
    con_deuda: Proveedor[];
    sin_actividad: Proveedor[];
    baja_calif: Proveedor[];
  };
  top_proveedores: Proveedor[];
  compras_por_rubro: { rubro: string; total_compras: number; cant_lotes: number }[];
}

type FormData = Omit<Proveedor, 'id' | 'activo' | 'created_at' | 'lotes_count_6m' | 'compras_monto_6m' | 'lotes_count_30d' | 'ultima_compra_fecha' | 'dias_sin_compra'>;

type FiltroTab = 'todos' | 'principales' | 'con_deuda' | 'mas_usados' | 'sin_actividad';

// ── Constantes ─────────────────────────────────────────────────
const PER_PAGE = 10;

const TIPO_PROVEEDOR = ['Fabricante', 'Revendedor', 'Importador'];
const MATERIALES_OPTS = ['Aluminio', 'PVC', 'Vidrio', 'Herrajes', 'Mosquiteros', 'Persianas', 'Portones', 'Otros'];

const TIPO_COLORS: Record<string, string> = {
  Fabricante: 'bg-violet-100 text-violet-700',
  Revendedor: 'bg-sky-100 text-sky-700',
  Importador: 'bg-amber-100 text-amber-700',
};

const ENTREGA_CFG: Record<string, { label: string; bg: string; text: string }> = {
  propia:      { label: 'Entrega propia',    bg: 'bg-emerald-100', text: 'text-emerald-700' },
  tercerizada: { label: 'Tercerizada',       bg: 'bg-blue-100',    text: 'text-blue-700' },
  retiro:      { label: 'Retiro en fábrica', bg: 'bg-gray-100',    text: 'text-gray-600' },
};

const CALIF_CFG: Record<number, { label: string; text: string }> = {
  5: { label: 'Excelente', text: 'text-emerald-600' },
  4: { label: 'Muy bueno', text: 'text-green-600' },
  3: { label: 'Bueno',     text: 'text-blue-600' },
  2: { label: 'Regular',   text: 'text-amber-600' },
  1: { label: 'Malo',      text: 'text-red-600' },
};

function initials(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
];
function avatarColor(nombre: string) {
  const code = nombre.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function fmtMonto(n: number) {
  return `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDias(n: number) {
  if (n === 999) return 'Nunca';
  if (n === 0)   return 'Hoy';
  if (n === 1)   return 'Ayer';
  return `Hace ${n}d`;
}

function emptyForm(): FormData {
  return {
    nombre: '', tipo: null, contacto: null, telefono: null, email: null,
    cuit: null, direccion: null, localidad: null, provincia: null, web: null,
    materiales: [], notas: null,
    forma_entrega: 'propia', plazo_entrega_dias: null,
    costo_flete: 0, calificacion: null, deuda_actual: 0, es_principal: false,
  };
}

// ── DonutChart ────────────────────────────────────────────────
function DonutChart({ segments, size = 80 }: { segments: { value: number; color: string }[]; size?: number }) {
  const r     = size * 0.37;
  const circ  = 2 * Math.PI * r;
  const cx    = size / 2;
  const cy    = size / 2;
  const total = segments.reduce((s, g) => s + g.value, 0);

  if (total === 0) return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.12} />
    </svg>
  );

  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((seg, i) => {
        const pct  = seg.value / total;
        const dash = pct * circ;
        const el   = (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={size * 0.12}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-(cumulative * circ)}
          />
        );
        cumulative += pct;
        return el;
      })}
    </svg>
  );
}

// ── StarRating ────────────────────────────────────────────────
function StarRating({ value, onChange, size = 14 }: { value: number | null; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button"
          onClick={() => onChange?.(i === value ? 0 : i)}
          className={cn('transition-colors', onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default')}>
          <Star size={size} className={i <= (value ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-100'} />
        </button>
      ))}
    </div>
  );
}

// ── ModalProveedor ────────────────────────────────────────────
function ModalProveedor({
  initial, title, onSave, onClose
}: {
  initial: FormData;
  title: string;
  onSave: (vals: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const [saving, setSaving] = useState(false);

  function set(field: keyof FormData, value: unknown) { setForm(p => ({ ...p, [field]: value })); }
  function toggleMat(mat: string) {
    setForm(p => ({ ...p, materiales: p.materiales.includes(mat) ? p.materiales.filter(m => m !== mat) : [...p.materiales, mat] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error('Nombre requerido'); return; }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white';
  const lbl = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Truck size={18} className="text-amber-600" />
            </div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Datos básicos */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datos generales</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Nombre / Razón social *</label>
                <input required type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
                  className={inp} placeholder="Ej: Aluminios del Norte S.A." autoFocus />
              </div>
              <div>
                <label className={lbl}>Tipo</label>
                <select value={form.tipo ?? ''} onChange={e => set('tipo', e.target.value || null)} className={inp}>
                  <option value="">— Sin especificar —</option>
                  {TIPO_PROVEEDOR.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className={lbl}>Contacto</label>
                <input type="text" value={form.contacto ?? ''} onChange={e => set('contacto', e.target.value || null)}
                  className={inp} placeholder="Nombre vendedor / rep." />
              </div>
              <div>
                <label className={lbl}>Teléfono</label>
                <input type="text" value={form.telefono ?? ''} onChange={e => set('telefono', e.target.value || null)}
                  className={inp} placeholder="+54 9 11 1234-5678" />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value || null)}
                  className={inp} placeholder="ventas@proveedor.com" />
              </div>
              <div>
                <label className={lbl}>CUIT</label>
                <input type="text" value={form.cuit ?? ''} onChange={e => set('cuit', e.target.value || null)}
                  className={inp} placeholder="30-12345678-9" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className={lbl}>Dirección</label>
                <input type="text" value={form.direccion ?? ''} onChange={e => set('direccion', e.target.value || null)}
                  className={inp} placeholder="Calle y número" />
              </div>
              <div>
                <label className={lbl}>Localidad</label>
                <input type="text" value={form.localidad ?? ''} onChange={e => set('localidad', e.target.value || null)}
                  className={inp} placeholder="Ciudad" />
              </div>
              <div>
                <label className={lbl}>Provincia</label>
                <input type="text" value={form.provincia ?? ''} onChange={e => set('provincia', e.target.value || null)}
                  className={inp} placeholder="Buenos Aires" />
              </div>
            </div>

            <div className="mt-3">
              <label className={lbl}>Sitio web</label>
              <input type="url" value={form.web ?? ''} onChange={e => set('web', e.target.value || null)}
                className={inp} placeholder="https://www.proveedor.com" />
            </div>
          </div>

          {/* Materiales */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Rubros / Materiales</p>
            <div className="flex flex-wrap gap-2">
              {MATERIALES_OPTS.map(mat => (
                <button key={mat} type="button" onClick={() => toggleMat(mat)}
                  className={cn('px-3 py-1 text-xs rounded-full border font-medium transition-colors',
                    form.materiales.includes(mat)
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  )}>
                  {mat}
                </button>
              ))}
            </div>
          </div>

          {/* Logística */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Logística y entrega</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Forma de entrega</label>
                <select value={form.forma_entrega ?? 'propia'} onChange={e => set('forma_entrega', e.target.value)} className={inp}>
                  <option value="propia">Entrega propia</option>
                  <option value="tercerizada">Tercerizada</option>
                  <option value="retiro">Retiro en fábrica</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Plazo entrega (días)</label>
                <input type="number" min="0" value={form.plazo_entrega_dias ?? ''} onChange={e => set('plazo_entrega_dias', e.target.value ? parseInt(e.target.value) : null)}
                  className={inp} placeholder="Ej: 5" />
              </div>
              <div>
                <label className={lbl}>Costo flete ($)</label>
                <input type="number" min="0" value={form.costo_flete || ''} onChange={e => set('costo_flete', parseFloat(e.target.value) || 0)}
                  className={inp} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Evaluación + deuda */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Evaluación y finanzas</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Calificación</label>
                <div className="flex items-center gap-3 mt-1">
                  <StarRating value={form.calificacion} onChange={v => set('calificacion', v || null)} size={20} />
                  {form.calificacion && (
                    <span className={cn('text-sm font-medium', CALIF_CFG[form.calificacion]?.text)}>
                      {CALIF_CFG[form.calificacion]?.label}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className={lbl}>Deuda actual ($)</label>
                <input type="number" min="0" value={form.deuda_actual || ''} onChange={e => set('deuda_actual', parseFloat(e.target.value) || 0)}
                  className={inp} placeholder="0" />
              </div>
            </div>
            <div className="mt-3">
              <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                <div className={cn('w-10 h-5 rounded-full transition-colors relative', form.es_principal ? 'bg-amber-500' : 'bg-gray-200')}
                  onClick={() => set('es_principal', !form.es_principal)}>
                  <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    form.es_principal ? 'translate-x-5' : 'translate-x-0.5')} />
                </div>
                <span className="text-sm font-medium text-gray-700">Proveedor principal</span>
              </label>
              <p className="text-xs text-gray-400 mt-0.5 ml-12">Aparece destacado en el panel</p>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className={lbl}>Notas internas</label>
            <textarea value={form.notas ?? ''} onChange={e => set('notas', e.target.value || null)}
              rows={2} className={inp + ' resize-none'}
              placeholder="Condiciones comerciales, plazos, descuentos..." />
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm rounded-xl font-semibold shadow-sm">
              <Check size={14} /> {saving ? 'Guardando...' : 'Guardar proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ProveedorRow ──────────────────────────────────────────────
function ProveedorRow({
  prov, onEdit, onToggle
}: {
  prov: Proveedor;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const entregaCfg = ENTREGA_CFG[prov.forma_entrega ?? 'propia'];
  const califCfg   = prov.calificacion ? CALIF_CFG[prov.calificacion] : null;
  const color      = avatarColor(prov.nombre);

  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-100 shadow-sm border-l-4 transition-opacity',
      prov.es_principal ? 'border-l-amber-400' : 'border-l-gray-200',
      !prov.activo && 'opacity-50'
    )}>
      <div className="grid items-center gap-3 px-4 py-3"
        style={{ gridTemplateColumns: '1fr 110px 110px 110px 120px 90px 80px 80px' }}>

        {/* Proveedor */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0', color)}>
            {initials(prov.nombre)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-gray-900 truncate">{prov.nombre}</span>
              {prov.es_principal && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Principal</span>
              )}
              {prov.tipo && (
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', TIPO_COLORS[prov.tipo] ?? 'bg-gray-100 text-gray-500')}>
                  {prov.tipo}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              {prov.contacto && <span className="truncate">{prov.contacto}</span>}
              {prov.localidad && <span className="flex items-center gap-0.5 flex-shrink-0"><MapPin size={9} />{prov.localidad}</span>}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {(prov.materiales ?? []).slice(0, 3).map(m => (
                <span key={m} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md">{m}</span>
              ))}
              {(prov.materiales ?? []).length > 3 && (
                <span className="text-[10px] text-gray-400">+{prov.materiales.length - 3}</span>
              )}
            </div>
          </div>
        </div>

        {/* Compras 6m */}
        <div className="text-right">
          {prov.lotes_count_6m > 0 ? (
            <>
              <p className="text-sm font-bold text-gray-900">{fmtMonto(prov.compras_monto_6m)}</p>
              <p className="text-[10px] text-gray-400">{prov.lotes_count_6m} compras</p>
            </>
          ) : (
            <p className="text-xs text-gray-300 italic">Sin compras</p>
          )}
        </div>

        {/* Deuda */}
        <div className="text-right">
          {prov.deuda_actual > 0 ? (
            <>
              <p className="text-sm font-bold text-red-600">{fmtMonto(prov.deuda_actual)}</p>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Pendiente</span>
            </>
          ) : (
            <span className="text-xs font-medium text-emerald-600">Al día</span>
          )}
        </div>

        {/* Logística */}
        <div className="text-right">
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', entregaCfg.bg, entregaCfg.text)}>
            {entregaCfg.label}
          </span>
          {prov.plazo_entrega_dias && (
            <p className="text-[10px] text-gray-400 mt-0.5">Prom. {prov.plazo_entrega_dias}d</p>
          )}
          {prov.costo_flete > 0 && (
            <p className="text-[10px] text-gray-400">{fmtMonto(prov.costo_flete)}</p>
          )}
        </div>

        {/* Desempeño */}
        <div className="text-center">
          {prov.calificacion ? (
            <>
              <StarRating value={prov.calificacion} size={11} />
              <p className={cn('text-[10px] font-semibold mt-0.5', califCfg?.text)}>{califCfg?.label}</p>
            </>
          ) : (
            <p className="text-[10px] text-gray-300 italic">Sin evaluar</p>
          )}
        </div>

        {/* Última compra */}
        <div className="text-center">
          <p className="text-xs font-medium text-gray-700">
            {prov.ultima_compra_fecha
              ? new Date(prov.ultima_compra_fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
              : '—'}
          </p>
          <p className="text-[10px] text-gray-400">{fmtDias(prov.dias_sin_compra)}</p>
        </div>

        {/* Acciones contacto */}
        <div className="flex items-center justify-center gap-1">
          {prov.telefono && (
            <a href={`https://wa.me/${prov.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg" title="WhatsApp">
              <Phone size={13} />
            </a>
          )}
          {prov.email && (
            <a href={`mailto:${prov.email}`}
              className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg" title="Email">
              <Mail size={13} />
            </a>
          )}
          {prov.web && (
            <a href={prov.web} target="_blank" rel="noopener noreferrer"
              className="p-1.5 hover:bg-gray-100 text-gray-400 rounded-lg" title="Web">
              <Globe size={13} />
            </a>
          )}
        </div>

        {/* Editar / toggle */}
        <div className="flex items-center justify-end gap-1">
          <button onClick={onEdit} className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg" title="Editar">
            <Pencil size={13} />
          </button>
          <button onClick={onToggle} className="p-1.5 hover:bg-gray-100 text-gray-400 rounded-lg"
            title={prov.activo ? 'Desactivar' : 'Activar'}>
            {prov.activo
              ? <ToggleRight size={16} className="text-green-500" />
              : <ToggleLeft size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export function Proveedores() {
  const [tablero, setTablero]   = useState<TableroData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState<FiltroTab>('todos');
  const [search, setSearch]     = useState('');
  const [soloActivos, setSoloActivos] = useState(true);
  const [page, setPage]         = useState(1);
  const [modal, setModal]       = useState<'nuevo' | string | null>(null); // null | 'nuevo' | id para editar

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<TableroData>('/catalogo/proveedores/tablero');
      setTablero(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPage(1); }, [filtro, search, soloActivos]);

  async function handleSave(vals: FormData) {
    if (modal === 'nuevo') {
      await api.post('/catalogo/proveedores', vals);
      toast.success('Proveedor agregado');
    } else {
      const item = tablero!.proveedores.find(p => p.id === modal)!;
      await api.put(`/catalogo/proveedores/${modal}`, { ...vals, activo: item.activo });
      toast.success('Proveedor actualizado');
    }
    setModal(null);
    cargar();
  }

  async function toggleActivo(prov: Proveedor) {
    await api.put(`/catalogo/proveedores/${prov.id}`, { ...prov, activo: !prov.activo });
    cargar();
  }

  const editingProv = modal && modal !== 'nuevo'
    ? tablero?.proveedores.find(p => p.id === modal)
    : null;

  // Lista filtrada
  const filtered = useMemo(() => {
    let list = tablero?.proveedores ?? [];
    if (soloActivos) list = list.filter(p => p.activo);

    if (filtro === 'principales')   list = list.filter(p => p.es_principal);
    if (filtro === 'con_deuda')     list = list.filter(p => p.deuda_actual > 0);
    if (filtro === 'mas_usados')    list = [...list].sort((a, b) => b.lotes_count_6m - a.lotes_count_6m).filter(p => p.lotes_count_6m > 0);
    if (filtro === 'sin_actividad') list = list.filter(p => p.dias_sin_compra > 90);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.contacto ?? '').toLowerCase().includes(q) ||
        (p.localidad ?? '').toLowerCase().includes(q) ||
        (p.materiales ?? []).some(m => m.toLowerCase().includes(q))
      );
    }
    return list;
  }, [tablero, filtro, search, soloActivos]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats     = tablero?.stats;
  const alertas   = tablero?.alertas;
  const fe        = stats?.forma_entrega_counts ?? {};
  const feTotal   = Object.values(fe).reduce((s, n) => s + n, 0);

  const FILTROS: { key: FiltroTab; label: string; count: number }[] = [
    { key: 'todos',        label: 'Todos',          count: (tablero?.proveedores ?? []).filter(p => p.activo).length },
    { key: 'principales',  label: 'Principales',    count: (tablero?.proveedores ?? []).filter(p => p.activo && p.es_principal).length },
    { key: 'con_deuda',    label: 'Con deuda',      count: (tablero?.proveedores ?? []).filter(p => p.activo && p.deuda_actual > 0).length },
    { key: 'mas_usados',   label: 'Más usados',     count: (tablero?.proveedores ?? []).filter(p => p.activo && p.lotes_count_6m > 0).length },
    { key: 'sin_actividad',label: 'Sin actividad',  count: (tablero?.proveedores ?? []).filter(p => p.activo && p.dias_sin_compra > 90).length },
  ];

  const hayAlertas = (alertas?.con_deuda.length ?? 0) + (alertas?.sin_actividad.length ?? 0) + (alertas?.baja_calif.length ?? 0) > 0;

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Truck size={20} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Proveedores + Logística</h1>
            <p className="text-sm text-gray-500">Gestión de proveedores, compras y transporte</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setModal('nuevo')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-sm">
            <Plus size={15} /> Nuevo proveedor
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-2">
              <Truck size={15} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.activos_count}</p>
            <p className="text-xs text-gray-500 mt-0.5">Proveedores activos</p>
            <p className="text-[10px] text-gray-400">de {stats.total_count} totales</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
              <ShoppingCart size={15} className="text-blue-600" />
            </div>
            <p className="text-lg font-bold text-blue-600 leading-tight">{fmtMonto(stats.compras_mes_actual)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Compras (mes actual)</p>
            {stats.tendencia_compras !== 0 && (
              <div className={cn('flex items-center gap-1 text-[10px] font-medium mt-0.5',
                stats.tendencia_compras > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                {stats.tendencia_compras > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(stats.tendencia_compras)}% vs mes anterior
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <DollarSign size={15} className="text-red-600" />
              </div>
              {stats.deuda_total > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </div>
            <p className="text-lg font-bold text-red-600 leading-tight">{fmtMonto(stats.deuda_total)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Deuda total</p>
            <p className="text-[10px] text-gray-400">{FILTROS.find(f => f.key === 'con_deuda')?.count ?? 0} proveedores</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center mb-2">
              <Clock size={15} className="text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.prom_plazo_dias || '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Días promedio entrega</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
              <BarChart2 size={15} className="text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {feTotal > 0 ? Math.round((fe.propia ?? 0) / feTotal * 100) : 0}%
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Entrega propia</p>
          </div>
        </div>
      )}

      {/* 2-col: main + sidebar */}
      <div className="flex gap-5 items-start">

        {/* ── Main ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Alertas */}
          {hayAlertas && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertTriangle size={12} /> Alertas importantes
              </p>
              <div className="space-y-2">
                {(alertas?.con_deuda.length ?? 0) > 0 && (
                  <button onClick={() => setFiltro('con_deuda')}
                    className="w-full flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-red-100 hover:border-red-300 text-left">
                    <DollarSign size={14} className="text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {alertas!.con_deuda.length} proveedor{alertas!.con_deuda.length > 1 ? 'es' : ''} con deuda pendiente
                      </p>
                      <p className="text-xs text-gray-500">
                        Total: {fmtMonto(alertas!.con_deuda.reduce((s, p) => s + p.deuda_actual, 0))} · {alertas!.con_deuda.map(p => p.nombre).join(', ')}
                      </p>
                    </div>
                    <span className="text-xs text-red-600 font-medium flex-shrink-0">Ver deudas →</span>
                  </button>
                )}
                {(alertas?.sin_actividad.length ?? 0) > 0 && (
                  <button onClick={() => setFiltro('sin_actividad')}
                    className="w-full flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-amber-100 hover:border-amber-300 text-left">
                    <Clock size={14} className="text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {alertas!.sin_actividad.length} proveedor{alertas!.sin_actividad.length > 1 ? 'es' : ''} sin actividad (+90 días)
                      </p>
                      <p className="text-xs text-gray-500">{alertas!.sin_actividad.map(p => p.nombre).join(', ')}</p>
                    </div>
                    <span className="text-xs text-amber-600 font-medium flex-shrink-0">Ver inactivos →</span>
                  </button>
                )}
                {(alertas?.baja_calif.length ?? 0) > 0 && (
                  <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-gray-100">
                    <Star size={14} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {alertas!.baja_calif.length} proveedor{alertas!.baja_calif.length > 1 ? 'es' : ''} con baja calificación
                      </p>
                      <p className="text-xs text-gray-500">{alertas!.baja_calif.map(p => p.nombre).join(', ')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Controles */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, ciudad, material..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
            </div>
            <button onClick={() => setSoloActivos(v => !v)}
              className={cn('px-3 py-2.5 text-sm rounded-xl border font-medium transition-colors flex-shrink-0',
                soloActivos ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-500')}>
              {soloActivos ? 'Solo activos' : 'Todos'}
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filtro === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {f.label}
                {f.count > 0 && (
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                    filtro === f.key ? 'bg-gray-100 text-gray-700' : 'bg-gray-200 text-gray-500',
                    f.key === 'con_deuda' && f.count > 0 ? 'bg-red-100 text-red-600' : '')}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Header tabla */}
          {!loading && filtered.length > 0 && (
            <div className="grid items-center gap-3 px-4 py-2"
              style={{ gridTemplateColumns: '1fr 110px 110px 110px 120px 90px 80px 80px' }}>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Proveedor</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Compras 6m</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Deuda</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Logística</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Desempeño</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Última compra</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Contacto</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Acciones</span>
            </div>
          )}

          {/* Filas */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
              <Truck size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">
                {(tablero?.proveedores ?? []).length === 0
                  ? 'Sin proveedores. Agregá el primero.'
                  : 'Ninguno coincide con los filtros.'}
              </p>
              {filtro !== 'todos' && (
                <button onClick={() => setFiltro('todos')} className="mt-3 text-xs text-amber-600 hover:underline">
                  Ver todos
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {paginated.map(p => (
                <ProveedorRow
                  key={p.id}
                  prov={p}
                  onEdit={() => setModal(p.id)}
                  onToggle={() => toggleActivo(p)}
                />
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-400">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} de {filtered.length} proveedores
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.min(Math.max(page - 2, 1) + i, totalPages);
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={cn('w-7 h-7 rounded-lg text-xs font-medium',
                        pg === page ? 'bg-amber-500 text-white' : 'hover:bg-gray-100 text-gray-600')}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 space-y-4">

          {/* Resumen de transporte */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Resumen de transporte
            </p>
            <div className="flex items-center justify-center mb-3">
              <DonutChart
                size={90}
                segments={[
                  { value: fe.propia      ?? 0, color: '#10b981' },
                  { value: fe.tercerizada ?? 0, color: '#3b82f6' },
                  { value: fe.retiro      ?? 0, color: '#6b7280' },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              {[
                { key: 'propia',      label: 'Entrega propia',    color: 'bg-emerald-500' },
                { key: 'tercerizada', label: 'Tercerizada',       color: 'bg-blue-500' },
                { key: 'retiro',      label: 'Retiro en fábrica', color: 'bg-gray-400' },
              ].map(s => {
                const val = fe[s.key] ?? 0;
                const pct = feTotal > 0 ? Math.round(val / feTotal * 100) : 0;
                return (
                  <div key={s.key} className="flex items-center gap-2 text-xs">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', s.color)} />
                    <span className="flex-1 text-gray-600">{s.label}</span>
                    <span className="font-semibold text-gray-800">{val}</span>
                    <span className="text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Zap size={12} className="text-amber-500" /> Acciones rápidas
            </p>
            <div className="space-y-1.5">
              <button onClick={() => setModal('nuevo')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-amber-50 text-amber-700 transition-colors text-sm font-medium text-left">
                <Plus size={15} /> Nuevo proveedor
              </button>
              <button onClick={() => setFiltro('con_deuda')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-700 transition-colors text-sm font-medium text-left">
                <DollarSign size={15} /> Ver deudas pendientes
              </button>
              <button onClick={() => setFiltro('sin_actividad')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors text-sm font-medium text-left">
                <Clock size={15} /> Ver inactivos
              </button>
              <button onClick={() => setFiltro('principales')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-amber-50 text-amber-700 transition-colors text-sm font-medium text-left">
                <Star size={15} /> Ver principales
              </button>
            </div>
          </div>

          {/* Top proveedores */}
          {(tablero?.top_proveedores.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                Top por compras (6m)
              </p>
              <div className="space-y-2">
                {tablero!.top_proveedores.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{p.nombre}</p>
                      <p className="text-[10px] text-gray-400">{p.lotes_count_6m} compras</p>
                    </div>
                    <span className="text-xs font-bold text-gray-700 flex-shrink-0">
                      {fmtMonto(p.compras_monto_6m)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Análisis inferior ── */}
      {(tablero?.compras_por_rubro.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* Compras por rubro */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Package size={12} /> Compras por rubro (últ. 6 meses)
            </p>
            <div className="flex items-center gap-5">
              <DonutChart
                size={90}
                segments={(tablero!.compras_por_rubro).map((r, i) => ({
                  value: Number(r.total_compras),
                  color: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#6b7280'][i % 6],
                }))}
              />
              <div className="flex-1 space-y-1.5">
                {tablero!.compras_por_rubro.map((r, i) => {
                  const total = tablero!.compras_por_rubro.reduce((s, x) => s + Number(x.total_compras), 0);
                  const pct   = total > 0 ? Math.round(Number(r.total_compras) / total * 100) : 0;
                  const color = ['bg-amber-400', 'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-red-400', 'bg-gray-400'][i % 6];
                  return (
                    <div key={r.rubro} className="flex items-center gap-2 text-xs">
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', color)} />
                      <span className="flex-1 text-gray-600">{r.rubro}</span>
                      <span className="font-semibold text-gray-800">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Deuda por proveedor */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <DollarSign size={12} /> Deudas a pagar
            </p>
            {(tablero?.proveedores ?? []).filter(p => p.deuda_actual > 0).length === 0 ? (
              <div className="flex items-center gap-2 py-6 justify-center">
                <Check size={20} className="text-emerald-400" />
                <p className="text-sm text-gray-400">Sin deudas pendientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(tablero?.proveedores ?? [])
                  .filter(p => p.deuda_actual > 0)
                  .sort((a, b) => b.deuda_actual - a.deuda_actual)
                  .slice(0, 5)
                  .map(p => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0', avatarColor(p.nombre))}>
                        {initials(p.nombre)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.nombre}</p>
                      </div>
                      <span className="text-sm font-bold text-red-600 flex-shrink-0">{fmtMonto(p.deuda_actual)}</span>
                      <button onClick={() => setModal(p.id)}
                        className="p-1 hover:bg-gray-100 rounded-md flex-shrink-0">
                        <Pencil size={11} className="text-gray-400" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <ModalProveedor
          title={modal === 'nuevo' ? 'Nuevo proveedor' : `Editar: ${editingProv?.nombre ?? ''}`}
          initial={modal === 'nuevo' ? emptyForm() : {
            nombre:             editingProv?.nombre ?? '',
            tipo:               editingProv?.tipo ?? null,
            contacto:           editingProv?.contacto ?? null,
            telefono:           editingProv?.telefono ?? null,
            email:              editingProv?.email ?? null,
            cuit:               editingProv?.cuit ?? null,
            direccion:          editingProv?.direccion ?? null,
            localidad:          editingProv?.localidad ?? null,
            provincia:          editingProv?.provincia ?? null,
            web:                editingProv?.web ?? null,
            materiales:         editingProv?.materiales ?? [],
            notas:              editingProv?.notas ?? null,
            forma_entrega:      editingProv?.forma_entrega ?? 'propia',
            plazo_entrega_dias: editingProv?.plazo_entrega_dias ?? null,
            costo_flete:        editingProv?.costo_flete ?? 0,
            calificacion:       editingProv?.calificacion ?? null,
            deuda_actual:       editingProv?.deuda_actual ?? 0,
            es_principal:       editingProv?.es_principal ?? false,
          }}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
