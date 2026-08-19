import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, FileText, ChevronDown, ScanLine, Search,
  Package, X, LayoutGrid, MapPin, Star, Edit2,
  Phone, MessageCircle, CheckCircle2, Users, Eye,
  Ruler, Wrench, AlertTriangle, Tag,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn, disponibilidadVigente } from '@/lib/utils';
import { HelpButton } from '@/components/HelpButton';
import { toast } from 'sonner';
import type { Cliente, TipoAbertura, Sistema, Producto } from '@/types';
import { PDFDialog } from '@/components/PDFDialog';
import { ProductoModal } from './Productos';
import { EditItemModal } from '@/components/EditItemModal';

// ── Catálogos estáticos ───────────────────────────────────────────────────────

const TIPOS_PROYECTO = [
  'Vivienda', 'Frente comercial', 'Quincho', 'Baño', 'Habitación', 'Obra completa',
];

const FORMA_PAGO = [
  'Tarjeta de crédito 3 cuotas sin interés',
  'Precio de lista',
  'Contado',
  'Tarjeta de débito/crédito en 1 pago',
  'Transferencia',
  'Varias formas de pago',
];

interface FormaPagoCatalogo {
  id: string; nombre: string; descuento_pct: number;
}
interface FormaPagoAlternativa {
  forma_pago_id: string; nombre: string; descuento_pct: number;
}

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

interface ServicioCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_base: number | null;
}

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
  modelo_id: string | null;
  modelo_nombre: string | null;
  disponibilidad_confirmada_at: string | null;
  promocion: {
    activo: boolean;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    precio_oferta: number | null;
    auto_renovar?: boolean;
  } | null;
}

// Misma regla que Productos.tsx: activo, dentro de vigencia (o auto-renovar mensual)
function isPromoActiva(p: CatalogProduct): boolean {
  if (!p.promocion?.activo) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  if (p.promocion.fecha_inicio && hoy < p.promocion.fecha_inicio) return false;
  if (p.promocion.auto_renovar) return true;
  if (p.promocion.fecha_fin && hoy > p.promocion.fecha_fin) return false;
  return true;
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
    precio_lista?: number | null;
    incluye_instalacion: boolean; costo_instalacion: number; precio_instalacion: number;
    vidrio: string | null; premarco: boolean; origen: string | null;
    color: string | null; accesorios: string[]; producto_id: string | null;
    calculo_url: string | null;
    tipo_item?: 'estandar' | 'a_medida' | 'servicio';
    servicio_id?: string | null;
    tipo_abertura_nombre: string | null; sistema_nombre: string | null;
    producto_disponibilidad_confirmada_at?: string | null;
    stock_actual?: number | null;
  }>;
  formas_pago_alternativas?: Array<{ forma_pago_id: string | null; nombre: string; descuento_pct: number }>;
  visita_tecnica: { id: string; numero: string; estado: string } | null;
}

// ── Ítem del formulario ────────────────────────────────────────────────────────

interface ItemForm {
  _key: string;
  producto_id: string;
  tipo_item: 'estandar' | 'a_medida' | 'servicio' | 'a_relevar';
  servicio_id: string;
  tipo_abertura_id: string;
  sistema_id: string;
  descripcion: string;
  medida_ancho: string;
  medida_alto: string;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  precio_lista: number | null;  // seteado solo si vino de un producto con promoción activa
  incluye_instalacion: boolean;
  costo_instalacion: number;
  precio_instalacion: number;
  vidrio: string;
  premarco: boolean;
  origen: 'proveedor' | 'fabricacion';
  color: string;
  accesorios: string[];
  calculo_url: string;   // adjunto del cálculo del software externo (a medida)
  _atribAbrev: Record<string, string>; // selección de atributos abreviados (a_medida) — se resume en descripcion, no se persiste aparte
  // datos del producto vinculado (solo lectura en UI)
  _prod_ancho: number | null;
  _prod_alto: number | null;
  _prod_atributos: Record<string, unknown>;
  _prod_stock: number;
  _prod_tipo_nombre: string;
  _prod_sistema_nombre: string;
  _prod_imagen_url: string | null;
  _prod_disponibilidad_confirmada_at: string | null;
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
    servicio_id: '',
    tipo_abertura_id: '', sistema_id: '', descripcion: '',
    medida_ancho: '', medida_alto: '',
    cantidad: 1,
    costo_unitario: 0, precio_unitario: 0, precio_lista: null,
    incluye_instalacion: false, costo_instalacion: 0, precio_instalacion: 0,
    vidrio: '', premarco: false, origen: 'proveedor', color: '', accesorios: [],
    calculo_url: '', _atribAbrev: {},
    _prod_ancho: null, _prod_alto: null, _prod_atributos: {}, _prod_stock: 0,
    _prod_tipo_nombre: '', _prod_sistema_nombre: '',
    _prod_imagen_url: null,
    _prod_disponibilidad_confirmada_at: null,
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

// ── Página principal ──────────────────────────────────────────────────────────

export function NuevoPresupuesto() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id?: string }>();
  const isEdit = !!editId;
  // Si se llegó acá recotizando una oportunidad futura (OportunidadCard "Recotizar"),
  // al guardar hay que marcarla convertida y vincular este presupuesto.
  const oportunidadId = searchParams.get('oportunidad_id');
  const editLoadedRef = useRef(false);
  const itemsPrecargadosRef = useRef(false);
  const clienteInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [editEstado, setEditEstado] = useState('');
  const [visitaTecnicaId, setVisitaTecnicaId] = useState('');
  const [imagenesVisita, setImagenesVisita] = useState<string[]>([]);
  const [visitaCredito, setVisitaCredito] = useState<{ numero: string; monto: number } | null>(null);
  const [numeroActual, setNumeroActual] = useState('');
  const [visitaPendiente, setVisitaPendiente] = useState<{ id: string; numero: string } | null>(null);

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
  const [catalogoFormasPago, setCatalogoFormasPago] = useState<FormaPagoCatalogo[]>([]);
  const [formasPagoAlternativas, setFormasPagoAlternativas] = useState<FormaPagoAlternativa[]>([]);
  const [tiempoEntrega, setTiempoEntrega]   = useState('');
  const [fechaValidez, setFechaValidez]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [validezDias, setValidezDias]       = useState<number | 'custom'>(7);
  const [notas, setNotas]                   = useState('');
  const [notasInternas, setNotasInternas]   = useState('');

  // Envío — ya no se decide acá (queda fijo en 'retiro_local'); si una edición vieja
  // tenía envío a cargo de la empresa con costo, se preserva tal cual al guardar.
  const [formaEnvio, setFormaEnvio] = useState('retiro_local');
  const [costoEnvio, setCostoEnvio] = useState(0);

  // Ítems
  const [items, setItems] = useState<ItemForm[]>([]);

  // Estado nuevo UI
  // Modo de carga: estándar (galería de catálogo), a medida (aberturas descritas a mano,
  // con precio costo/venta que da el software externo de cálculo), o servicio (reparación,
  // mantenimiento, cambio de piezas — desde catalogo_servicios o personalizado)
  const [modo, setModo] = useState<'estandar' | 'a_medida' | 'servicio' | 'a_relevar'>('estandar');
  const [descripcionARelevar, setDescripcionARelevar] = useState('');
  const [servicioSeleccionadoId, setServicioSeleccionadoId] = useState('');
  const esAMedida = modo === 'a_medida';
  const [tab, setTab] = useState<'galeria' | 'buscar' | 'frecuentes' | 'scanner'>('galeria');
  const [categoriaSel, setCategoriaSel] = useState('');
  const [galSearch, setGalSearch] = useState('');
  const [productos, setProductos] = useState<CatalogProduct[]>([]);
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([]);
  const [productosLoading, setProductosLoading] = useState(false);
  const [editItemKey, setEditItemKey] = useState<string | null>(null);
  const [showNotas, setShowNotas] = useState(false);

  // Modal "Ver más" — detalle de producto desde la galería
  const [detalleOriginal, setDetalleOriginal] = useState<CatalogProduct | null>(null);
  const [detalleProducto, setDetalleProducto] = useState<Producto | null>(null);

  function verDetalle(e: React.MouseEvent, p: CatalogProduct) {
    e.stopPropagation();
    setDetalleOriginal(p);
    api.get<Producto>(`/productos/${p.id}`)
      .then(setDetalleProducto)
      .catch(() => { toast.error('No se pudo cargar el detalle del producto'); setDetalleOriginal(null); });
  }

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
      api.get<ServicioCatalogo[]>('/catalogo/servicios'),
      api.get<FormaPagoCatalogo[]>('/catalogo/formas-pago'),
    ]).then(([ta, s, col, serv, fp]) => {
      setTiposAbertura(ta);
      setSistemas(s);
      setColoresDB(col);
      setServicios(serv);
      setCatalogoFormasPago(fp);
    });
    // Si viene ?cliente_id en URL, cargar ese cliente directamente
    const urlClienteId = searchParams.get('cliente_id');
    if (urlClienteId) {
      api.get<Cliente>(`/clientes/${urlClienteId}`).then(cl => setClientes([cl])).catch(() => {});
    }
    // Presupuesto nuevo sin cliente precargado (ni por URL ni por visita técnica):
    // foco directo en el buscador para poder escribir el nombre sin clickear primero
    const preId = (location.state as { clienteId?: string } | null)?.clienteId;
    if (!isEdit && !urlClienteId && !preId) {
      clienteInputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape en el modal de elegir cliente: no hay nada cargado todavía, así
  // que "salir" es directamente abandonar y volver al listado de presupuestos.
  useEffect(() => {
    if (isEdit || clienteId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') navigate('/presupuestos');
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isEdit, clienteId, navigate]);

  // Búsqueda de clientes por API con debounce
  useEffect(() => {
    const q = clienteSearch.trim();
    // Al limpiar el texto tras elegir un cliente, no pisar el que ya quedó seleccionado
    // (setClientes([c]) en el onMouseDown de abajo) — solo vaciar si no hay nada elegido.
    if (!q) { if (!clienteId) setClientes([]); return; }
    const t = setTimeout(() => {
      api.get<Cliente[]>(`/clientes?search=${encodeURIComponent(q)}`)
        .then(setClientes)
        .catch(() => setClientes([]));
    }, 250);
    return () => clearTimeout(t);
  }, [clienteSearch, clienteId]);

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
      setNumeroActual(op.numero);
      setClienteId(op.cliente_id);
      if (op.visita_tecnica && !['convertida', 'cancelada'].includes(op.visita_tecnica.estado)) {
        setVisitaPendiente({ id: op.visita_tecnica.id, numero: op.visita_tecnica.numero });
      }
      // Cargar cliente para mostrar nombre/teléfono en el header
      api.get<Cliente>(`/clientes/${op.cliente_id}`).then(cl => setClientes([cl])).catch(() => {});
      setTipoProyecto(op.tipo_proyecto ?? '');
      setFormaPago(op.forma_pago ?? 'Precio de lista');
      setFormasPagoAlternativas((op.formas_pago_alternativas ?? []).map(a => ({
        forma_pago_id: a.forma_pago_id ?? '', nombre: a.nombre, descuento_pct: Number(a.descuento_pct),
      })));
      setTiempoEntrega(op.tiempo_entrega ? String(op.tiempo_entrega) : '');
      setFechaValidez(op.fecha_validez ? op.fecha_validez.split('T')[0] : '');
      setValidezDias('custom');
      setNotas(op.notas ?? '');
      setNotasInternas(op.notas_internas ?? '');
      setFormaEnvio(op.forma_envio ?? 'retiro_local');
      setCostoEnvio(Number(op.costo_envio) || 0);
      // Reabrir en el mismo camino: si todos los ítems son del mismo modo, precargar esa pestaña
      {
        const tipos = new Set(op.items.map(it => it.tipo_item ?? (it.producto_id ? 'estandar' : (it.medida_ancho || it.medida_alto) ? 'a_medida' : 'estandar')));
        setModo(tipos.size === 1 ? [...tipos][0] as 'estandar' | 'a_medida' | 'servicio' : 'estandar');
      }
      setItems(op.items.map(it => ({
        _key: uuid(),
        producto_id:         it.producto_id ?? '',
        tipo_item:           it.tipo_item ?? ((it.medida_ancho || it.medida_alto) ? 'a_medida' : 'estandar'),
        servicio_id:         it.servicio_id ?? '',
        tipo_abertura_id:    it.tipo_abertura_id ?? '',
        sistema_id:          it.sistema_id ?? '',
        descripcion:         it.descripcion,
        medida_ancho:        it.medida_ancho ? String(it.medida_ancho) : '',
        medida_alto:         it.medida_alto  ? String(it.medida_alto)  : '',
        cantidad:            it.cantidad,
        costo_unitario:      Number(it.costo_unitario),
        precio_unitario:     Number(it.precio_unitario),
        precio_lista:        it.precio_lista != null ? Number(it.precio_lista) : null,
        incluye_instalacion: it.incluye_instalacion,
        costo_instalacion:   Number(it.costo_instalacion),
        precio_instalacion:  Number(it.precio_instalacion),
        vidrio:              it.vidrio ?? '',
        premarco:            it.premarco ?? false,
        origen:              (it.origen as 'proveedor' | 'fabricacion') ?? 'proveedor',
        color:               it.color ?? '',
        accesorios:          it.accesorios ?? [],
        calculo_url:         it.calculo_url ?? '',
        _atribAbrev: {},
        _prod_ancho: null, _prod_alto: null, _prod_atributos: {},
        _prod_stock:          it.stock_actual ?? 0,
        _prod_tipo_nombre:    it.tipo_abertura_nombre ?? '',
        _prod_sistema_nombre: it.sistema_nombre ?? '',
        _prod_imagen_url:     null,
        _prod_disponibilidad_confirmada_at: it.producto_disponibilidad_confirmada_at ?? null,
      })));
    }).catch(() => { toast.error('No se pudo cargar el presupuesto'); navigate('/presupuestos'); });
  }, [isEdit, editId, navigate]);

  // Precarga desde "Avanzar a presupuesto" en Visita Técnica
  useEffect(() => {
    if (isEdit || itemsPrecargadosRef.current) return;
    const state = location.state as {
      itemsPrecargados?: Array<{
        descripcion: string; medida_ancho: string; medida_alto: string;
        tipo_item?: 'a_medida' | 'servicio' | 'estandar'; producto_id?: string; servicio_id?: string;
        tipo_abertura_id?: string; sistema_id?: string; vidrio?: string; premarco?: boolean;
        accesorios?: string[]; color?: string; calculo_url?: string;
      }>;
      clienteId?: string;
      visitaTecnicaId?: string;
      imagenesVisita?: string[];
      visitaNumero?: string;
      visitaCobroEstado?: string;
      visitaCostoCobrado?: number | null;
    } | null;
    if (!state?.itemsPrecargados?.length) return;
    itemsPrecargadosRef.current = true;
    const precargados = state.itemsPrecargados;
    // Si todos los ítems relevados son del mismo tipo, arrancar en esa pestaña
    const tiposPrecarga = new Set(precargados.map(it => it.tipo_item ?? 'a_medida'));
    setModo(tiposPrecarga.size === 1 ? [...tiposPrecarga][0] : 'a_medida');

    const noEstandar = precargados
      .filter(it => it.tipo_item !== 'estandar')
      .map(it => ({
        ...emptyItem(), tipo_item: it.tipo_item ?? 'a_medida', descripcion: it.descripcion,
        medida_ancho: it.medida_ancho, medida_alto: it.medida_alto, servicio_id: it.servicio_id ?? '',
        tipo_abertura_id: it.tipo_abertura_id ?? '', sistema_id: it.sistema_id ?? '',
        vidrio: it.vidrio ?? '', premarco: it.premarco ?? false,
        accesorios: it.accesorios ?? [], color: it.color ?? '', calculo_url: it.calculo_url ?? '',
      }));
    const estandarIds = precargados.filter(it => it.tipo_item === 'estandar' && it.producto_id).map(it => it.producto_id!);
    const servicioIds = precargados.filter(it => it.tipo_item === 'servicio' && it.servicio_id).map(it => it.servicio_id!);

    setItems(noEstandar); // muestra ya los ítems mientras resuelve precios de catálogo

    if (servicioIds.length > 0) {
      api.get<ServicioCatalogo[]>('/catalogo/servicios?all=1').then(catalogoServ => {
        const porId = new Map(catalogoServ.map(s => [s.id, s]));
        setItems(prev => prev.map(it => {
          if (it.tipo_item !== 'servicio' || !it.servicio_id) return it;
          const s = porId.get(it.servicio_id);
          if (!s) return it;
          return {
            ...it,
            descripcion: it.descripcion || s.nombre,
            precio_unitario: s.precio_base ? Number(s.precio_base) : it.precio_unitario,
          };
        }));
      }).catch(() => toast.error('No se pudo cargar el precio de los servicios relevados'));
    }

    if (estandarIds.length > 0) {
      api.get<CatalogProduct[]>('/catalogo/productos').then(catalogo => {
        const porId = new Map(catalogo.map(p => [p.id, p]));
        const itemsEstandar = estandarIds.map(id => porId.get(id)).filter((p): p is CatalogProduct => !!p).map(itemFromCatalogProduct);
        setItems(prev => [...prev, ...itemsEstandar]);
      }).catch(() => toast.error('No se pudieron cargar los productos relevados en la visita'));
    }

    if (state.clienteId) {
      setClienteId(state.clienteId);
      api.get<Cliente>(`/clientes/${state.clienteId}`).then(cl => setClientes([cl])).catch(() => {});
    }
    if (state.visitaTecnicaId) setVisitaTecnicaId(state.visitaTecnicaId);
    if (state.imagenesVisita?.length) setImagenesVisita(state.imagenesVisita);
    if (state.visitaCobroEstado === 'cobrada' && state.visitaNumero) {
      setVisitaCredito({ numero: state.visitaNumero, monto: Number(state.visitaCostoCobrado ?? 0) });
    }
  }, [isEdit, location.state]);

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  function updateItem(key: string, field: keyof ItemForm, value: unknown) {
    setItems(prev => prev.map(it => it._key === key ? { ...it, [field]: value } : it));
  }

  const precioTotal   = items.reduce((s, it) => s + itemPrecioTotal(it), 0);
  const totalConEnvio = precioTotal + (formaEnvio === 'envio_empresa' ? costoEnvio : 0);
  const ahorroPromociones = items.reduce((s, it) =>
    s + (it.precio_lista != null && it.precio_lista > it.precio_unitario
      ? (it.precio_lista - it.precio_unitario) * it.cantidad
      : 0), 0);
  const pendientesARelevar = items.filter(it => it.tipo_item === 'a_relevar').length;
  // Ítems de catálogo SIN stock (el stock ya es prueba suficiente de disponibilidad)
  // cuyo plazo con el proveedor no está confirmado (o venció) — la fecha de entrega
  // no se puede comprometer en firme hasta chequear por WhatsApp.
  const itemsSinConfirmar = items.filter(it =>
    it.tipo_item === 'estandar' && it.producto_id && it._prod_stock <= 0
    && !disponibilidadVigente(it._prod_disponibilidad_confirmada_at)
  );

  function derivarTipo() {
    const tieneFab = items.some(i => i.origen === 'fabricacion');
    return tieneFab ? 'fabricacion_propia' : 'a_medida_proveedor';
  }

  // Agrega ítem desde catálogo — si ya existe incrementa cantidad
  const [variantePicker, setVariantePicker] = useState<{ nombre: string; opciones: CatalogProduct[] } | null>(null);

  // Si el producto pertenece a un modelo con más de una variante cargada, no se agrega
  // directo — se pide elegir medida/color primero (regla del negocio: nunca agregar sin
  // variante elegida cuando hay ambigüedad real).
  function agregarProducto(p: CatalogProduct) {
    if (p.modelo_id) {
      const hermanas = productos.filter(x => x.modelo_id === p.modelo_id);
      if (hermanas.length > 1) {
        setVariantePicker({ nombre: p.modelo_nombre ?? p.nombre, opciones: hermanas });
        return;
      }
    }
    agregarProductoDirecto(p);
  }

  function itemFromCatalogProduct(p: CatalogProduct): ItemForm {
    const enPromo = isPromoActiva(p) && p.promocion?.precio_oferta != null;
    return {
      _key:                uuid(),
      producto_id:         p.id,
      tipo_item:           'estandar',
      servicio_id:         '',
      tipo_abertura_id:    p.tipo_abertura_id   ?? '',
      sistema_id:          p.sistema_id         ?? '',
      descripcion:         p.codigo ? `${p.codigo} — ${p.nombre}` : p.nombre,
      medida_ancho:        '',
      medida_alto:         '',
      cantidad:            1,
      costo_unitario:      Number(p.costo_base)  || 0,
      precio_unitario:     enPromo ? Number(p.promocion!.precio_oferta) : (Number(p.precio_base) || 0),
      precio_lista:        enPromo ? (Number(p.precio_base) || 0) : null,
      incluye_instalacion: false,
      costo_instalacion:   0,
      precio_instalacion:  0,
      vidrio:              p.vidrio             ?? '',
      premarco:            p.premarco           ?? false,
      origen:              'proveedor',
      color:               p.color              ?? '',
      accesorios:          p.accesorios         ?? [],
      calculo_url:         '',
      _atribAbrev:         {},
      _prod_ancho:         p.ancho              ?? null,
      _prod_alto:          p.alto               ?? null,
      _prod_atributos:     p.atributos          ?? {},
      _prod_stock:         p.stock_actual        ?? 0,
      _prod_tipo_nombre:   p.tipo_abertura?.nombre ?? '',
      _prod_sistema_nombre: p.sistema?.nombre    ?? '',
      _prod_imagen_url:    p.imagenes?.[0] ?? p.imagen_url ?? null,
      _prod_disponibilidad_confirmada_at: p.disponibilidad_confirmada_at ?? null,
    };
  }

  function agregarProductoDirecto(p: CatalogProduct) {
    setItems(prev => {
      const existente = prev.find(it => it.producto_id === p.id);
      if (existente) {
        return prev.map(it =>
          it.producto_id === p.id ? { ...it, cantidad: it.cantidad + 1 } : it
        );
      }
      return [...prev, itemFromCatalogProduct(p)];
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

  async function handleSave(abrirPdf = false, luegoIrAVisita = false) {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return; }
    if (items.length === 0) { toast.error('Agregá al menos un ítem'); return; }
    if (formaPago === 'Varias formas de pago' && formasPagoAlternativas.length === 0) {
      toast.error('Elegí al menos una alternativa de pago para ofrecer');
      return;
    }

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
        visita_tecnica_id: !isEdit && visitaTecnicaId ? visitaTecnicaId : undefined,
        formas_pago_alternativas: formaPago === 'Varias formas de pago' ? formasPagoAlternativas : [],
        items: items.map((it, idx) => ({
          tipo_abertura_id:    it.tipo_abertura_id || null,
          sistema_id:          it.sistema_id || null,
          descripcion:         it.descripcion || '',
          medida_ancho:        it.medida_ancho ? parseFloat(it.medida_ancho) : null,
          medida_alto:         it.medida_alto  ? parseFloat(it.medida_alto)  : null,
          cantidad:            it.cantidad,
          costo_unitario:      it.costo_unitario,
          precio_unitario:     it.precio_unitario,
          precio_lista:        it.precio_lista ?? null,
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
          calculo_url:         it.calculo_url || null,
          tipo_item:           it.tipo_item || 'estandar',
          servicio_id:         it.servicio_id || null,
        })),
      };
      const op = isEdit
        ? await api.put<{ id: string; numero: string }>(`/operaciones/${editId}`, payload)
        : await api.post<{ id: string; numero: string }>('/operaciones', payload);

      const msgBase = isEdit ? `Presupuesto ${op.numero} actualizado` : `Presupuesto ${op.numero} creado`;
      if (oportunidadId) {
        try {
          await api.patch(`/oportunidades/${oportunidadId}/estado`, { estado: 'convertida', operacion_id_ganada: op.id });
          toast.success(`${msgBase} — oportunidad marcada como concretada`);
        } catch {
          toast.success(msgBase);
        }
      } else {
        toast.success(msgBase);
      }
      if (luegoIrAVisita) {
        navigate('/presupuestos/visita-tecnica', {
          state: { clienteId, operacionId: op.id, operacionNumero: op.numero },
        });
      } else if (abrirPdf) {
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

  function toggleFormaPagoAlt(fp: FormaPagoCatalogo) {
    setFormasPagoAlternativas(prev => {
      const existe = prev.find(a => a.forma_pago_id === fp.id);
      if (existe) return prev.filter(a => a.forma_pago_id !== fp.id);
      return [...prev, { forma_pago_id: fp.id, nombre: fp.nombre, descuento_pct: Number(fp.descuento_pct) }];
    });
  }
  function updateAlternativaPct(forma_pago_id: string, pct: number) {
    setFormasPagoAlternativas(prev => prev.map(a => a.forma_pago_id === forma_pago_id ? { ...a, descuento_pct: pct } : a));
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
        : `${clienteSeleccionado.apellido ?? ''} ${clienteSeleccionado.nombre ?? ''}`.trim())
    : '';
  const clienteIniciales = clienteNombre
    ? clienteNombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  // ── Validación para generar ──────────────────────────────────────────────────
  // Cliente ya está garantizado por el modal bloqueante. Además de tener al menos
  // un producto, no puede quedar ningún ítem "a relevar" sin resolver — el backend
  // ya rechaza compartir/aprobar en ese caso (visitaPendiente() en operaciones.ts),
  // pero acá se corta antes de llegar a abrir el diálogo de enviar/imprimir.
  const puedeGenerar = !!clienteId && items.length > 0 && pendientesARelevar === 0;

  function handleGenerarProforma() {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return; }
    if (items.length === 0) { toast.error('Agregá al menos un producto para generar la proforma'); return; }
    if (pendientesARelevar > 0) {
      toast.error('Hay ítems pendientes de relevar — generá la Visita de Relevamiento de Datos antes de enviar la proforma');
      return;
    }
    handleSave(true);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const editItemData = editItemKey ? items.find(it => it._key === editItemKey) : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        {/* Izquierda */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0"
          >
            <ArrowLeft size={17} className="text-gray-600" />
          </button>
          <h1 className="text-sm font-bold text-gray-900">
            {isEdit ? 'Editar presupuesto' : 'Nuevo presupuesto'}
          </h1>
        </div>

        {/* Derecha: acciones */}
        <div className="flex items-center gap-2">
          <HelpButton topic="presupuestos" />
          {!visitaPendiente && (items.length === 0 || pendientesARelevar > 0) && (
            <button
              onClick={() => {
                if (isEdit) {
                  navigate('/presupuestos/visita-tecnica', {
                    state: { clienteId, operacionId: editId, operacionNumero: numeroActual },
                  });
                } else if (items.length > 0) {
                  handleSave(false, true);
                } else {
                  navigate('/presupuestos/visita-tecnica', { state: clienteId ? { clienteId } : undefined });
                }
              }}
              disabled={saving}
              title={
                pendientesARelevar > 0
                  ? 'Guarda lo cargado y generá la Visita de Relevamiento de Datos para relevar los ítems pendientes'
                  : 'El cliente no sabe qué necesita — generá un relevamiento en el sitio'
              }
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Ruler size={14} />
              {pendientesARelevar > 0
                ? `Generar Visita de Relevamiento de Datos (${pendientesARelevar})`
                : 'Visita de Relevamiento de Datos'}
            </button>
          )}
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-gray-400 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
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
                puedeGenerar
                  ? 'bg-[#10b981] hover:bg-emerald-600'
                  : 'bg-amber-500 hover:bg-amber-600'
              )}
            >
              <FileText size={14} />
              {saving ? 'Guardando...' : 'Generar proforma'}
            </button>
            <button className="px-2 py-1.5 bg-[#10b981] hover:bg-emerald-600 text-white rounded-r-xl border-l border-emerald-500 transition-colors">
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: elegir cliente (bloqueante hasta elegir uno) ── */}
      {!clienteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget) navigate('/presupuestos'); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-violet-600 to-violet-500 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-white" />
                  <h2 className="text-base font-bold text-white">¿Para quién es el presupuesto?</h2>
                </div>
                <p className="text-xs text-violet-100 mt-1">Buscá el cliente para empezar a cargar productos</p>
              </div>
              <button onClick={() => navigate('/presupuestos')} title="Cancelar y volver"
                className="shrink-0 p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <X size={16} className="text-white" />
              </button>
            </div>
            <div className="p-6">
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
                  <Search size={15} className="text-gray-600 shrink-0" />
                  <input
                    ref={clienteInputRef}
                    type="text"
                    autoFocus
                    placeholder="Nombre, teléfono o DNI..."
                    value={clienteSearch}
                    onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
                    onFocus={() => setShowClienteList(true)}
                    className="flex-1 text-sm focus:outline-none"
                  />
                </div>
                {clienteSearch && (
                  <div className="mt-2 border border-gray-200 rounded-xl shadow-sm max-h-64 overflow-y-auto">
                    {clientes.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-gray-600 text-center">
                        No encontrado.{' '}
                        <button className="text-violet-600 hover:underline font-semibold"
                          onClick={() => navigate('/clientes/nuevo?nombre=' + clienteSearch)}>
                          Crear cliente
                        </button>
                      </div>
                    ) : clientes.slice(0, 8).map(c => (
                      <button key={c.id}
                        onClick={() => { setClienteId(c.id); setClientes([c]); setClienteSearch(''); setShowClienteList(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-violet-50 flex items-center justify-between border-b border-gray-200 last:border-0 transition-colors">
                        <span className="text-sm text-gray-800 font-medium">
                          {c.tipo_persona === 'juridica' ? c.razon_social : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim()}
                        </span>
                        <span className="text-xs text-gray-600">{c.telefono ?? ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!clienteSearch && (
                <button onClick={() => navigate('/clientes/nuevo')}
                  className="mt-3 text-xs text-violet-600 hover:underline font-semibold flex items-center gap-1">
                  <Plus size={12} /> Cliente nuevo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Franja: cliente elegido ── */}
      {clienteId && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">{clienteIniciales}</span>
          </div>
          <p className="text-xs font-bold text-gray-800 truncate flex-1 min-w-0">{clienteNombre}</p>
          {clienteSeleccionado?.telefono && (
            <span className="hidden sm:inline text-[11px] text-gray-600">{clienteSeleccionado.telefono}</span>
          )}
          <button onClick={() => { setClienteId(''); setClienteSearch(''); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-600 text-[11px] font-semibold shrink-0">
            <Edit2 size={11} /> Cambiar
          </button>
        </div>
      )}

      {imagenesVisita.length > 0 && (
        <div className="mx-3 xl:mx-4 mt-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3 overflow-x-auto">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide shrink-0 flex items-center gap-1.5">
            <Ruler size={13}/> Fotos de la Visita de Relevamiento de Datos
          </span>
          {imagenesVisita.map(url => (
            <a key={url} href={url} target="_blank" rel="noreferrer"
              className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 shrink-0">
              <img src={url} alt="" className="w-full h-full object-cover"/>
            </a>
          ))}
        </div>
      )}

      {/* ── CUERPO 3 COLUMNAS ── */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[340px_1fr_240px] xl:grid-cols-[420px_1fr_280px] gap-3 xl:gap-4 p-3 xl:p-4">

        {/* ─────────────────────── COLUMNA IZQUIERDA — AGREGAR PRODUCTOS ─────────────────────── */}
        <div className="flex flex-col bg-white rounded-xl border-2 border-violet-300 shadow-lg overflow-hidden relative">
          {/* Header */}
          <div className="px-4 py-3 border-b-2 border-violet-200 bg-violet-50 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-bold">1</span>
            </div>
            <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">
              {modo === 'a_medida' ? 'Cargar aberturas a medida'
                : modo === 'servicio' ? 'Agregar servicios'
                : modo === 'a_relevar' ? 'Ítem a relevar'
                : 'Agregar productos'}
            </span>
          </div>

          {/* Switch estándar / a medida / servicio / a relevar */}
          <div className="flex gap-1 p-1.5 border-b border-gray-200 bg-gray-50">
            {([
              { key: 'estandar',  icon: LayoutGrid, label: 'Estándar',   hint: 'Del catálogo' },
              { key: 'a_medida',  icon: Ruler,      label: 'A medida',   hint: 'Cálculo externo' },
              { key: 'servicio',  icon: Wrench,     label: 'Servicio',   hint: 'Reparación, mantenimiento' },
              { key: 'a_relevar', icon: MapPin,     label: 'A relevar',  hint: 'No se sabe la medida — necesita Visita de Relevamiento de Datos' },
            ] as const).map(({ key, icon: Icon, label, hint }) => (
              <button
                key={key}
                type="button"
                onClick={() => setModo(key)}
                title={hint}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors',
                  modo === key
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-white hover:text-gray-700'
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* ── MODO A MEDIDA — carga manual con precio del software externo ── */}
          {modo === 'a_medida' && (
            <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-3">
              <button
                type="button"
                onClick={() => {
                  const nuevo = { ...emptyItem(), tipo_item: 'a_medida' as const };
                  setItems(prev => [...prev, nuevo]);
                  setEditItemKey(nuevo._key);
                }}
                className="flex flex-col items-center justify-center gap-2 w-full py-6 rounded-xl border-2 border-dashed border-violet-300 text-violet-600 hover:bg-violet-50 hover:border-violet-400 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <Plus size={20} />
                </div>
                <span className="text-sm font-bold">Agregar abertura a medida</span>
              </button>

              <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-3">
                <p className="text-[11px] font-bold text-violet-700 mb-1.5">Cómo cargarla</p>
                <ol className="space-y-1 text-[11px] text-gray-600 leading-snug list-decimal list-inside">
                  <li>Describí la abertura (tipo, sistema, medidas, color, vidrio).</li>
                  <li>Cargá el <strong>precio costo</strong> y el <strong>precio de venta</strong> que dio el software.</li>
                  <li>Adjuntá la captura del cálculo como respaldo.</li>
                </ol>
              </div>

              {items.length > 0 && (
                <p className="text-[11px] text-gray-600 text-center">
                  {items.length} abertura{items.length !== 1 ? 's' : ''} cargada{items.length !== 1 ? 's' : ''} — editalas en la columna del medio
                </p>
              )}
            </div>
          )}

          {/* ── MODO SERVICIO — reparación, mantenimiento, cambio de piezas ── */}
          {modo === 'servicio' && (
            <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  const nuevo = { ...emptyItem(), tipo_item: 'servicio' as const };
                  setItems(prev => [...prev, nuevo]);
                  setEditItemKey(nuevo._key);
                }}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-colors mb-1"
              >
                <Plus size={16} />
                <span className="text-sm font-bold">Servicio personalizado</span>
              </button>

              {servicios.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mt-1">Servicios del catálogo</p>
                  <div className="flex gap-2">
                    <select
                      value={servicioSeleccionadoId}
                      onChange={e => setServicioSeleccionadoId(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      <option value="">Elegir servicio...</option>
                      {servicios.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}{s.precio_base != null ? ` — ${formatCurrency(Number(s.precio_base))}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!servicioSeleccionadoId}
                      onClick={() => {
                        const s = servicios.find(sv => sv.id === servicioSeleccionadoId);
                        if (!s) return;
                        const nuevo: ItemForm = {
                          ...emptyItem(),
                          tipo_item: 'servicio',
                          servicio_id: s.id,
                          descripcion: s.nombre,
                          precio_unitario: s.precio_base ? Number(s.precio_base) : 0,
                        };
                        setItems(prev => [...prev, nuevo]);
                        setServicioSeleccionadoId('');
                      }}
                      className="px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      Agregar
                    </button>
                  </div>
                  {(() => {
                    const s = servicios.find(sv => sv.id === servicioSeleccionadoId);
                    return s?.descripcion ? <p className="text-[11px] text-gray-600 -mt-1">{s.descripcion}</p> : null;
                  })()}
                </>
              )}

              {items.length > 0 && (
                <p className="text-[11px] text-gray-600 text-center mt-2">
                  {items.length} ítem{items.length !== 1 ? 's' : ''} cargado{items.length !== 1 ? 's' : ''} — editalos en la columna del medio
                </p>
              )}
            </div>
          )}

          {/* ── MODO A RELEVAR — placeholder sin precio, se completa con una visita técnica ── */}
          {modo === 'a_relevar' && (
            <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-3">
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-3">
                <p className="text-[11px] font-bold text-amber-700 mb-1">¿Cuándo usar esto?</p>
                <p className="text-[11px] text-gray-600 leading-snug">
                  Cuando el cliente pide algo que no sabés medir todavía. Se agrega
                  como un ítem más, sin precio, y queda marcado "pendiente de relevar".
                  Después generás una Visita de Relevamiento de Datos para completarlo — el presupuesto
                  no se puede aprobar ni compartir hasta resolverlo.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={descripcionARelevar}
                  onChange={e => setDescripcionARelevar(e.target.value)}
                  onKeyDown={e => {
                    if (e.key !== 'Enter' || !descripcionARelevar.trim()) return;
                    setItems(prev => [...prev, {
                      ...emptyItem(), tipo_item: 'a_relevar', descripcion: descripcionARelevar.trim(),
                    }]);
                    setDescripcionARelevar('');
                  }}
                  placeholder="¿Qué hay que relevar? (ej. Ventana cocina)"
                  className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <button
                  type="button"
                  disabled={!descripcionARelevar.trim()}
                  onClick={() => {
                    setItems(prev => [...prev, {
                      ...emptyItem(), tipo_item: 'a_relevar', descripcion: descripcionARelevar.trim(),
                    }]);
                    setDescripcionARelevar('');
                  }}
                  className="px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  Agregar
                </button>
              </div>

              {items.some(it => it.tipo_item === 'a_relevar') && (
                <p className="text-[11px] text-amber-700 text-center">
                  {items.filter(it => it.tipo_item === 'a_relevar').length} ítem(s) pendiente(s) de relevar
                </p>
              )}
            </div>
          )}

          {/* Tabs — solo en modo estándar */}
          {modo === 'estandar' && (
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
                    : 'border-transparent text-gray-600 hover:text-gray-600 hover:bg-gray-50'
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
          )}

          {/* Contenido del tab — solo en modo estándar */}
          <div className={cn('flex-1 flex-col overflow-hidden', modo === 'estandar' ? 'flex' : 'hidden')}>

            {/* TAB: Galería / Frecuentes */}
            {(tab === 'galeria' || tab === 'frecuentes') && (
              <>
                {/* Search bar */}
                <div className="px-3 py-2 border-b border-gray-200">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400">
                    <Search size={12} className="text-gray-600 shrink-0" />
                    <input
                      value={galSearch}
                      onChange={e => setGalSearch(e.target.value)}
                      placeholder="Buscar producto, medida o código..."
                      className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-600 focus:outline-none"
                    />
                    {galSearch && (
                      <button onMouseDown={() => setGalSearch('')} className="text-gray-600 hover:text-gray-600">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Category pills */}
                <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-gray-200 shrink-0">
                  <button
                    onClick={() => setCategoriaSel('')}
                    className={cn(
                      'shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors whitespace-nowrap',
                      !categoriaSel ? 'bg-violet-600 text-white' : 'border border-gray-200 text-gray-600 hover:border-violet-300'
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
                        categoriaSel === ta.id ? 'bg-violet-600 text-white' : 'border border-gray-200 text-gray-600 hover:border-violet-300'
                      )}
                    >
                      {ta.nombre}
                    </button>
                  ))}
                </div>

                {/* Grid de productos */}
                <div className="flex-1 overflow-y-auto p-3">
                  {productosLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-600 text-xs">Cargando...</div>
                  ) : productosOrdenados.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-gray-600 text-xs">Sin resultados</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {productosOrdenados.map(p => {
                        const img = p.imagenes?.[0] || p.imagen_url;
                        const enCarrito = items.some(it => it.producto_id === p.id);
                        const enPromo = isPromoActiva(p) && p.promocion?.precio_oferta != null;
                        const descPct = enPromo
                          ? Math.round((1 - Number(p.promocion!.precio_oferta) / Number(p.precio_base)) * 100)
                          : 0;
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
                            {/* Promo badge */}
                            {enPromo && (
                              <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-pink-600 text-white shadow-md leading-none">
                                <Tag size={8}/>-{descPct}%
                              </span>
                            )}
                            {/* En carrito badge */}
                            {enCarrito && (
                              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-violet-600 rounded-full flex items-center justify-center">
                                <CheckCircle2 size={10} className="text-white" />
                              </span>
                            )}
                            {/* Ver más */}
                            <button
                              type="button"
                              onClick={e => verDetalle(e, p)}
                              title="Ver detalle"
                              className={cn(
                                'absolute w-5 h-5 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
                                enPromo ? 'bottom-2 left-1.5' : 'top-1.5 left-1.5'
                              )}
                            >
                              <Eye size={11} className="text-gray-600" />
                            </button>
                            {/* Info */}
                            <div className="p-2">
                              {p.codigo && (
                                <span className="font-mono text-[8px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded mb-1 inline-block">{p.codigo}</span>
                              )}
                              <p className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2">{p.nombre}</p>
                              {(p.ancho || p.alto) && (
                                <p className="text-[9px] text-sky-600 font-bold mt-0.5 font-mono">
                                  {[p.ancho && `${p.ancho}cm`, p.alto && `${p.alto}cm`].filter(Boolean).join(' × ')}
                                </p>
                              )}
                              {enPromo ? (
                                <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                                  <p className="text-xs font-bold text-pink-600">{formatCurrency(Number(p.promocion!.precio_oferta))}</p>
                                  <p className="text-[9px] text-gray-600 line-through">{formatCurrency(Number(p.precio_base))}</p>
                                </div>
                              ) : (
                                <p className="text-xs font-bold text-[#7c3aed] mt-1">{formatCurrency(Number(p.precio_base))}</p>
                              )}
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
                <div className="px-3 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400">
                    <Search size={14} className="text-gray-600 shrink-0" />
                    <input
                      autoFocus
                      value={buscarSearch}
                      onChange={e => setBuscarSearch(e.target.value)}
                      placeholder="Buscar producto..."
                      className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-600 focus:outline-none"
                    />
                    {buscarSearch && (
                      <button onMouseDown={() => { setBuscarSearch(''); setBuscarResults([]); }} className="text-gray-600 hover:text-gray-600">
                        <X size={12} />
                      </button>
                    )}
                    {buscarLoading && <Search size={12} className="text-gray-600 animate-pulse shrink-0" />}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {buscarResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-600 text-xs gap-2">
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
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50 border-b border-gray-200 last:border-0 text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          {img
                            ? <img src={img} alt={p.nombre} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Package size={14} className="text-gray-600" /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{p.nombre}</p>
                          {p.codigo && <p className="font-mono text-[9px] text-gray-600">{p.codigo}</p>}
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
                          className="w-full text-left px-4 py-2.5 hover:bg-violet-50 border-b border-gray-200 last:border-0 flex items-center justify-between gap-3">
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
        <div className="flex flex-col bg-white rounded-xl border-2 border-indigo-300 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b-2 border-indigo-200 bg-indigo-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">2</span>
              </div>
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Productos agregados</span>
              {items.length > 0 && (
                <span className="text-[10px] text-gray-600">({items.length})</span>
              )}
            </div>
            <button
              onClick={() => setItems(prev => [...prev, emptyItem()])}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 border border-gray-200 hover:border-violet-300 hover:text-violet-600 text-gray-600 rounded-lg font-medium transition-colors"
            >
              <Plus size={11} /> Ítem manual
            </button>
          </div>

          {/* Tabla — scroll horizontal en mobile, columnas fijas no entran en pantallas chicas */}
          <div className="flex-1 overflow-x-auto flex flex-col">
          <div className="min-w-[420px] flex flex-col flex-1">
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
              <div className="flex flex-col items-center justify-center h-full text-center py-10 text-gray-600">
                <ScanLine size={32} className="text-gray-200 mb-3" />
                <p className="text-sm font-medium">Sin productos</p>
                <p className="text-xs text-gray-600 mt-1">Usá la galería de la izquierda para agregar</p>
              </div>
            ) : items.map((item, idx) => {
              const img = item._prod_imagen_url || item.calculo_url || null;
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
                    'grid items-center px-4 py-2.5 border-b border-gray-200 hover:bg-gray-50/50 transition-colors',
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  )}
                  style={{ gridTemplateColumns: '1fr 80px 100px 100px 100px 40px' }}
                >
                  {/* Producto info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {img
                        ? <img src={img} alt={item.descripcion} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-600" /></div>
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{item.descripcion || 'Sin descripción'}</p>
                        {item.tipo_item === 'servicio' && (
                          <span className="shrink-0 flex items-center gap-0.5 text-[8px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                            <Wrench size={8}/> Servicio
                          </span>
                        )}
                        {item.tipo_item === 'a_relevar' && (
                          <span className="shrink-0 flex items-center gap-0.5 text-[8px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                            <MapPin size={8}/> Pendiente de relevar
                          </span>
                        )}
                      </div>
                      {(item._prod_tipo_nombre || item._prod_sistema_nombre) && (
                        <p className="text-[9px] text-gray-600">
                          {[item._prod_tipo_nombre, item._prod_sistema_nombre].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {item.color && <p className="text-[9px] text-gray-600">{item.color}</p>}
                    </div>
                  </div>

                  {/* Medida */}
                  <div className="text-center">
                    <span className="text-xs text-gray-600">{medida}</span>
                  </div>

                  {/* Cantidad */}
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => updateItem(item._key, 'cantidad', Math.max(1, item.cantidad - 1))}
                      className="w-6 h-6 border border-gray-200 rounded hover:border-violet-400 hover:text-violet-600 flex items-center justify-center text-gray-600 transition-colors"
                    >
                      <span className="text-xs leading-none">−</span>
                    </button>
                    <span className="text-xs font-semibold w-6 text-center">{item.cantidad}</span>
                    <button
                      onClick={() => updateItem(item._key, 'cantidad', item.cantidad + 1)}
                      className="w-6 h-6 border border-gray-200 rounded hover:border-violet-400 hover:text-violet-600 flex items-center justify-center text-gray-600 transition-colors"
                    >
                      <Plus size={10} />
                    </button>
                  </div>

                  {/* Precio unit */}
                  <div className="text-right">
                    {item.tipo_item === 'a_relevar' ? (
                      <span className="text-[10px] font-semibold text-amber-600">Pendiente</span>
                    ) : item.precio_lista != null && item.precio_lista > item.precio_unitario ? (
                      <>
                        <p className="text-[9px] text-gray-600 line-through leading-none">{formatCurrency(item.precio_lista)}</p>
                        <span className="text-xs font-bold text-pink-600">{formatCurrency(item.precio_unitario)}</span>
                        <p className="text-[8px] text-pink-500 font-semibold flex items-center justify-end gap-0.5">
                          <Tag size={7}/> ahorrás {formatCurrency(item.precio_lista - item.precio_unitario)}
                        </p>
                        {item.incluye_instalacion && (
                          <p className="text-[8px] text-violet-500">+inst. {formatCurrency(item.precio_instalacion)}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-700">{formatCurrency(item.precio_unitario)}</span>
                        {item.incluye_instalacion && (
                          <p className="text-[8px] text-violet-500">+inst. {formatCurrency(item.precio_instalacion)}</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Subtotal */}
                  <div className="text-right">
                    {item.tipo_item === 'a_relevar' ? (
                      <span className="text-[10px] font-semibold text-amber-600">—</span>
                    ) : (
                      <span className="text-xs font-bold text-gray-800">{formatCurrency(subtotal)}</span>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-end gap-0.5">
                    {item.tipo_item !== 'a_relevar' && (
                      <button
                        onClick={() => setEditItemKey(item._key)}
                        className="p-1 hover:bg-violet-50 rounded text-gray-600 hover:text-violet-600 transition-colors"
                      >
                        <Edit2 size={11} />
                      </button>
                    )}
                    <button
                      onClick={() => setItems(prev => prev.filter(it => it._key !== item._key))}
                      className="p-1 hover:bg-red-50 rounded text-gray-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
          </div>

          {/* Notas toggle */}
          <div className="border-t border-gray-200">
            <button
              onClick={() => setShowNotas(v => !v)}
              className="w-full px-4 py-2 text-left text-xs text-gray-600 hover:text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                />
              </div>
            )}
          </div>

          {/* Footer con totales */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              Total productos: <span className="font-semibold text-gray-600">{items.length}</span>
              {' '}|{' '}
              Cantidad total: <span className="font-semibold text-gray-600">{items.reduce((s, it) => s + it.cantidad, 0)}</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider">Total</p>
              <p className="text-xl font-black text-[#031d49]">{formatCurrency(totalConEnvio)}</p>
            </div>
          </div>

        </div>

        {/* ─────────────────────── COLUMNA DERECHA — RESUMEN ─────────────────────── */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          <div className="bg-white rounded-xl border-2 border-emerald-300 shadow-lg sticky top-4 self-start w-full">
            {/* Header */}
            <div className="px-4 py-3 border-b-2 border-emerald-200 bg-emerald-50 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">3</span>
              </div>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Resumen de la proforma</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Hay ítems "a relevar" cargados pero todavía no se generó la visita técnica */}
              {!visitaPendiente && pendientesARelevar > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
                  <MapPin size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">
                      {pendientesARelevar} ítem{pendientesARelevar !== 1 ? 's' : ''} pendiente{pendientesARelevar !== 1 ? 's' : ''} de relevar
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Guardá y generá la Visita de Relevamiento de Datos para completarlo{pendientesARelevar !== 1 ? 's' : ''}.
                    </p>
                  </div>
                </div>
              )}

              {/* Visita técnica pendiente: hay ítems que faltan relevar antes de poder
                  aprobar o compartir este presupuesto */}
              {visitaPendiente && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
                  <Ruler size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-amber-700">
                      Esperando relevamiento — {visitaPendiente.numero}
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Hay ítems sin identificar. No se puede aprobar ni compartir este
                      presupuesto hasta completar la Visita de Relevamiento de Datos.
                    </p>
                    <button
                      onClick={() => navigate(`/presupuestos/visitas-tecnicas/${visitaPendiente.id}`)}
                      className="mt-1.5 text-[11px] font-bold text-amber-700 hover:underline"
                    >
                      Continuar relevamiento →
                    </button>
                  </div>
                </div>
              )}

              {/* Visita técnica ya cobrada: se podrá acreditar una vez aprobado el presupuesto */}
              {visitaCredito && (
                <div className="rounded-lg border border-violet-300 bg-violet-50 p-3 flex items-start gap-2">
                  <Ruler size={15} className="text-violet-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-violet-700">
                      Visita {visitaCredito.numero} cobrada {formatCurrency(visitaCredito.monto)}
                    </p>
                    <p className="text-[11px] text-violet-700 mt-0.5">
                      Vas a poder acreditarla al presupuesto una vez aprobado.
                    </p>
                  </div>
                </div>
              )}

              {/* Aviso: fecha de entrega estimativa por disponibilidad sin confirmar */}
              {itemsSinConfirmar.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">Fecha de entrega estimativa</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      {itemsSinConfirmar.length === 1
                        ? '1 producto no tiene la disponibilidad confirmada con el proveedor.'
                        : `${itemsSinConfirmar.length} productos no tienen la disponibilidad confirmada con el proveedor.`}
                      {' '}Chequeá stock/plazo por WhatsApp antes de comprometer una fecha en firme con el cliente.
                    </p>
                  </div>
                </div>
              )}

              {/* Breakdown de precios */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Subtotal</span>
                  <span className="text-xs font-semibold text-gray-700">{formatCurrency(precioTotal)}</span>
                </div>
                {formaEnvio === 'envio_empresa' && costoEnvio > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Envío</span>
                    <span className="text-xs font-semibold text-gray-700">{formatCurrency(costoEnvio)}</span>
                  </div>
                )}
                {ahorroPromociones > 0.01 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-pink-600 font-semibold flex items-center gap-1">
                      <Tag size={11}/> Ahorro por promoción
                    </span>
                    <span className="text-xs font-bold text-pink-600">-{formatCurrency(ahorroPromociones)}</span>
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

              {/* Validez — 7 días por defecto, ajustable acá sin volver atrás */}
              <div>
                <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Validez de la proforma</p>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {([7, 15, 30] as const).map(d => (
                    <button key={d} type="button"
                      onClick={() => {
                        setValidezDias(d);
                        const f = new Date(); f.setDate(f.getDate() + d);
                        setFechaValidez(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`);
                      }}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all',
                        validezDias === d
                          ? 'border-violet-500 bg-violet-100 text-violet-700'
                          : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600'
                      )}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={fechaValidez}
                  onChange={e => { setFechaValidez(e.target.value); setValidezDias('custom'); }}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
                <p className="text-[10px] text-gray-600 mt-1">Válido hasta el {fechaValidezLabel}</p>
              </div>

              {/* Forma de pago — colapsada; por defecto queda "Precio de lista" */}
              <details className="group border-t border-gray-200 pt-3">
                <summary className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-gray-600 list-none flex items-center gap-1">
                  <ChevronDown size={10} className="transition-transform group-open:rotate-0 -rotate-90" />
                  Forma de pago: <span className="text-gray-600 normal-case font-bold">{formaPago}</span>
                </summary>
                <div className="mt-2 space-y-2">
                  <select
                    value={formaPago}
                    onChange={e => setFormaPago(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  >
                    {FORMA_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>

                  {formaPago === 'Varias formas de pago' && (
                    <div>
                      <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider mb-2">Alternativas de pago a ofrecer</p>
                      {catalogoFormasPago.length === 0 ? (
                        <p className="text-[10px] text-amber-600">No hay formas de pago cargadas — agregalas en Configuración → Formas de pago.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {catalogoFormasPago.map(fp => {
                            const alt = formasPagoAlternativas.find(a => a.forma_pago_id === fp.id);
                            const marcada = !!alt;
                            return (
                              <div key={fp.id} className={cn(
                                'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border',
                                marcada ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-gray-50'
                              )}>
                                <input type="checkbox" checked={marcada} onChange={() => toggleFormaPagoAlt(fp)}
                                  className="rounded border-gray-400 text-violet-600 focus:ring-violet-400 shrink-0" />
                                <span className="text-xs text-gray-700 flex-1 truncate">{fp.nombre}</span>
                                {marcada && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <input type="number" min={0} max={100} step="0.5"
                                      value={alt.descuento_pct}
                                      onChange={e => updateAlternativaPct(fp.id, parseFloat(e.target.value) || 0)}
                                      className="w-14 px-1.5 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-2 focus:ring-violet-400"/>
                                    <span className="text-[10px] text-gray-600">%</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </details>

              {/* Entrega estimada */}
              {tiempoEntrega && (
                <div>
                  <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Entrega estimada</p>
                  <p className="text-xs font-bold text-gray-700">En {tiempoEntrega} días hábiles</p>
                  {entregaEstimadaLabel && <p className="text-[10px] text-gray-600">{entregaEstimadaLabel}</p>}
                </div>
              )}

              {/* Días de entrega input */}
              <div>
                <label className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider block mb-1">Tiempo de entrega (días)</label>
                <input
                  type="number" min={0} value={tiempoEntrega}
                  onChange={e => setTiempoEntrega(e.target.value)}
                  placeholder="Ej: 15"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
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
                    <span className="text-[10px] text-gray-600">{cond}</span>
                  </div>
                ))}
              </div>

              {/* Notas colapsadas */}
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <details className="group">
                  <summary className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-gray-600 list-none flex items-center gap-1">
                    <ChevronDown size={10} className="transition-transform group-open:rotate-0 -rotate-90" />
                    Notas para el cliente
                  </summary>
                  <textarea
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    rows={2}
                    placeholder="Condiciones, aclaraciones..."
                    className="mt-2 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                  />
                </details>
                <details className="group">
                  <summary className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-gray-600 list-none flex items-center gap-1">
                    <ChevronDown size={10} className="transition-transform group-open:rotate-0 -rotate-90" />
                    Notas internas
                  </summary>
                  <textarea
                    value={notasInternas}
                    onChange={e => setNotasInternas(e.target.value)}
                    rows={2}
                    placeholder="Solo para el equipo..."
                    className="mt-2 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
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
          clienteEmail={clienteSeleccionado?.email ?? undefined}
        />
      )}

      {/* ── Modal "Ver más" — detalle de producto ── */}
      {detalleProducto && (
        <ProductoModal
          producto={detalleProducto}
          onClose={() => { setDetalleProducto(null); setDetalleOriginal(null); }}
          onAgregar={() => detalleOriginal && agregarProducto(detalleOriginal)}
        />
      )}

      {/* ── Modal elegir variante (producto con modelo y 2+ variantes) ── */}
      {variantePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setVariantePicker(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
              <div>
                <p className="text-base font-bold text-gray-900">{variantePicker.nombre}</p>
                <p className="text-xs text-gray-600">{variantePicker.opciones.length} variantes — elegí una</p>
              </div>
              <button onClick={() => setVariantePicker(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"><X size={16}/></button>
            </div>
            <div className="divide-y divide-gray-100">
              {variantePicker.opciones.map(v => {
                const img = v.imagenes?.[0] || v.imagen_url;
                const medida = v.ancho && v.alto ? `${v.ancho} × ${v.alto} cm` : null;
                return (
                  <button key={v.id} type="button"
                    onClick={() => { setVariantePicker(null); agregarProductoDirecto(v); }}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-violet-50 text-left">
                    <div className="w-11 h-11 rounded-lg bg-gray-50 overflow-hidden shrink-0 border border-gray-200">
                      {img ? <img src={img} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-200"/></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{[medida, v.color].filter(Boolean).join(' · ') || v.nombre}</p>
                      {v.codigo && <p className="font-mono text-[10px] text-gray-600">{v.codigo}</p>}
                    </div>
                    <span className="text-sm font-bold text-violet-700 shrink-0">{formatCurrency(Number(v.precio_base))}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* suppress unused-var lint only */}
      {editEstado && false && <span>{editEstado}</span>}
      {tipoProyecto && false && <span>{tipoProyecto}</span>}

      {/* ── BOTÓN FLOTANTE — Generar proforma (siempre visible) ── */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        <button
          onClick={handleGenerarProforma}
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
