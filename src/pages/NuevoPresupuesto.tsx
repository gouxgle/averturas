import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, FileText, ChevronDown, ScanLine, Search,
  Package, X, LayoutGrid, Truck, MapPin, Gift, Building2, Star, Edit2,
  Phone, MessageCircle, CheckCircle2, Check, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { HelpButton } from '@/components/HelpButton';
import { toast } from 'sonner';
import type { Cliente, TipoAbertura, Sistema } from '@/types';
import { MontoInput } from '@/components/MontoInput';
import { PDFDialog } from '@/components/PDFDialog';

// ── Catálogos estáticos ───────────────────────────────────────────────────────

const TIPOS_PROYECTO = [
  'Vivienda', 'Frente comercial', 'Quincho', 'Baño', 'Habitación', 'Obra completa',
];

const VIDRIO_OPTS    = ['Transparente', 'Traslúcido', 'Laminado', 'DVH', 'Sin vidrio'];
const ACCESORIO_OPTS = ['Barral', 'Cerradura', 'Manijón', 'Otros'];
const FORMA_PAGO = [
  'Precio de lista',
  'Contado',
  'Tarjeta de débito/crédito en 1 pago',
  'Transferencia',
  'Tarjeta de crédito 3 cuotas sin interés',
];

const FORMAS_ENVIO = [
  { value: 'retiro_local',     label: 'Retiro en local',                icon: MapPin,    color: 'text-gray-600' },
  { value: 'envio_bonificado', label: 'Envío bonificado',               icon: Gift,      color: 'text-emerald-600' },
  { value: 'envio_destino',    label: 'Envío a destino (paga cliente)', icon: Truck,     color: 'text-sky-600' },
  { value: 'envio_empresa',    label: 'Envío a cargo de la empresa',    icon: Building2, color: 'text-violet-600' },
] as const;

const COLORES_ITEM = ['Blanco', 'Negro', 'Anodizado', 'Otro'];

const LABEL_USO: Record<string, string> = {
  interior: 'Interior', exterior: 'Exterior', ambos: 'Interior y exterior',
};
const LABEL_CONFIG_HOJAS: Record<string, string> = {
  hoja_simple: 'Hoja simple', hoja_y_media: 'Hoja y media',
  dos_hojas: '2 hojas iguales', puerta_pano_fijo: 'Con paño fijo',
  '2_hojas': '2 hojas', '3_hojas': '3 hojas', '4_hojas': '4 hojas',
};
const LABEL_PROVISION: Record<string, string> = {
  hoja_sola: 'Solo hoja', hoja_marco: 'Hoja + marco',
};
const LABEL_APERTURA: Record<string, string> = {
  abatir: 'Abatir', correr: 'Corrediza', plegable: 'Plegable', vaiven: 'Vaivén', pivotante: 'Pivotante',
};

// ── Tipos ────────────────────────────────────────────────────────────────────

interface CatalogProduct {
  id: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  costo_base: number;
  precio_base: number;
  tipo_abertura_id: string | null;
  tipo_abertura: { id: string; nombre: string } | null;
  sistema_id: string | null;
  sistema: { id: string; nombre: string } | null;
  color: string | null;
  vidrio: string | null;
  premarco: boolean;
  accesorios: string[];
  ancho: number | null;
  alto: number | null;
  atributos: Record<string, unknown>;
  stock_actual: number;
  imagen_url: string | null;
  imagenes: string[];
  caracteristica_1: string | null;
  caracteristica_2: string | null;
}

// ── Tipo para carga de edición ────────────────────────────────────────────────

interface FullOperacion {
  id: string; numero: string; estado: string; cliente_id: string; tipo: string;
  tipo_proyecto: string | null; forma_pago: string | null;
  tiempo_entrega: number | null; fecha_validez: string | null;
  notas: string | null; notas_internas: string | null;
  forma_envio: string | null; costo_envio: number;
  items: Array<{
    tipo_abertura_id: string | null; sistema_id: string | null;
    descripcion: string; medida_ancho: number | null; medida_alto: number | null;
    cantidad: number; costo_unitario: number; precio_unitario: number;
    incluye_instalacion: boolean; costo_instalacion: number; precio_instalacion: number;
    vidrio: string | null; premarco: boolean; origen: string | null;
    color: string | null; accesorios: string[]; producto_id: string | null;
    tipo_abertura_nombre: string | null; sistema_nombre: string | null;
  }>;
}

// ── Ítem del formulario ────────────────────────────────────────────────────────

interface ItemForm {
  _key: string;
  producto_id: string;
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
  // datos del producto vinculado (solo lectura en UI)
  _prod_ancho: number | null;
  _prod_alto: number | null;
  _prod_atributos: Record<string, unknown>;
  _prod_stock: number;
  _prod_tipo_nombre: string;
  _prod_sistema_nombre: string;
  _prod_imagen_url: string | null;
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
    _prod_ancho: null, _prod_alto: null, _prod_atributos: {}, _prod_stock: 0,
    _prod_tipo_nombre: '', _prod_sistema_nombre: '',
    _prod_imagen_url: null,
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

// ── Modal de edición de ítem ──────────────────────────────────────────────────

function EditItemModal({
  item,
  tiposAbertura,
  sistemas,
  coloresDB,
  onChange,
  onClose,
}: {
  item: ItemForm;
  tiposAbertura: TipoAbertura[];
  sistemas: Sistema[];
  coloresDB: { id: string; nombre: string }[];
  onChange: (key: string, field: keyof ItemForm, value: unknown) => void;
  onClose: () => void;
}) {
  const up = (f: keyof ItemForm, v: unknown) => onChange(item._key, f, v);
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white';
  const lbl = 'block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-sm font-bold text-gray-900">Editar ítem</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Descripción */}
          <div>
            <label className={lbl}>Descripción</label>
            <input
              type="text"
              value={item.descripcion}
              onChange={e => up('descripcion', e.target.value)}
              className={inp}
              placeholder="Descripción del producto..."
            />
          </div>

          {/* Precio unitario + Instalación */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Precio unitario</label>
              <MontoInput
                value={item.precio_unitario ? String(item.precio_unitario) : ''}
                onChange={v => up('precio_unitario', parseFloat(v) || 0)}
                placeholder="0,00"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Instalación</label>
              <select
                value={item.incluye_instalacion ? 'si' : 'no'}
                onChange={e => up('incluye_instalacion', e.target.value === 'si')}
                className={inp}
              >
                <option value="no">No incluye</option>
                <option value="si">Incluye instalación</option>
              </select>
            </div>
          </div>

          {item.incluye_instalacion && (
            <div>
              <label className={lbl}>Precio instalación</label>
              <MontoInput
                value={item.precio_instalacion ? String(item.precio_instalacion) : ''}
                onChange={v => up('precio_instalacion', parseFloat(v) || 0)}
                placeholder="0,00"
                className={inp}
              />
            </div>
          )}

          {/* Color + Vidrio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Color</label>
              <select value={item.color} onChange={e => up('color', e.target.value)} className={inp}>
                <option value="">—</option>
                {coloresDB.length
                  ? coloresDB.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)
                  : COLORES_ITEM.map(c => <option key={c} value={c}>{c}</option>)
                }
              </select>
            </div>
            <div>
              <label className={lbl}>Vidrio</label>
              <select value={item.vidrio} onChange={e => up('vidrio', e.target.value)} className={inp}>
                <option value="">—</option>
                {VIDRIO_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Premarco */}
          <div>
            <label className={lbl}>Premarco</label>
            <select value={item.premarco ? 'si' : 'no'} onChange={e => up('premarco', e.target.value === 'si')} className={inp}>
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </div>

          {/* Tipo abertura + Sistema */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo de abertura</label>
              <select value={item.tipo_abertura_id} onChange={e => up('tipo_abertura_id', e.target.value)} className={inp}>
                <option value="">—</option>
                {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Sistema</label>
              <select value={item.sistema_id} onChange={e => up('sistema_id', e.target.value)} className={inp}>
                <option value="">—</option>
                {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Medidas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Ancho (m)</label>
              <input
                type="number" step="0.01" value={item.medida_ancho}
                onChange={e => up('medida_ancho', e.target.value)}
                placeholder="1.20" className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Alto (m)</label>
              <input
                type="number" step="0.01" value={item.medida_alto}
                onChange={e => up('medida_alto', e.target.value)}
                placeholder="2.05" className={inp}
              />
            </div>
          </div>

          {/* Accesorios */}
          <div>
            <label className={lbl}>Accesorios</label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              {ACCESORIO_OPTS.map(a => (
                <label key={a} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={item.accesorios.includes(a)}
                    onChange={e => up('accesorios',
                      e.target.checked
                        ? [...item.accesorios, a]
                        : item.accesorios.filter(x => x !== a)
                    )}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-400"
                  />
                  <span className="text-sm text-gray-600">{a}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Subtotal */}
          {itemPrecioTotal(item) > 0 && (
            <div className="bg-violet-50 rounded-xl px-4 py-3 flex items-center justify-between border border-violet-100">
              <span className="text-xs text-violet-600 font-medium">Subtotal ítem</span>
              <span className="text-base font-bold text-violet-700">{formatCurrency(itemPrecioTotal(item))}</span>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#7c3aed] hover:bg-violet-700 text-white rounded-xl text-sm font-semibold"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function NuevoPresupuesto() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id?: string }>();
  const isEdit = !!editId;
  const editLoadedRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [editEstado, setEditEstado] = useState('');

  const [clientes, setClientes]           = useState<Cliente[]>([]);
  const [tiposAbertura, setTiposAbertura] = useState<TipoAbertura[]>([]);
  const [sistemas, setSistemas]           = useState<Sistema[]>([]);
  const [coloresDB, setColoresDB]         = useState<{ id: string; nombre: string }[]>([]);

  // Cabecera
  const [clienteId, setClienteId]           = useState(searchParams.get('cliente_id') ?? '');
  const [clienteSearch, setClienteSearch]   = useState('');
  const [showClienteList, setShowClienteList] = useState(false);
  const [tipoProyecto, setTipoProyecto]     = useState('');
  const [formaPago, setFormaPago]           = useState('Precio de lista');
  const [tiempoEntrega, setTiempoEntrega]   = useState('');
  const [fechaValidez, setFechaValidez]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [validezDias, setValidezDias]       = useState<number | 'custom'>(7);
  const [notas, setNotas]                   = useState('');
  const [notasInternas, setNotasInternas]   = useState('');

  // Envío
  const [formaEnvio, setFormaEnvio] = useState('retiro_local');
  const [costoEnvio, setCostoEnvio] = useState(0);

  // Flags: step solo verde si usuario eligió explícitamente
  const [userSetFormaPago, setUserSetFormaPago]       = useState(false);
  const [userSetFormaEnvio, setUserSetFormaEnvio]     = useState(false);
  const [userSetFechaValidez, setUserSetFechaValidez] = useState(false);

  // Ítems
  const [items, setItems] = useState<ItemForm[]>([]);

  // Estado nuevo UI
  const [tab, setTab] = useState<'galeria' | 'buscar' | 'frecuentes' | 'scanner'>('galeria');
  const [categoriaSel, setCategoriaSel] = useState('');
  const [galSearch, setGalSearch] = useState('');
  const [productos, setProductos] = useState<CatalogProduct[]>([]);
  const [productosLoading, setProductosLoading] = useState(false);
  const [editItemKey, setEditItemKey] = useState<string | null>(null);
  const [showNotas, setShowNotas] = useState(false);
  const [showValidacionModal, setShowValidacionModal] = useState(false);

  // Buscador por código / scanner
  const [codigoSearch, setCodigoSearch]   = useState('');
  const [codigoResults, setCodigoResults] = useState<CatalogProduct[]>([]);
  const [showCodigo, setShowCodigo]       = useState(false);
  const [codigoLoading, setCodigoLoading] = useState(false);
  const codigoRef = useRef<HTMLInputElement>(null);

  // Buscador tab "buscar"
  const [buscarSearch, setBuscarSearch]   = useState('');
  const [buscarResults, setBuscarResults] = useState<CatalogProduct[]>([]);
  const [buscarLoading, setBuscarLoading] = useState(false);

  // Carga inicial de catálogos (sin clientes — se buscan por API al tipear)
  useEffect(() => {
    Promise.all([
      api.get<TipoAbertura[]>('/catalogo/tipos-abertura'),
      api.get<Sistema[]>('/catalogo/sistemas'),
      api.get<{ id: string; nombre: string }[]>('/catalogo/colores'),
    ]).then(([ta, s, col]) => {
      setTiposAbertura(ta);
      setSistemas(s);
      setColoresDB(col);
    });
    // Si viene ?cliente_id en URL, cargar ese cliente directamente
    const urlClienteId = searchParams.get('cliente_id');
    if (urlClienteId) {
      api.get<Cliente>(`/clientes/${urlClienteId}`).then(cl => setClientes([cl])).catch(() => {});
    }
  }, []);

  // Búsqueda de clientes por API con debounce
  useEffect(() => {
    const q = clienteSearch.trim();
    if (!q) { setClientes([]); return; }
    const t = setTimeout(() => {
      api.get<Cliente[]>(`/clientes?search=${encodeURIComponent(q)}`)
        .then(setClientes)
        .catch(() => setClientes([]));
    }, 250);
    return () => clearTimeout(t);
  }, [clienteSearch]);

  // Carga galería de productos
  useEffect(() => {
    setProductosLoading(true);
    api.get<CatalogProduct[]>('/catalogo/productos')
      .then(r => setProductos(r))
      .finally(() => setProductosLoading(false));
  }, []);

  // Cargar datos en modo edición
  useEffect(() => {
    if (!isEdit || !editId || editLoadedRef.current) return;
    editLoadedRef.current = true;
    api.get<FullOperacion>(`/operaciones/${editId}`).then(op => {
      if (op.estado === 'aprobado') {
        toast.error('Presupuesto aprobado: no puede editarse');
        navigate('/presupuestos');
        return;
      }
      setEditEstado(op.estado);
      setClienteId(op.cliente_id);
      // Cargar cliente para mostrar nombre/teléfono en el header
      api.get<Cliente>(`/clientes/${op.cliente_id}`).then(cl => setClientes([cl])).catch(() => {});
      setTipoProyecto(op.tipo_proyecto ?? '');
      setFormaPago(op.forma_pago ?? 'Precio de lista');
      setUserSetFormaPago(true);
      setTiempoEntrega(op.tiempo_entrega ? String(op.tiempo_entrega) : '');
      setFechaValidez(op.fecha_validez ? op.fecha_validez.split('T')[0] : '');
      setUserSetFechaValidez(true);
      setValidezDias('custom');
      setNotas(op.notas ?? '');
      setNotasInternas(op.notas_internas ?? '');
      setFormaEnvio(op.forma_envio ?? 'retiro_local');
      setUserSetFormaEnvio(true);
      setCostoEnvio(Number(op.costo_envio) || 0);
      setItems(op.items.map(it => ({
        _key: uuid(),
        producto_id:         it.producto_id ?? '',
        tipo_item:           (it.medida_ancho || it.medida_alto) ? 'a_medida' : 'estandar',
        tipo_abertura_id:    it.tipo_abertura_id ?? '',
        sistema_id:          it.sistema_id ?? '',
        descripcion:         it.descripcion,
        medida_ancho:        it.medida_ancho ? String(it.medida_ancho) : '',
        medida_alto:         it.medida_alto  ? String(it.medida_alto)  : '',
        cantidad:            it.cantidad,
        costo_unitario:      Number(it.costo_unitario),
        precio_unitario:     Number(it.precio_unitario),
        incluye_instalacion: it.incluye_instalacion,
        costo_instalacion:   Number(it.costo_instalacion),
        precio_instalacion:  Number(it.precio_instalacion),
        vidrio:              it.vidrio ?? '',
        premarco:            it.premarco ?? false,
        origen:              (it.origen as 'proveedor' | 'fabricacion') ?? 'proveedor',
        color:               it.color ?? '',
        accesorios:          it.accesorios ?? [],
        _prod_ancho: null, _prod_alto: null, _prod_atributos: {}, _prod_stock: 0,
        _prod_tipo_nombre:    it.tipo_abertura_nombre ?? '',
        _prod_sistema_nombre: it.sistema_nombre ?? '',
        _prod_imagen_url:     null,
      })));
    }).catch(() => { toast.error('No se pudo cargar el presupuesto'); navigate('/presupuestos'); });
  }, [isEdit, editId, navigate]);

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  function updateItem(key: string, field: keyof ItemForm, value: unknown) {
    setItems(prev => prev.map(it => it._key === key ? { ...it, [field]: value } : it));
  }

  const precioTotal   = items.reduce((s, it) => s + itemPrecioTotal(it), 0);
  const totalConEnvio = precioTotal + (formaEnvio === 'envio_empresa' ? costoEnvio : 0);

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
        tipo_abertura_id:    p.tipo_abertura_id   ?? '',
        sistema_id:          p.sistema_id         ?? '',
        descripcion:         p.codigo ? `${p.codigo} — ${p.nombre}` : p.nombre,
        medida_ancho:        '',
        medida_alto:         '',
        cantidad:            1,
        costo_unitario:      Number(p.costo_base)  || 0,
        precio_unitario:     Number(p.precio_base) || 0,
        incluye_instalacion: false,
        costo_instalacion:   0,
        precio_instalacion:  0,
        vidrio:              p.vidrio             ?? '',
        premarco:            p.premarco           ?? false,
        origen:              'proveedor',
        color:               p.color              ?? '',
        accesorios:          p.accesorios         ?? [],
        _prod_ancho:         p.ancho              ?? null,
        _prod_alto:          p.alto               ?? null,
        _prod_atributos:     p.atributos          ?? {},
        _prod_stock:         p.stock_actual        ?? 0,
        _prod_tipo_nombre:   p.tipo_abertura?.nombre ?? '',
        _prod_sistema_nombre: p.sistema?.nombre    ?? '',
        _prod_imagen_url:    p.imagenes?.[0] ?? p.imagen_url ?? null,
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

  useEffect(() => {
    if (!codigoSearch.trim()) { setCodigoResults([]); setShowCodigo(false); return; }
    const t = setTimeout(() => buscarCodigo(codigoSearch, false), 300);
    return () => clearTimeout(t);
  }, [codigoSearch, buscarCodigo]);

  // Búsqueda en tab "buscar"
  useEffect(() => {
    if (!buscarSearch.trim()) { setBuscarResults([]); return; }
    const t = setTimeout(async () => {
      setBuscarLoading(true);
      try {
        const res = await api.get<CatalogProduct[]>(
          `/catalogo/productos?search=${encodeURIComponent(buscarSearch.trim())}`
        );
        setBuscarResults(res.slice(0, 20));
      } catch { /* silencioso */ }
      finally { setBuscarLoading(false); }
    }, 280);
    return () => clearTimeout(t);
  }, [buscarSearch]);

  async function handleSave(abrirPdf = false) {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return; }
    if (items.length === 0) { toast.error('Agregá al menos un ítem'); return; }

    setSaving(true);
    try {
      const payload = {
        tipo:           derivarTipo(),
        estado:         'presupuesto',
        cliente_id:     clienteId,
        tipo_proyecto:  tipoProyecto || null,
        forma_pago:     formaPago || null,
        tiempo_entrega: tiempoEntrega ? parseInt(tiempoEntrega) : null,
        notas:          notas || null,
        notas_internas: notasInternas || null,
        fecha_validez:  fechaValidez || null,
        forma_envio:    formaEnvio,
        costo_envio:    costoEnvio,
        items: items.map((it, idx) => ({
          tipo_abertura_id:    it.tipo_abertura_id || null,
          sistema_id:          it.sistema_id || null,
          descripcion:         it.descripcion || '',
          medida_ancho:        it.medida_ancho ? parseFloat(it.medida_ancho) : null,
          medida_alto:         it.medida_alto  ? parseFloat(it.medida_alto)  : null,
          cantidad:            it.cantidad,
          costo_unitario:      it.costo_unitario,
          precio_unitario:     it.precio_unitario,
          incluye_instalacion: it.incluye_instalacion,
          costo_instalacion:   it.costo_instalacion,
          precio_instalacion:  it.precio_instalacion,
          vidrio:              it.vidrio || null,
          premarco:            it.premarco,
          origen:              it.origen,
          color:               it.color || null,
          accesorios:          it.accesorios,
          orden:               idx,
          producto_id:         it.producto_id || null,
        })),
      };
      const op = isEdit
        ? await api.put<{ id: string; numero: string }>(`/operaciones/${editId}`, payload)
        : await api.post<{ id: string; numero: string }>('/operaciones', payload);
      toast.success(isEdit ? `Presupuesto ${op.numero} actualizado` : `Presupuesto ${op.numero} creado`);
      if (abrirPdf) {
        setSavedId(op.id);
      } else {
        navigate('/presupuestos');
      }
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // ── Filtrado galería ──────────────────────────────────────────────────────────
  const productosFiltrados = productos.filter(p => {
    const q = galSearch.toLowerCase();
    const matchSearch = !q
      || p.nombre.toLowerCase().includes(q)
      || (p.codigo ?? '').toLowerCase().includes(q)
      || (p.tipo_abertura?.nombre ?? '').toLowerCase().includes(q)
      || (p.sistema?.nombre ?? '').toLowerCase().includes(q)
      || (p.caracteristica_1 ?? '').toLowerCase().includes(q)
      || (p.caracteristica_2 ?? '').toLowerCase().includes(q);
    const matchCat = !categoriaSel || p.tipo_abertura_id === categoriaSel;
    return matchSearch && matchCat;
  });

  // Para tab "frecuentes": productos ya en carrito primero
  const productosOrdenados = tab === 'frecuentes'
    ? [...productosFiltrados].sort((a, b) => {
        const enA = items.some(it => it.producto_id === a.id) ? -1 : 1;
        const enB = items.some(it => it.producto_id === b.id) ? -1 : 1;
        return enA - enB;
      })
    : productosFiltrados;

  // Validez label
  const fechaValidezLabel = fechaValidez
    ? new Date(fechaValidez + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const entregaEstimadaLabel = tiempoEntrega ? (() => {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(tiempoEntrega));
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  })() : null;

  const clienteNombre = clienteSeleccionado
    ? (clienteSeleccionado.tipo_persona === 'juridica'
        ? clienteSeleccionado.razon_social ?? ''
        : `${clienteSeleccionado.nombre ?? ''} ${clienteSeleccionado.apellido ?? ''}`.trim())
    : '';
  const clienteIniciales = clienteNombre
    ? clienteNombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  // ── Validación de 5 pasos ────────────────────────────────────────────────────
  const formaEnvioLabel = FORMAS_ENVIO.find(f => f.value === formaEnvio)?.label.split('(')[0].trim() ?? '—';

  const pasos = [
    {
      titulo: 'Carga de cliente',
      subtitulo: clienteId ? clienteNombre.split(' ').slice(0, 2).join(' ') || 'Cargado' : 'Completar datos',
      done: !!clienteId,
      tieneDefault: false,
      defaultLabel: null,
    },
    {
      titulo: 'Forma de pago',
      subtitulo: formaPago || 'Seleccionar opción',
      done: !!formaPago && userSetFormaPago,
      tieneDefault: true,
      defaultLabel: 'Precio de lista',
    },
    {
      titulo: 'Entrega',
      subtitulo: formaEnvioLabel,
      done: !!formaEnvio && userSetFormaEnvio,
      tieneDefault: true,
      defaultLabel: 'Retira en local',
    },
    {
      titulo: 'Validez',
      subtitulo: validezDias !== 'custom'
        ? `${validezDias}d`
        : fechaValidezLabel !== '—' ? `Hasta ${fechaValidezLabel}` : 'Sin definir',
      done: !!fechaValidez && userSetFechaValidez,
      tieneDefault: true,
      defaultLabel: '7 días',
    },
    {
      titulo: 'Agregar producto',
      subtitulo: items.length > 0
        ? `${items.length} producto${items.length > 1 ? 's' : ''}`
        : 'Seleccionar productos',
      done: items.length > 0,
      tieneDefault: false,
      defaultLabel: null,
    },
  ];

  const todosCompletos = pasos.every(p => p.done);
  const pasosIncompletos = pasos.filter(p => !p.done);
  const puedeAvanzarConDefaults = pasosIncompletos.every(p => p.tieneDefault);

  function handleGenerarProforma() {
    if (todosCompletos) {
      handleSave(true);
      return;
    }
    setShowValidacionModal(true);
  }

  function avanzarConDefaults() {
    setUserSetFormaPago(true);
    setUserSetFormaEnvio(true);
    if (!userSetFechaValidez && fechaValidez) setUserSetFechaValidez(true);
    setShowValidacionModal(false);
    handleSave(true);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const editItemData = editItemKey ? items.find(it => it._key === editItemKey) : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

      {/* ── MODAL VALIDACIÓN DE PASOS ── */}
      {showValidacionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle size={18} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Faltan completar pasos</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {puedeAvanzarConDefaults
                    ? 'Podés avanzar con los valores por defecto o volver a completarlos.'
                    : 'Completá los campos obligatorios para generar la proforma.'}
                </p>
              </div>
            </div>

            {/* Lista de pasos incompletos */}
            <div className="px-6 py-4 space-y-2">
              {pasosIncompletos.map((p, i) => (
                <div key={i} className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
                  p.tieneDefault ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'
                )}>
                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white',
                    p.tieneDefault ? 'bg-amber-400' : 'bg-red-400'
                  )}>
                    {pasos.indexOf(p) + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-semibold', p.tieneDefault ? 'text-amber-800' : 'text-red-800')}>
                      {p.titulo}
                    </p>
                    {p.tieneDefault && p.defaultLabel && (
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        Valor por defecto: <span className="font-semibold">{p.defaultLabel}</span>
                      </p>
                    )}
                    {!p.tieneDefault && (
                      <p className="text-[11px] text-red-500 mt-0.5">Obligatorio — no tiene valor por defecto</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Acciones */}
            <div className="px-6 py-4 border-t border-gray-200 flex flex-col gap-2">
              {puedeAvanzarConDefaults && (
                <button
                  onClick={avanzarConDefaults}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Avanzar con valores por defecto
                </button>
              )}
              <button
                onClick={() => setShowValidacionModal(false)}
                className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
              >
                Volver y seguir cargando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        {/* Izquierda */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0"
          >
            <ArrowLeft size={17} className="text-gray-500" />
          </button>
          <h1 className="text-sm font-bold text-gray-900">
            {isEdit ? 'Editar presupuesto' : 'Nuevo presupuesto'}
          </h1>
        </div>

        {/* Derecha: acciones */}
        <div className="flex items-center gap-2">
          <HelpButton topic="presupuestos" />
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            Guardar borrador
          </button>
          <div className="hidden sm:flex">
            <button
              onClick={handleGenerarProforma}
              disabled={saving}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 text-white rounded-l-xl text-xs font-semibold transition-colors disabled:opacity-50',
                todosCompletos
                  ? 'bg-[#10b981] hover:bg-emerald-600'
                  : 'bg-amber-500 hover:bg-amber-600'
              )}
            >
              <FileText size={14} />
              {saving ? 'Guardando...' : 'Generar proforma'}
              {!todosCompletos && <span className="ml-1 bg-white/20 rounded-full px-1.5 text-[10px] font-bold">{pasosIncompletos.length}</span>}
            </button>
            <button className="px-2 py-1.5 bg-[#10b981] hover:bg-emerald-600 text-white rounded-r-xl border-l border-emerald-500 transition-colors">
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── INFO BAR ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-1 flex items-center gap-3">

        {/* Card 1: Cliente */}
        <div className="flex items-center gap-3 min-w-0 flex-1 border-r border-gray-200 pr-3">
          {clienteSeleccionado ? (
            <>
              <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">{clienteIniciales}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{clienteNombre}</p>
                {clienteSeleccionado.telefono && (
                  <p className="text-[10px] text-gray-400">{clienteSeleccionado.telefono}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setClienteId(''); setClienteSearch(''); }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg"
                  title="Cambiar cliente"
                >
                  <Edit2 size={12} className="text-gray-400" />
                </button>
                {clienteSeleccionado.telefono && (
                  <a
                    href={`https://wa.me/${clienteSeleccionado.telefono.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 hover:bg-green-50 rounded-lg"
                    title="WhatsApp"
                  >
                    <MessageCircle size={12} className="text-green-500" />
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0 relative">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Phone size={11} className="text-gray-300" />
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Seleccionar cliente..."
                  value={clienteSearch}
                  onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
                  onFocus={() => setShowClienteList(true)}
                  onBlur={() => setTimeout(() => setShowClienteList(false), 150)}
                  className="w-full bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
                />
                {showClienteList && clienteSearch && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto w-72">
                    {clientes.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        No encontrado.{' '}
                        <button
                          className="text-violet-600 hover:underline"
                          onMouseDown={() => navigate('/clientes/nuevo?nombre=' + clienteSearch)}
                        >
                          Crear cliente
                        </button>
                      </div>
                    ) : clientes.slice(0, 8).map(c => (
                      <button
                        key={c.id}
                        onMouseDown={() => { setClienteId(c.id); setClienteSearch(''); setShowClienteList(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0"
                      >
                        <span className="text-sm text-gray-800">
                          {c.tipo_persona === 'juridica' ? c.razon_social : `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim()}
                        </span>
                        <span className="text-xs text-gray-400">{c.telefono ?? ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Forma de pago */}
        <div className="flex items-center gap-2 shrink-0 border-r border-gray-200 pr-3">
          <div>
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Forma de pago</p>
            <select
              value={formaPago}
              onChange={e => { setFormaPago(e.target.value); setUserSetFormaPago(true); }}
              className="text-xs font-medium text-gray-700 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer pr-4 max-w-[170px]"
            >
              {FORMA_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Card 3: Entrega / Instalación */}
        <div className="flex items-center gap-2 shrink-0 border-r border-gray-200 pr-3">
          <div>
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Entrega / Instalación</p>
            <select
              value={formaEnvio}
              onChange={e => { setFormaEnvio(e.target.value); setUserSetFormaEnvio(true); }}
              className="text-xs font-medium text-gray-700 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer pr-4"
            >
              {FORMAS_ENVIO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>

        {/* Card 4: Validez */}
        <div className="flex items-center gap-2 shrink-0">
          <div>
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Validez</p>
            <div className="flex items-center gap-1.5">
              {([7, 15, 30] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setValidezDias(d);
                    const f = new Date(); f.setDate(f.getDate() + d);
                    setFechaValidez(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`);
                    setUserSetFechaValidez(true);
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-semibold border transition-all',
                    validezDias === d
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-400 hover:border-violet-300 hover:text-violet-600'
                  )}
                >
                  {d}d
                </button>
              ))}
              <span className="text-[10px] text-gray-500 ml-1">hasta {fechaValidezLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE PROGRESO — 5 pasos ── */}
      {(() => {
        return (
          <div className="bg-white border-b border-gray-200 px-4 py-1 shrink-0">
            <div className="flex items-center">
              {pasos.map((paso, i) => {
                const lineColor = i < pasos.length - 1
                  ? (paso.done ? 'bg-green-400' : 'bg-amber-200')
                  : '';
                return (
                  <Fragment key={i}>
                    {/* Step */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0" style={{ minWidth: 80 }}>
                      {/* Círculo */}
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all',
                        paso.done ? 'bg-green-500' : 'bg-amber-400'
                      )}>
                        {paso.done
                          ? <Check size={11} className="text-white" strokeWidth={3} />
                          : <span className="text-[10px] font-bold text-white">{i + 1}</span>
                        }
                      </div>
                      {/* Labels */}
                      <div className="text-center px-0.5">
                        <p className={cn('text-[9px] font-bold uppercase tracking-wide leading-tight',
                          paso.done ? 'text-green-600' : 'text-amber-600'
                        )}>
                          {paso.titulo}
                        </p>
                        <p className={cn('text-[8px] leading-snug max-w-[72px] hidden sm:block',
                          paso.done ? 'text-gray-400' : 'text-amber-500'
                        )}>
                          {paso.subtitulo}
                        </p>
                      </div>
                    </div>
                    {/* Línea conectora */}
                    {i < pasos.length - 1 && (
                      <div className={cn('flex-1 h-0.5 mb-4 mx-0.5 transition-all', lineColor)} />
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── CUERPO 3 COLUMNAS ── */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[340px_1fr_240px] xl:grid-cols-[420px_1fr_280px] gap-3 xl:gap-4 p-3 xl:p-4">

        {/* ─────────────────────── COLUMNA IZQUIERDA — AGREGAR PRODUCTOS ─────────────────────── */}
        <div className="flex flex-col bg-white rounded-xl shadow-md overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-bold">1</span>
            </div>
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Agregar productos</span>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {([
              { key: 'galeria',   icon: LayoutGrid, label: 'Galería' },
              { key: 'buscar',    icon: Search,     label: 'Buscador' },
              { key: 'frecuentes',icon: Star,       label: 'Frecuentes' },
              { key: 'scanner',   icon: ScanLine,   label: 'Código' },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors border-b-2',
                  tab === key
                    ? 'border-violet-600 text-violet-700 bg-violet-50'
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Contenido del tab */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* TAB: Galería / Frecuentes */}
            {(tab === 'galeria' || tab === 'frecuentes') && (
              <>
                {/* Search bar */}
                <div className="px-3 py-2 border-b border-gray-50">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400">
                    <Search size={12} className="text-gray-300 shrink-0" />
                    <input
                      value={galSearch}
                      onChange={e => setGalSearch(e.target.value)}
                      placeholder="Buscar producto, medida o código..."
                      className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
                    />
                    {galSearch && (
                      <button onMouseDown={() => setGalSearch('')} className="text-gray-300 hover:text-gray-500">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Category pills */}
                <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-gray-50 shrink-0">
                  <button
                    onClick={() => setCategoriaSel('')}
                    className={cn(
                      'shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors whitespace-nowrap',
                      !categoriaSel ? 'bg-violet-600 text-white' : 'border border-gray-200 text-gray-500 hover:border-violet-300'
                    )}
                  >
                    Todas
                  </button>
                  {tiposAbertura.map(ta => (
                    <button
                      key={ta.id}
                      onClick={() => setCategoriaSel(ta.id === categoriaSel ? '' : ta.id)}
                      className={cn(
                        'shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors whitespace-nowrap',
                        categoriaSel === ta.id ? 'bg-violet-600 text-white' : 'border border-gray-200 text-gray-500 hover:border-violet-300'
                      )}
                    >
                      {ta.nombre}
                    </button>
                  ))}
                </div>

                {/* Grid de productos */}
                <div className="flex-1 overflow-y-auto p-3">
                  {productosLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400 text-xs">Cargando...</div>
                  ) : productosOrdenados.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-gray-400 text-xs">Sin resultados</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {productosOrdenados.map(p => {
                        const img = p.imagenes?.[0] || p.imagen_url;
                        const enCarrito = items.some(it => it.producto_id === p.id);
                        return (
                          <div
                            key={p.id}
                            className={cn(
                              'relative rounded-lg border overflow-hidden cursor-pointer transition-all hover:shadow-md group',
                              enCarrito ? 'border-violet-400 ring-1 ring-violet-300' : 'border-gray-200 hover:border-violet-300'
                            )}
                            onClick={() => agregarProducto(p)}
                          >
                            {/* Imagen */}
                            <div className="h-20 bg-gray-50 overflow-hidden">
                              {img
                                ? <img src={img} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                : <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-gray-200" /></div>
                              }
                            </div>
                            {/* En carrito badge */}
                            {enCarrito && (
                              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-violet-600 rounded-full flex items-center justify-center">
                                <CheckCircle2 size={10} className="text-white" />
                              </span>
                            )}
                            {/* Info */}
                            <div className="p-2">
                              {p.codigo && (
                                <span className="font-mono text-[8px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded mb-1 inline-block">{p.codigo}</span>
                              )}
                              <p className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2">{p.nombre}</p>
                              {(p.ancho || p.alto) && (
                                <p className="text-[9px] text-sky-600 font-bold mt-0.5 font-mono">
                                  {[p.ancho && `${p.ancho}cm`, p.alto && `${p.alto}cm`].filter(Boolean).join(' × ')}
                                </p>
                              )}
                              <p className="text-xs font-bold text-[#7c3aed] mt-1">{formatCurrency(Number(p.precio_base))}</p>
                            </div>
                            {/* Botón + */}
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); agregarProducto(p); }}
                              className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-md"
                            >
                              <Plus size={12} className="text-white" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB: Buscador */}
            {tab === 'buscar' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-3 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400">
                    <Search size={14} className="text-gray-300 shrink-0" />
                    <input
                      autoFocus
                      value={buscarSearch}
                      onChange={e => setBuscarSearch(e.target.value)}
                      placeholder="Buscar producto..."
                      className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none"
                    />
                    {buscarSearch && (
                      <button onMouseDown={() => { setBuscarSearch(''); setBuscarResults([]); }} className="text-gray-300 hover:text-gray-500">
                        <X size={12} />
                      </button>
                    )}
                    {buscarLoading && <Search size={12} className="text-gray-300 animate-pulse shrink-0" />}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {buscarResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-xs gap-2">
                      <Search size={24} className="text-gray-200" />
                      {buscarSearch ? 'Sin resultados' : 'Escribí para buscar'}
                    </div>
                  ) : buscarResults.map(p => {
                    const img = p.imagenes?.[0] || p.imagen_url;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => agregarProducto(p)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50 border-b border-gray-50 last:border-0 text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          {img
                            ? <img src={img} alt={p.nombre} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Package size={14} className="text-gray-300" /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{p.nombre}</p>
                          {p.codigo && <p className="font-mono text-[9px] text-gray-400">{p.codigo}</p>}
                        </div>
                        <span className="text-xs font-bold text-violet-700 shrink-0">{formatCurrency(Number(p.precio_base))}</span>
                        <Plus size={14} className="text-emerald-500 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB: Scanner */}
            {tab === 'scanner' && (
              <div className="flex flex-col flex-1 p-4 gap-4 overflow-hidden">
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 py-3 border-2 border-violet-300 bg-violet-50 rounded-xl focus-within:ring-2 focus-within:ring-violet-400">
                    <ScanLine size={18} className="text-violet-400 shrink-0" />
                    <input
                      ref={codigoRef}
                      autoFocus
                      value={codigoSearch}
                      onChange={e => setCodigoSearch(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); buscarCodigo(codigoSearch, true); }
                        if (e.key === 'Escape') { setCodigoSearch(''); setShowCodigo(false); }
                      }}
                      onFocus={() => codigoSearch && setShowCodigo(true)}
                      onBlur={() => setTimeout(() => setShowCodigo(false), 150)}
                      placeholder="Escanear código de barras..."
                      className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-violet-300 focus:outline-none font-mono"
                    />
                    {codigoLoading
                      ? <Search size={13} className="text-violet-300 animate-pulse shrink-0" />
                      : codigoSearch && (
                        <button onMouseDown={() => { setCodigoSearch(''); setCodigoResults([]); setShowCodigo(false); }} className="text-violet-300 hover:text-violet-500">
                          <X size={13} />
                        </button>
                      )
                    }
                  </div>
                  {showCodigo && codigoResults.length > 0 && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {codigoResults.map(p => (
                        <button key={p.id} type="button"
                          onMouseDown={() => agregarProducto(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-violet-50 border-b border-gray-50 last:border-0 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {p.codigo && (
                                <span className="font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">{p.codigo}</span>
                              )}
                              <span className="text-sm font-medium text-gray-800 truncate">{p.nombre}</span>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-violet-700 shrink-0">{formatCurrency(Number(p.precio_base))}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-violet-400 text-center">Escanear código de barras — Enter agrega automáticamente</p>
              </div>
            )}
          </div>
        </div>

        {/* ─────────────────────── COLUMNA CENTRAL — PRODUCTOS AGREGADOS ─────────────────────── */}
        <div className="flex flex-col bg-white rounded-xl shadow-md overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">2</span>
              </div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Productos agregados</span>
              {items.length > 0 && (
                <span className="text-[10px] text-gray-400">({items.length})</span>
              )}
            </div>
            <button
              onClick={() => setItems(prev => [...prev, emptyItem()])}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 border border-gray-200 hover:border-violet-300 hover:text-violet-600 text-gray-500 rounded-lg font-medium transition-colors"
            >
              <Plus size={11} /> Ítem manual
            </button>
          </div>

          {/* Tabla header */}
          <div className="grid bg-[#031d49] text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2" style={{ gridTemplateColumns: '1fr 80px 100px 100px 100px 40px' }}>
            <span>Producto</span>
            <span className="text-center">Medida</span>
            <span className="text-center">Cant.</span>
            <span className="text-right">Precio unit.</span>
            <span className="text-right">Subtotal</span>
            <span></span>
          </div>

          {/* Filas del carrito */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 text-gray-400">
                <ScanLine size={32} className="text-gray-200 mb-3" />
                <p className="text-sm font-medium">Sin productos</p>
                <p className="text-xs text-gray-300 mt-1">Usá la galería de la izquierda para agregar</p>
              </div>
            ) : items.map((item, idx) => {
              const img = item._prod_imagen_url;
              const medida = item.medida_ancho && item.medida_alto
                ? `${item.medida_ancho}×${item.medida_alto}`
                : item._prod_ancho && item._prod_alto
                ? `${item._prod_ancho}×${item._prod_alto}`
                : '—';
              const subtotal = itemPrecioTotal(item);
              return (
                <div
                  key={item._key}
                  className={cn(
                    'grid items-center px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50/50 transition-colors',
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  )}
                  style={{ gridTemplateColumns: '1fr 80px 100px 100px 100px 40px' }}
                >
                  {/* Producto info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {img
                        ? <img src={img} alt={item.descripcion} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-300" /></div>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{item.descripcion || 'Sin descripción'}</p>
                      {(item._prod_tipo_nombre || item._prod_sistema_nombre) && (
                        <p className="text-[9px] text-gray-400">
                          {[item._prod_tipo_nombre, item._prod_sistema_nombre].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {item.color && <p className="text-[9px] text-gray-400">{item.color}</p>}
                    </div>
                  </div>

                  {/* Medida */}
                  <div className="text-center">
                    <span className="text-xs text-gray-500">{medida}</span>
                  </div>

                  {/* Cantidad */}
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => updateItem(item._key, 'cantidad', Math.max(1, item.cantidad - 1))}
                      className="w-6 h-6 border border-gray-200 rounded hover:border-violet-400 hover:text-violet-600 flex items-center justify-center text-gray-400 transition-colors"
                    >
                      <span className="text-xs leading-none">−</span>
                    </button>
                    <span className="text-xs font-semibold w-6 text-center">{item.cantidad}</span>
                    <button
                      onClick={() => updateItem(item._key, 'cantidad', item.cantidad + 1)}
                      className="w-6 h-6 border border-gray-200 rounded hover:border-violet-400 hover:text-violet-600 flex items-center justify-center text-gray-400 transition-colors"
                    >
                      <Plus size={10} />
                    </button>
                  </div>

                  {/* Precio unit */}
                  <div className="text-right">
                    <span className="text-xs text-gray-700">{formatCurrency(item.precio_unitario)}</span>
                    {item.incluye_instalacion && (
                      <p className="text-[8px] text-violet-500">+inst. {formatCurrency(item.precio_instalacion)}</p>
                    )}
                  </div>

                  {/* Subtotal */}
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-800">{formatCurrency(subtotal)}</span>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      onClick={() => setEditItemKey(item._key)}
                      className="p-1 hover:bg-violet-50 rounded text-gray-300 hover:text-violet-600 transition-colors"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={() => setItems(prev => prev.filter(it => it._key !== item._key))}
                      className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notas toggle */}
          <div className="border-t border-gray-200">
            <button
              onClick={() => setShowNotas(v => !v)}
              className="w-full px-4 py-2 text-left text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
            >
              <ChevronDown size={12} className={cn('transition-transform', showNotas ? 'rotate-0' : '-rotate-90')} />
              Agregar observaciones
            </button>
            {showNotas && (
              <div className="px-4 pb-3">
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Notas para el cliente..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                />
              </div>
            )}
          </div>

          {/* Footer con totales */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Total productos: <span className="font-semibold text-gray-600">{items.length}</span>
              {' '}|{' '}
              Cantidad total: <span className="font-semibold text-gray-600">{items.reduce((s, it) => s + it.cantidad, 0)}</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total</p>
              <p className="text-xl font-black text-[#031d49]">{formatCurrency(totalConEnvio)}</p>
            </div>
          </div>
        </div>

        {/* ─────────────────────── COLUMNA DERECHA — RESUMEN ─────────────────────── */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-md sticky top-4 self-start w-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">3</span>
              </div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Resumen de la proforma</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Breakdown de precios */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Subtotal</span>
                  <span className="text-xs font-semibold text-gray-700">{formatCurrency(precioTotal)}</span>
                </div>
                {formaEnvio === 'envio_empresa' && costoEnvio > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Envío</span>
                    <span className="text-xs font-semibold text-gray-700">{formatCurrency(costoEnvio)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-900">TOTAL</span>
                  <span className="text-lg font-black text-[#7c3aed]">{formatCurrency(totalConEnvio)}</span>
                </div>
                {formaPago === 'Tarjeta de crédito 3 cuotas sin interés' && totalConEnvio > 0 && (
                  <p className="text-[10px] text-violet-600 text-right">3 cuotas de {formatCurrency(totalConEnvio / 3)}</p>
                )}
              </div>

              {/* Forma de envío */}
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Forma de envío</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {FORMAS_ENVIO.map(({ value, label, icon: Icon, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setFormaEnvio(value); setUserSetFormaEnvio(true); }}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] font-medium transition-all',
                        formaEnvio === value
                          ? 'border-violet-400 bg-violet-50 text-violet-700'
                          : 'border-gray-200 text-gray-400 hover:border-gray-200 bg-gray-50'
                      )}
                    >
                      <Icon size={12} className={formaEnvio === value ? 'text-violet-500' : color} />
                      <span className="text-center leading-tight">{label.split('(')[0].trim()}</span>
                    </button>
                  ))}
                </div>
                {formaEnvio === 'envio_empresa' && (
                  <div className="mt-2">
                    <label className="text-[9px] text-gray-400 uppercase tracking-wider block mb-1">Importe del envío</label>
                    <MontoInput
                      value={costoEnvio ? String(costoEnvio) : ''}
                      onChange={v => setCostoEnvio(parseFloat(v) || 0)}
                      placeholder="0,00"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Entrega estimada */}
              {tiempoEntrega && (
                <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Entrega estimada</p>
                  <p className="text-xs font-bold text-gray-700">En {tiempoEntrega} días hábiles</p>
                  {entregaEstimadaLabel && <p className="text-[10px] text-gray-400">{entregaEstimadaLabel}</p>}
                </div>
              )}

              {/* Días de entrega input */}
              <div>
                <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Tiempo de entrega (días)</label>
                <input
                  type="number" min={0} value={tiempoEntrega}
                  onChange={e => setTiempoEntrega(e.target.value)}
                  placeholder="Ej: 15"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
              </div>

              {/* Validez */}
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Validez</p>
                <p className="text-xs text-gray-600">Válido hasta: <span className="font-semibold">{fechaValidezLabel}</span></p>
              </div>

              {/* Condiciones */}
              <div className="space-y-1.5 border-t border-gray-200 pt-3">
                {[
                  validezDias === 'custom' ? 'Presupuesto sujeto a validez' : `Presupuesto válido ${validezDias} días`,
                  'Los precios incluyen IVA',
                  'Sujeto a disponibilidad de stock',
                ].map((cond, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                    <span className="text-[10px] text-gray-500">{cond}</span>
                  </div>
                ))}
              </div>

              {/* Notas colapsadas */}
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <details className="group">
                  <summary className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 list-none flex items-center gap-1">
                    <ChevronDown size={10} className="transition-transform group-open:rotate-0 -rotate-90" />
                    Notas para el cliente
                  </summary>
                  <textarea
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    rows={2}
                    placeholder="Condiciones, aclaraciones..."
                    className="mt-2 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                  />
                </details>
                <details className="group">
                  <summary className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 list-none flex items-center gap-1">
                    <ChevronDown size={10} className="transition-transform group-open:rotate-0 -rotate-90" />
                    Notas internas
                  </summary>
                  <textarea
                    value={notasInternas}
                    onChange={e => setNotasInternas(e.target.value)}
                    rows={2}
                    placeholder="Solo para el equipo..."
                    className="mt-2 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                  />
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal edición ítem ── */}
      {editItemKey && editItemData && (
        <EditItemModal
          item={editItemData}
          tiposAbertura={tiposAbertura}
          sistemas={sistemas}
          coloresDB={coloresDB}
          onChange={updateItem}
          onClose={() => setEditItemKey(null)}
        />
      )}

      {/* ── PDF Dialog ── */}
      {savedId && (
        <PDFDialog
          title={isEdit ? 'Presupuesto actualizado' : 'Presupuesto creado'}
          subtitle="¿Querés generar el PDF o compartir con el cliente?"
          pdfUrl={`/imprimir/presupuesto/${savedId}`}
          onClose={() => { setSavedId(null); navigate(`/operaciones/${savedId}`); }}
          onNavigate={() => navigate(`/operaciones/${savedId}`)}
          navigateLabel="Ver presupuesto"
          operacionId={savedId}
          clienteNombre={clienteNombre}
          clienteTelefono={clienteSeleccionado?.telefono ?? undefined}
        />
      )}

      {/* suppress unused-var lint only */}
      {editEstado && false && <span>{editEstado}</span>}
      {tipoProyecto && false && <span>{tipoProyecto}</span>}

      {/* ── BOTÓN FLOTANTE — Generar proforma (siempre visible) ── */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#10b981] hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold shadow-lg transition-colors disabled:opacity-50"
        >
          <FileText size={15} />
          {saving ? 'Guardando...' : 'Generar proforma'}
        </button>
      </div>
    </div>
  );
}
