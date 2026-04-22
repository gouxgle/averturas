import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, FileText, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { EstadoOperacion, Cliente, TipoAbertura, Sistema, Proveedor } from '@/types';

// ── Catálogos estáticos ───────────────────────────────────────────────────────

const TIPOS_PROYECTO = [
  'Vivienda', 'Frente comercial', 'Quincho', 'Baño', 'Habitación', 'Obra completa',
];

const ESTADOS: { value: EstadoOperacion; label: string; color: string }[] = [
  { value: 'consulta',      label: 'Consulta',      color: 'bg-gray-100 text-gray-600' },
  { value: 'presupuesto',   label: 'Presupuestado', color: 'bg-blue-100 text-blue-700' },
  { value: 'enviado',       label: 'Enviado',       color: 'bg-sky-100 text-sky-700' },
  { value: 'aprobado',      label: 'Aprobado',      color: 'bg-green-100 text-green-700' },
  { value: 'cancelado',     label: 'Rechazado',     color: 'bg-red-100 text-red-600' },
  { value: 'en_produccion', label: 'En proceso',    color: 'bg-amber-100 text-amber-700' },
  { value: 'entregado',     label: 'Terminado',     color: 'bg-emerald-100 text-emerald-700' },
];

const VIDRIO_OPTS   = ['Transparente', 'Traslúcido', 'Laminado', 'DVH', 'Sin vidrio'];
const ACCESORIO_OPTS = ['Barral', 'Cerradura', 'Manijón', 'Otros'];
const FORMA_PAGO    = ['Contado', 'Cuotas', 'Mixto'];
const COLORES_ITEM  = ['Blanco', 'Negro', 'Anodizado', 'Otro'];

// ── Ítem vacío ────────────────────────────────────────────────────────────────

interface ItemForm {
  _key: string;
  tipo_abertura_id: string;
  sistema_id: string;
  descripcion: string;
  medida_ancho: string;
  medida_alto: string;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  incluye_instalacion: boolean;
  costo_instalacion: number;
  precio_instalacion: number;
  vidrio: string;
  premarco: boolean;
  origen: 'proveedor' | 'fabricacion';
  color: string;
  accesorios: string[];
}

function emptyItem(): ItemForm {
  return {
    _key: crypto.randomUUID(),
    tipo_abertura_id: '', sistema_id: '', descripcion: '',
    medida_ancho: '', medida_alto: '',
    cantidad: 1,
    costo_unitario: 0, precio_unitario: 0,
    incluye_instalacion: false, costo_instalacion: 0, precio_instalacion: 0,
    vidrio: '', premarco: false, origen: 'proveedor', color: '', accesorios: [],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemPrecioTotal(item: ItemForm) {
  const base = item.precio_unitario + (item.incluye_instalacion ? item.precio_instalacion : 0);
  return base * item.cantidad;
}
function itemCostoTotal(item: ItemForm) {
  const base = item.costo_unitario + (item.incluye_instalacion ? item.costo_instalacion : 0);
  return base * item.cantidad;
}

// ── Componente ítem ───────────────────────────────────────────────────────────

function ItemCard({
  item, idx, tiposAbertura, sistemas, coloresDB, onChange, onRemove, canRemove,
}: {
  item: ItemForm;
  idx: number;
  tiposAbertura: TipoAbertura[];
  sistemas: Sistema[];
  coloresDB: { id: string; nombre: string }[];
  onChange: (key: string, field: keyof ItemForm, value: unknown) => void;
  onRemove: (key: string) => void;
  canRemove: boolean;
}) {
  const [open, setOpen] = useState(true);
  const up = (f: keyof ItemForm, v: unknown) => onChange(item._key, f, v);

  const precioItem = itemPrecioTotal(item);
  const costoItem  = itemCostoTotal(item);
  const margenItem = precioItem > 0 ? Math.round((precioItem - costoItem) / precioItem * 100) : 0;

  const sel   = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white';
  const inp   = sel;
  const label = 'block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1';

  // Auto-generate description from fields
  useEffect(() => {
    const ta   = tiposAbertura.find(t => t.id === item.tipo_abertura_id)?.nombre ?? '';
    const sis  = sistemas.find(s => s.id === item.sistema_id)?.nombre ?? '';
    const med  = item.medida_ancho && item.medida_alto ? ` ${item.medida_ancho}×${item.medida_alto}m` : '';
    const desc = [ta, sis, med].filter(Boolean).join(' · ');
    if (desc) onChange(item._key, 'descripcion', desc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.tipo_abertura_id, item.sistema_id, item.medida_ancho, item.medida_alto]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header del ítem */}
      <div
        className={cn('flex items-center justify-between px-4 py-3 cursor-pointer select-none',
          open ? 'bg-violet-50 border-b border-violet-100' : 'bg-gray-50 hover:bg-gray-100')}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown size={15} className={cn('text-gray-400 transition-transform', open ? 'rotate-0' : '-rotate-90')} />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Ítem {idx + 1}</span>
          {item.descripcion && <span className="text-xs text-gray-500 hidden sm:inline">— {item.descripcion}</span>}
        </div>
        <div className="flex items-center gap-3">
          {precioItem > 0 && (
            <span className="text-xs font-semibold text-gray-700">{formatCurrency(precioItem)}</span>
          )}
          {canRemove && (
            <button onClick={e => { e.stopPropagation(); onRemove(item._key); }}
              className="text-red-400 hover:text-red-600 p-0.5">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-3">
          {/* Fila 1: Tipo + Sistema + Cantidad + Color */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={label}>Tipo de abertura</label>
              <select value={item.tipo_abertura_id} onChange={e => up('tipo_abertura_id', e.target.value)} className={sel}>
                <option value="">Seleccionar...</option>
                {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Sistema</label>
              <select value={item.sistema_id} onChange={e => up('sistema_id', e.target.value)} className={sel}>
                <option value="">Seleccionar...</option>
                {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Color</label>
              <select value={item.color} onChange={e => up('color', e.target.value)} className={sel}>
                <option value="">—</option>
                {coloresDB.length
                  ? coloresDB.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)
                  : COLORES_ITEM.map(c => <option key={c} value={c}>{c}</option>)
                }
              </select>
            </div>
            <div>
              <label className={label}>Cantidad</label>
              <input type="number" min={1} value={item.cantidad}
                onChange={e => up('cantidad', parseInt(e.target.value) || 1)} className={inp} />
            </div>
          </div>

          {/* Fila 2: Medidas + Vidrio + Premarco + Instalación + Origen */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className={label}>Ancho (m)</label>
              <input type="number" step="0.01" value={item.medida_ancho}
                onChange={e => up('medida_ancho', e.target.value)}
                placeholder="1.20" className={inp} />
            </div>
            <div>
              <label className={label}>Alto (m)</label>
              <input type="number" step="0.01" value={item.medida_alto}
                onChange={e => up('medida_alto', e.target.value)}
                placeholder="2.05" className={inp} />
            </div>
            <div>
              <label className={label}>Vidrio</label>
              <select value={item.vidrio} onChange={e => up('vidrio', e.target.value)} className={sel}>
                <option value="">—</option>
                {VIDRIO_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Premarco</label>
              <select value={item.premarco ? 'si' : 'no'} onChange={e => up('premarco', e.target.value === 'si')} className={sel}>
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
            </div>
            <div>
              <label className={label}>Origen</label>
              <select value={item.origen} onChange={e => up('origen', e.target.value)} className={sel}>
                <option value="proveedor">Proveedor</option>
                <option value="fabricacion">Fabricación</option>
              </select>
            </div>
          </div>

          {/* Fila 3: Costos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={label}>Costo unitario</label>
              <input type="number" min={0} value={item.costo_unitario}
                onChange={e => up('costo_unitario', parseFloat(e.target.value) || 0)} className={inp} />
            </div>
            <div>
              <label className={label}>Precio de venta</label>
              <input type="number" min={0} value={item.precio_unitario}
                onChange={e => up('precio_unitario', parseFloat(e.target.value) || 0)} className={inp} />
            </div>
            <div>
              <label className={label}>Instalación</label>
              <select value={item.incluye_instalacion ? 'si' : 'no'}
                onChange={e => up('incluye_instalacion', e.target.value === 'si')} className={sel}>
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
            </div>
            <div>
              <label className={label}>Accesorios</label>
              <select multiple value={item.accesorios}
                onChange={e => up('accesorios', Array.from(e.target.selectedOptions).map(o => o.value))}
                className={sel + ' h-[38px] overflow-hidden'}
                style={{ height: '38px' }}
                size={1}
                onClick={e => {
                  const el = e.currentTarget;
                  el.size = el.size === 1 ? ACCESORIO_OPTS.length : 1;
                }}
                onBlur={e => { e.currentTarget.size = 1; }}>
                {ACCESORIO_OPTS.map(a => <option key={a} value={a}>{item.accesorios.includes(a) ? '✓ ' : ''}{a}</option>)}
              </select>
            </div>
          </div>

          {/* Instalación costos (condicional) */}
          {item.incluye_instalacion && (
            <div className="grid grid-cols-2 gap-3 pl-0 bg-violet-50 rounded-lg p-3">
              <div>
                <label className={label}>Costo instalación</label>
                <input type="number" min={0} value={item.costo_instalacion}
                  onChange={e => up('costo_instalacion', parseFloat(e.target.value) || 0)} className={inp} />
              </div>
              <div>
                <label className={label}>Precio instalación</label>
                <input type="number" min={0} value={item.precio_instalacion}
                  onChange={e => up('precio_instalacion', parseFloat(e.target.value) || 0)} className={inp} />
              </div>
            </div>
          )}

          {/* Margen del ítem */}
          {precioItem > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 border-t border-gray-100">
              <span>Precio: <span className="font-semibold text-gray-700">{formatCurrency(precioItem)}</span></span>
              <span>Costo: <span className="font-medium">{formatCurrency(costoItem)}</span></span>
              <span>Margen: <span className={cn('font-semibold', margenItem >= 30 ? 'text-green-600' : margenItem >= 15 ? 'text-amber-600' : 'text-red-600')}>{margenItem}%</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function NuevoPresupuesto() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);

  const [clientes, setClientes]         = useState<Cliente[]>([]);
  const [tiposAbertura, setTiposAbertura] = useState<TipoAbertura[]>([]);
  const [sistemas, setSistemas]         = useState<Sistema[]>([]);
  const [coloresDB, setColoresDB]       = useState<{ id: string; nombre: string }[]>([]);

  // Cabecera
  const [clienteId, setClienteId]         = useState(searchParams.get('cliente_id') ?? '');
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteList, setShowClienteList] = useState(false);
  const [estado, setEstado]               = useState<EstadoOperacion>('presupuesto');
  const [tipoProyecto, setTipoProyecto]   = useState('');
  const [formaPago, setFormaPago]         = useState('');
  const [tiempoEntrega, setTiempoEntrega] = useState('');
  const [fechaValidez, setFechaValidez]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [notas, setNotas]                 = useState('');
  const [notasInternas, setNotasInternas] = useState('');

  // Ítems
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);

  useEffect(() => {
    Promise.all([
      api.get<Cliente[]>('/clientes'),
      api.get<TipoAbertura[]>('/catalogo/tipos-abertura'),
      api.get<Sistema[]>('/catalogo/sistemas'),
      api.get<{ id: string; nombre: string }[]>('/catalogo/colores'),
    ]).then(([c, ta, s, col]) => {
      setClientes(c);
      setTiposAbertura(ta);
      setSistemas(s);
      setColoresDB(col);
    });
  }, []);

  const clientesFiltrados = clientes.filter(c =>
    `${c.nombre ?? ''} ${c.apellido ?? ''} ${c.razon_social ?? ''} ${c.telefono ?? ''}`.toLowerCase()
      .includes(clienteSearch.toLowerCase())
  );
  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  function updateItem(key: string, field: keyof ItemForm, value: unknown) {
    setItems(prev => prev.map(it => it._key === key ? { ...it, [field]: value } : it));
  }

  const costoTotal  = items.reduce((s, it) => s + itemCostoTotal(it), 0);
  const precioTotal = items.reduce((s, it) => s + itemPrecioTotal(it), 0);
  const margenTotal = precioTotal > 0 ? Math.round((precioTotal - costoTotal) / precioTotal * 100) : 0;

  // Derivar tipo de operacion desde items
  function derivarTipo() {
    const tieneFab = items.some(i => i.origen === 'fabricacion');
    return tieneFab ? 'fabricacion_propia' : 'a_medida_proveedor';
  }

  async function handleSave() {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return; }
    if (items.every(it => !it.tipo_abertura_id && !it.descripcion.trim())) {
      toast.error('Agregá al menos un ítem con tipo de abertura');
      return;
    }

    setSaving(true);
    try {
      const op = await api.post<{ id: string; numero: string }>('/operaciones', {
        tipo:           derivarTipo(),
        estado,
        cliente_id:     clienteId,
        tipo_proyecto:  tipoProyecto || null,
        forma_pago:     formaPago || null,
        tiempo_entrega: tiempoEntrega ? parseInt(tiempoEntrega) : null,
        notas:          notas || null,
        notas_internas: notasInternas || null,
        fecha_validez:  fechaValidez || null,
        items: items.map((it, idx) => ({
          tipo_abertura_id:   it.tipo_abertura_id || null,
          sistema_id:         it.sistema_id || null,
          descripcion:        it.descripcion || '',
          medida_ancho:       it.medida_ancho ? parseFloat(it.medida_ancho) : null,
          medida_alto:        it.medida_alto  ? parseFloat(it.medida_alto)  : null,
          cantidad:           it.cantidad,
          costo_unitario:     it.costo_unitario,
          precio_unitario:    it.precio_unitario,
          incluye_instalacion: it.incluye_instalacion,
          costo_instalacion:  it.costo_instalacion,
          precio_instalacion: it.precio_instalacion,
          vidrio:             it.vidrio || null,
          premarco:           it.premarco,
          origen:             it.origen,
          color:              it.color || null,
          accesorios:         it.accesorios,
          orden:              idx,
        })),
      });
      toast.success(`Presupuesto ${op.numero} creado`);
      navigate(`/operaciones/${op.id}`);
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white';
  const labelCls = 'block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
            <ArrowLeft size={17} className="text-gray-500" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-violet-600" />
          </div>
          <h1 className="text-base font-bold text-gray-900">Nuevo presupuesto</h1>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button onClick={() => navigate(-1)} className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium shadow-sm">
            <Save size={14} />
            {saving ? 'Guardando...' : 'Guardar presupuesto'}
          </button>
        </div>
      </div>

      {/* Sección: Cliente + Proyecto */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente y proyecto</h2>

        {/* Cliente */}
        <div>
          <label className={labelCls}>Cliente *</label>
          {clienteSeleccionado ? (
            <div className="flex items-center justify-between bg-violet-50 rounded-lg px-4 py-2.5 border border-violet-200">
              <div>
                <p className="text-sm font-semibold text-violet-800">
                  {clienteSeleccionado.tipo_persona === 'juridica'
                    ? clienteSeleccionado.razon_social
                    : `${clienteSeleccionado.nombre ?? ''} ${clienteSeleccionado.apellido ?? ''}`.trim()}
                </p>
                <p className="text-xs text-violet-600">{clienteSeleccionado.telefono ?? '—'}</p>
              </div>
              <button onClick={() => { setClienteId(''); setClienteSearch(''); }}
                className="text-xs text-violet-600 hover:underline">Cambiar</button>
            </div>
          ) : (
            <div className="relative">
              <input type="text" placeholder="Buscar cliente por nombre, teléfono..."
                value={clienteSearch}
                onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
                onFocus={() => setShowClienteList(true)}
                className={inputCls} />
              {showClienteList && clienteSearch && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clientesFiltrados.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      No encontrado.{' '}
                      <button className="text-violet-600 hover:underline"
                        onClick={() => navigate('/clientes/nuevo?nombre=' + clienteSearch)}>
                        Crear cliente
                      </button>
                    </div>
                  ) : clientesFiltrados.slice(0, 8).map(c => (
                    <button key={c.id}
                      onClick={() => { setClienteId(c.id); setClienteSearch(''); setShowClienteList(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between">
                      <span className="text-sm text-gray-800">
                        {c.tipo_persona === 'juridica' ? c.razon_social : `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim()}
                      </span>
                      <span className="text-xs text-gray-400">{c.telefono ?? ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Tipo de proyecto</label>
            <select value={tipoProyecto} onChange={e => setTipoProyecto(e.target.value)} className={inputCls}>
              <option value="">— Sin especificar —</option>
              {TIPOS_PROYECTO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select value={estado} onChange={e => setEstado(e.target.value as EstadoOperacion)} className={inputCls}>
              {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Forma de pago</label>
            <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {FORMA_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tiempo de entrega (días)</label>
            <input type="number" min={0} value={tiempoEntrega}
              onChange={e => setTiempoEntrega(e.target.value)}
              placeholder="Ej: 15" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Válido hasta</label>
            <input type="date" value={fechaValidez} onChange={e => setFechaValidez(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Sección: Ítems */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Ítems del presupuesto
            <span className="ml-2 text-gray-400 font-normal normal-case">{items.length} {items.length === 1 ? 'ítem' : 'ítems'}</span>
          </h2>
          <button onClick={() => setItems(prev => [...prev, emptyItem()])}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium">
            <Plus size={13} /> Agregar ítem
          </button>
        </div>

        <div className="p-4 space-y-3">
          {items.map((item, idx) => (
            <ItemCard
              key={item._key}
              item={item}
              idx={idx}
              tiposAbertura={tiposAbertura}
              sistemas={sistemas}
              coloresDB={coloresDB}
              onChange={updateItem}
              onRemove={key => setItems(prev => prev.filter(it => it._key !== key))}
              canRemove={items.length > 1}
            />
          ))}
        </div>

        {/* Totales */}
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex justify-end gap-8">
            <div className="space-y-1 text-right">
              <div className="flex gap-6 text-sm">
                <span className="text-gray-500">Costo total:</span>
                <span className="font-medium text-gray-700 w-28 text-right">{formatCurrency(costoTotal)}</span>
              </div>
              <div className="flex gap-6 text-sm">
                <span className="text-gray-500">Precio total:</span>
                <span className="font-bold text-gray-800 w-28 text-right">{formatCurrency(precioTotal)}</span>
              </div>
              <div className="flex gap-6 text-sm">
                <span className="text-gray-500">Margen:</span>
                <span className={cn('font-semibold w-28 text-right', margenTotal >= 30 ? 'text-green-600' : margenTotal >= 15 ? 'text-amber-600' : 'text-red-600')}>
                  {margenTotal}% {precioTotal > 0 && <span className="text-gray-400 font-normal">({formatCurrency(precioTotal - costoTotal)})</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Notas para el cliente</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
            placeholder="Condiciones, aclaraciones, forma de pago..."
            className={inputCls + ' resize-none'} />
        </div>
        <div>
          <label className={labelCls}>Notas internas</label>
          <textarea value={notasInternas} onChange={e => setNotasInternas(e.target.value)} rows={3}
            placeholder="Solo para el equipo..."
            className={inputCls + ' resize-none'} />
        </div>
      </div>

    </div>
  );
}
