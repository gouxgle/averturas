import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, FileText, ChevronDown, ScanLine, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { EstadoOperacion, Cliente, TipoAbertura, Sistema, Proveedor } from '@/types';
import { MontoInput } from '@/components/MontoInput';

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

const VIDRIO_OPTS    = ['Transparente', 'Traslúcido', 'Laminado', 'DVH', 'Sin vidrio'];
const ACCESORIO_OPTS = ['Barral', 'Cerradura', 'Manijón', 'Otros'];
const FORMA_PAGO     = ['Contado', 'Tarjeta de crédito', 'Débito', 'Cheque', 'Transferencia'];
const COLORES_ITEM   = ['Blanco', 'Negro', 'Anodizado', 'Otro'];

// ── Tipos ────────────────────────────────────────────────────────────────────

interface CatalogProduct {
  id: string;
  nombre: string;
  codigo: string | null;
  costo_base: number;
  precio_base: number;
  tipo_abertura_id: string | null;
  sistema_id: string | null;
  color: string | null;
  vidrio: string | null;
  premarco: boolean;
  accesorios: string[];
}

// ── Ítem vacío ────────────────────────────────────────────────────────────────

interface ItemForm {
  _key: string;
  producto_id: string;   // id de catálogo — '' si ítem manual
  tipo_item: 'estandar' | 'a_medida';
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

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function emptyItem(): ItemForm {
  return {
    _key: uuid(),
    producto_id: '',
    tipo_item: 'estandar',
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

  const esMedida = item.tipo_item === 'a_medida';

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
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide',
            esMedida ? 'bg-violet-100 text-violet-600' : 'bg-sky-100 text-sky-600')}>
            {esMedida ? 'A medida' : 'Estándar'}
          </span>
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
          {/* Tipo de ítem */}
          <div className="flex gap-2">
            {(['estandar', 'a_medida'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => up('tipo_item', t)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                  item.tipo_item === t
                    ? t === 'estandar' ? 'bg-sky-600 text-white border-sky-600' : 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300')}>
                {t === 'estandar' ? 'Producto estándar' : 'A medida / Fabricación'}
              </button>
            ))}
          </div>

          {/* Fila 1: Tipo abertura + Sistema + Color + Cantidad */}
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

          {/* Campos exclusivos A medida */}
          {esMedida && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-violet-50/50 rounded-lg p-3 border border-violet-100">
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
                  <option value="fabricacion">Fabricación propia</option>
                </select>
              </div>
            </div>
          )}

          {/* Fila precios */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>Precio de venta</label>
              <MontoInput value={item.precio_unitario ? String(item.precio_unitario) : ''}
                onChange={v => up('precio_unitario', parseFloat(v) || 0)}
                placeholder="0,00" className={inp} />
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
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1.5">
                {ACCESORIO_OPTS.map(a => (
                  <label key={a} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox"
                      checked={item.accesorios.includes(a)}
                      onChange={e => up('accesorios',
                        e.target.checked
                          ? [...item.accesorios, a]
                          : item.accesorios.filter(x => x !== a)
                      )}
                      className="rounded border-gray-300 text-violet-600 focus:ring-violet-400"
                    />
                    <span className="text-xs text-gray-600">{a}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Precio instalación (condicional) */}
          {item.incluye_instalacion && (
            <div className="grid grid-cols-1 gap-3 bg-violet-50 rounded-lg p-3">
              <div>
                <label className={label}>Precio instalación</label>
                <MontoInput value={item.precio_instalacion ? String(item.precio_instalacion) : ''}
                  onChange={v => up('precio_instalacion', parseFloat(v) || 0)}
                  placeholder="0,00" className={inp} />
              </div>
            </div>
          )}

          {/* Total del ítem */}
          {precioItem > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 border-t border-gray-100">
              <span>Subtotal: <span className="font-semibold text-gray-700">{formatCurrency(precioItem)}</span></span>
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
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [validezDias, setValidezDias]     = useState<number | 'custom'>(7);
  const [notas, setNotas]                 = useState('');
  const [notasInternas, setNotasInternas] = useState('');

  // Ítems
  const [items, setItems] = useState<ItemForm[]>([]);

  // Buscador por código / scanner
  const [codigoSearch,    setCodigoSearch]    = useState('');
  const [codigoResults,   setCodigoResults]   = useState<CatalogProduct[]>([]);
  const [showCodigo,      setShowCodigo]      = useState(false);
  const [codigoLoading,   setCodigoLoading]   = useState(false);
  const codigoRef = useRef<HTMLInputElement>(null);

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

  const precioTotal = items.reduce((s, it) => s + itemPrecioTotal(it), 0);

  // Derivar tipo de operacion desde items
  function derivarTipo() {
    const tieneFab = items.some(i => i.origen === 'fabricacion');
    return tieneFab ? 'fabricacion_propia' : 'a_medida_proveedor';
  }

  // Agrega ítem desde catálogo — si ya existe incrementa cantidad
  function agregarProducto(p: CatalogProduct) {
    setItems(prev => {
      const existente = prev.find(it => it.producto_id === p.id);
      if (existente) {
        return prev.map(it =>
          it.producto_id === p.id ? { ...it, cantidad: it.cantidad + 1 } : it
        );
      }
      return [...prev, {
        _key:                uuid(),
        producto_id:         p.id,
        tipo_item:           'estandar',
        tipo_abertura_id:    p.tipo_abertura_id ?? '',
        sistema_id:          p.sistema_id ?? '',
        descripcion:         p.codigo ? `${p.codigo} — ${p.nombre}` : p.nombre,
        medida_ancho:        '',
        medida_alto:         '',
        cantidad:            1,
        costo_unitario:      Number(p.costo_base) || 0,
        precio_unitario:     Number(p.precio_base) || 0,
        incluye_instalacion: false,
        costo_instalacion:   0,
        precio_instalacion:  0,
        vidrio:              p.vidrio   ?? '',
        premarco:            p.premarco ?? false,
        origen:              'proveedor',
        color:               p.color    ?? '',
        accesorios:          p.accesorios ?? [],
      }];
    });
    setCodigoSearch('');
    setCodigoResults([]);
    setShowCodigo(false);
    setTimeout(() => codigoRef.current?.focus(), 50);
  }

  const buscarCodigo = useCallback(async (q: string, exactOnEnter = false) => {
    if (!q.trim()) { setCodigoResults([]); setShowCodigo(false); return; }
    setCodigoLoading(true);
    try {
      const res = await api.get<CatalogProduct[]>(
        `/catalogo/productos?search=${encodeURIComponent(q.trim())}`
      );
      // Scanner: si hay match exacto por código → auto-agregar
      if (exactOnEnter) {
        const exact = res.find(r => r.codigo?.toLowerCase() === q.trim().toLowerCase());
        if (exact) { agregarProducto(exact); setCodigoLoading(false); return; }
      }
      setCodigoResults(res.slice(0, 8));
      setShowCodigo(res.length > 0);
    } catch {
      setCodigoResults([]);
    } finally {
      setCodigoLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce al escribir (no en Enter)
  useEffect(() => {
    if (!codigoSearch.trim()) { setCodigoResults([]); setShowCodigo(false); return; }
    const t = setTimeout(() => buscarCodigo(codigoSearch, false), 300);
    return () => clearTimeout(t);
  }, [codigoSearch, buscarCodigo]);

  async function handleSave() {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return; }
    if (items.length === 0) { toast.error('Agregá al menos un ítem'); return; }

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
            <label className={labelCls}>Período de validez</label>
            <div className="flex gap-1 mb-2">
              {([7, 15, 30] as const).map(d => (
                <button key={d} type="button"
                  onClick={() => {
                    setValidezDias(d);
                    const f = new Date(); f.setDate(f.getDate() + d);
                    setFechaValidez(f.toISOString().split('T')[0]);
                  }}
                  className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                    validezDias === d
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600')}>
                  {d} días
                </button>
              ))}
              <button type="button"
                onClick={() => setValidezDias('custom')}
                className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                  validezDias === 'custom'
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600')}>
                Personalizada
              </button>
            </div>
            {validezDias === 'custom' ? (
              <input type="date" value={fechaValidez}
                onChange={e => setFechaValidez(e.target.value)}
                className={inputCls} />
            ) : (
              <p className="text-xs text-gray-500 px-1">
                Vence: <span className="font-medium text-gray-700">
                  {new Date(fechaValidez + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sección: Ítems */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Ítems del presupuesto
              <span className="ml-2 text-gray-400 font-normal normal-case">{items.length} {items.length === 1 ? 'ítem' : 'ítems'}</span>
            </h2>
            <button onClick={() => setItems(prev => [...prev, emptyItem()])}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium">
              <Plus size={13} /> Ítem manual
            </button>
          </div>

          {/* Buscador por código / lector */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 border border-violet-200 bg-violet-50 rounded-xl focus-within:ring-2 focus-within:ring-violet-400 focus-within:border-violet-400 transition-all">
              <ScanLine size={15} className="text-violet-400 shrink-0" />
              <input
                ref={codigoRef}
                value={codigoSearch}
                onChange={e => setCodigoSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    buscarCodigo(codigoSearch, true);
                  }
                  if (e.key === 'Escape') { setCodigoSearch(''); setShowCodigo(false); }
                }}
                onFocus={() => codigoSearch && setShowCodigo(true)}
                onBlur={() => setTimeout(() => setShowCodigo(false), 150)}
                placeholder="Escanear código de barras o buscar por código / nombre de producto..."
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-violet-300 focus:outline-none"
              />
              {codigoLoading
                ? <Search size={13} className="text-violet-300 animate-pulse shrink-0" />
                : codigoSearch && (
                  <button onMouseDown={() => { setCodigoSearch(''); setCodigoResults([]); setShowCodigo(false); }}
                    className="text-violet-300 hover:text-violet-500">
                    ×
                  </button>
                )
              }
            </div>
            <p className="text-[10px] text-violet-400 mt-0.5 ml-1">
              Enter o lector de código → agrega automáticamente si hay coincidencia exacta
            </p>

            {/* Dropdown resultados */}
            {showCodigo && codigoResults.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {codigoResults.map(p => (
                  <button key={p.id} type="button"
                    onMouseDown={() => agregarProducto(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-violet-50 border-b border-gray-50 last:border-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {p.codigo && (
                          <span className="font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
                            {p.codigo}
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-800 truncate">{p.nombre}</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-violet-700 shrink-0">
                      {formatCurrency(Number(p.precio_base))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ScanLine size={28} className="text-violet-200 mb-3" />
              <p className="text-sm text-gray-400 font-medium">Sin ítems</p>
              <p className="text-xs text-gray-300 mt-1">
                Escanear código de barras o buscar por nombre arriba
              </p>
            </div>
          ) : (
            items.map((item, idx) => (
              <ItemCard
                key={item._key}
                item={item}
                idx={idx}
                tiposAbertura={tiposAbertura}
                sistemas={sistemas}
                coloresDB={coloresDB}
                onChange={updateItem}
                onRemove={key => setItems(prev => prev.filter(it => it._key !== key))}
                canRemove={true}
              />
            ))
          )}
        </div>

        {/* Total */}
        {precioTotal > 0 && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex justify-end">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">Total presupuesto:</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(precioTotal)}</span>
            </div>
          </div>
        )}
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
