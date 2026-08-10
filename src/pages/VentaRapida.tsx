import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Zap, Users, Search, X, Plus, Minus, Trash2,
  ShoppingCart, Check, Loader2, Printer, RefreshCw,
  Tag, LayoutGrid, Store, Truck, ClipboardList,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MontoInput } from '@/components/MontoInput';
import { TarjetaProductoMosaico, isPromoActiva } from '@/components/TarjetaProductoMosaico';
import { SectionHero } from '@/components/SectionHero';
import type { Cliente, Producto, TipoAbertura } from '@/types';

type FormaEntrega = 'retiro_local' | 'envio_domicilio';
type MedioEnvio = 'encomienda' | 'flete_propio' | 'flete_tercero' | 'correo_argentino' | 'otro';

const FORMAS_PAGO = [
  'Contado',
  'Tarjeta de débito/crédito en 1 pago',
  'Transferencia',
  'Tarjeta de crédito 3 cuotas sin interés',
];

const MEDIO_ENVIO_LABEL: Record<MedioEnvio, string> = {
  encomienda: 'Encomienda',
  flete_propio: 'Flete propio',
  flete_tercero: 'Transporte tercerizado',
  correo_argentino: 'Correo Argentino',
  otro: 'Otro',
};

interface ItemVenta {
  producto_id: string;
  nombre: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  stock_actual: number;
}

interface VentaOk {
  operacion_id: string; numero_operacion: string;
  recibo_id: string; numero_recibo: string;
  remito_id: string; numero_remito: string;
  estado_remito: string;
  recibo_envio_id: string | null;
  numero_recibo_envio: string | null;
}

export function VentaRapida() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productoIdInicial = searchParams.get('producto_id');

  // Cliente
  const [clienteId, setClienteId]           = useState('');
  const [clienteNombre, setClienteNombre]   = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [clienteSearch, setClienteSearch]   = useState('');
  const [clientes, setClientes]             = useState<Cliente[]>([]);
  const [showClienteList, setShowClienteList] = useState(false);
  const [showQuickAdd, setShowQuickAdd]     = useState(false);
  const [qNombre, setQNombre]               = useState('');
  const [qApellido, setQApellido]           = useState('');
  const [qTelefono, setQTelefono]           = useState('');
  const [qTelDup, setQTelDup]               = useState<Cliente | null>(null);
  const [creandoCliente, setCreandoCliente] = useState(false);

  // Ítems
  const [items, setItems]                   = useState<ItemVenta[]>([]);
  const [prodSearch, setProdSearch]         = useState('');
  const [catalogo, setCatalogo]             = useState<Producto[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(true);
  const [tiposAbertura, setTiposAbertura]   = useState<TipoAbertura[]>([]);
  const [soloPromo, setSoloPromo]           = useState(false);
  const [tipoAberturaId, setTipoAberturaId] = useState('');

  // Pago
  const [formaPago, setFormaPago]           = useState('Contado');
  const [bonPct, setBonPct]                 = useState(0);
  const [bonCustom, setBonCustom]           = useState('');
  const [retira, setRetira]                 = useState(true);

  // Entrega
  const [formaEntrega, setFormaEntrega]         = useState<FormaEntrega>('retiro_local');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [medioEnvio, setMedioEnvio]             = useState<MedioEnvio | ''>('');
  const [costoEnvio, setCostoEnvio]             = useState('');

  const [saving, setSaving]                 = useState(false);
  const [resultado, setResultado]           = useState<VentaOk | null>(null);

  // Precarga producto si viene por query
  useEffect(() => {
    if (!productoIdInicial) return;
    api.get<Producto>(`/productos/${productoIdInicial}`)
      .then(p => agregarItem(p))
      .catch(() => toast.error('No se pudo cargar el producto'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoIdInicial]);

  // Búsqueda de cliente
  useEffect(() => {
    const q = clienteSearch.trim();
    if (!q) { setClientes([]); return; }
    const t = setTimeout(() => {
      api.get<Cliente[]>(`/clientes?search=${encodeURIComponent(q)}`)
        .then(setClientes).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [clienteSearch]);

  // Catálogo completo (una vez) — la galería muestra solo lo que tiene stock
  useEffect(() => {
    setLoadingCatalogo(true);
    api.get<Producto[]>('/productos')
      .then(setCatalogo)
      .catch(() => toast.error('No se pudo cargar el catálogo'))
      .finally(() => setLoadingCatalogo(false));
    api.get<TipoAbertura[]>('/catalogo/tipos-abertura').then(setTiposAbertura).catch(() => {});
  }, []);

  // Cuando se elige envío a domicilio, sugerir la dirección ya cargada del cliente
  useEffect(() => {
    if (formaEntrega !== 'envio_domicilio' || direccionEntrega) return;
    if (clienteDireccion) setDireccionEntrega(clienteDireccion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formaEntrega, clienteDireccion]);

  const conStock = catalogo.filter(p => p.activo && (p.stock_actual ?? 0) > 0);
  const q = prodSearch.trim().toLowerCase();
  const galeria = conStock
    .filter(p => !q || p.nombre.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q))
    .filter(p => !soloPromo || isPromoActiva(p))
    .filter(p => !tipoAberturaId || p.tipo_abertura_id === tipoAberturaId);

  function nombreCliente(c: Cliente) {
    return c.tipo_persona === 'juridica'
      ? (c.razon_social ?? '')
      : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim();
  }

  function seleccionarCliente(c: Cliente) {
    setClienteId(c.id);
    setClienteNombre(nombreCliente(c));
    setClienteDireccion(c.direccion ?? '');
    setClienteSearch('');
    setShowClienteList(false);
    setShowQuickAdd(false);
  }

  async function checkTelDup(tel: string) {
    setQTelDup(null);
    const digits = tel.replace(/\D/g, '');
    if (digits.length < 8) return;
    try {
      const r = await api.get<{ existe: boolean; cliente?: Cliente }>(`/clientes/validar-telefono?telefono=${digits}`);
      if (r.existe && r.cliente) setQTelDup(r.cliente);
    } catch { /* no bloqueante */ }
  }

  async function crearClienteRapido() {
    if (!qNombre.trim() && !qApellido.trim()) {
      toast.error('Ingresá al menos el nombre'); return;
    }
    setCreandoCliente(true);
    try {
      const cliente = await api.post<Cliente>('/clientes', {
        tipo_persona: 'fisica',
        nombre: qNombre.trim() || undefined,
        apellido: qApellido.trim() || undefined,
        telefono: qTelefono.trim() || undefined,
      });
      seleccionarCliente(cliente);
      setQNombre(''); setQApellido(''); setQTelefono(''); setQTelDup(null);
      toast.success('Cliente creado');
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al crear cliente');
    } finally {
      setCreandoCliente(false);
    }
  }

  function agregarItem(p: Producto) {
    const precioPromo = isPromoActiva(p) && p.promocion?.precio_oferta ? p.promocion.precio_oferta : null;
    setItems(prev => {
      const existe = prev.find(i => i.producto_id === p.id);
      if (existe) {
        return prev.map(i => i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, {
        producto_id: p.id,
        nombre: p.nombre,
        descripcion: p.nombre,
        cantidad: 1,
        precio_unitario: precioPromo ?? Number(p.precio_base),
        stock_actual: p.stock_actual ?? 0,
      }];
    });
    toast.success(`${p.nombre} agregado${precioPromo ? ' con precio promocional' : ''}`);
  }

  function quitarItem(producto_id: string) {
    setItems(prev => prev.filter(i => i.producto_id !== producto_id));
  }

  function setCantidad(producto_id: string, cantidad: number) {
    if (cantidad < 1) return;
    setItems(prev => prev.map(i => i.producto_id === producto_id ? { ...i, cantidad } : i));
  }

  function setPrecio(producto_id: string, precio: number) {
    setItems(prev => prev.map(i => i.producto_id === producto_id ? { ...i, precio_unitario: precio } : i));
  }

  // ── Totales ──────────────────────────────────────────────────
  const montoProductos = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const pctActual = bonPct > 0 ? bonPct : (bonCustom ? parseFloat(bonCustom) / 100 : 0);
  const montoDescuento = Math.round(montoProductos * pctActual * 100) / 100;
  const montoFinal = Math.max(0, montoProductos - montoDescuento);

  function aplicarPreset(pct: number) {
    setBonPct(pct);
    setBonCustom('');
  }
  function aplicarCustom(val: string) {
    setBonCustom(val);
    setBonPct(0);
  }
  function resetBonificacion() {
    setBonPct(0);
    setBonCustom('');
  }

  const stockInsuficiente = items.find(i => i.cantidad > i.stock_actual);

  async function confirmarVenta() {
    if (!clienteId) { toast.error('Elegí o cargá un cliente'); return; }
    if (items.length === 0) { toast.error('Agregá al menos un producto'); return; }
    if (stockInsuficiente) { toast.error(`Sin stock suficiente: ${stockInsuficiente.nombre}`); return; }
    if (formaEntrega === 'envio_domicilio') {
      if (!direccionEntrega.trim()) { toast.error('Ingresá la dirección de entrega'); return; }
      if (!medioEnvio) { toast.error('Elegí el medio de envío'); return; }
    }

    setSaving(true);
    try {
      const res = await api.post<VentaOk>('/operaciones/venta-rapida', {
        cliente_id: clienteId,
        items: items.map(i => ({
          producto_id: i.producto_id,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
        })),
        forma_pago: formaPago,
        descuento_pct: Math.round(pctActual * 100),
        retira: formaEntrega === 'envio_domicilio' ? false : retira,
        forma_entrega: formaEntrega,
        direccion_entrega: formaEntrega === 'envio_domicilio' ? direccionEntrega.trim() : undefined,
        medio_envio: formaEntrega === 'envio_domicilio' ? medioEnvio : undefined,
        costo_envio: formaEntrega === 'envio_domicilio' ? (parseFloat(costoEnvio) || 0) : undefined,
      });
      setResultado(res);
      toast.success('Venta registrada');
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al registrar la venta');
    } finally {
      setSaving(false);
    }
  }

  function nuevaVenta() {
    setResultado(null);
    setClienteId(''); setClienteNombre(''); setClienteDireccion(''); setClienteSearch('');
    setItems([]);
    setFormaPago('Contado');
    resetBonificacion();
    setRetira(true);
    setFormaEntrega('retiro_local');
    setDireccionEntrega('');
    setMedioEnvio('');
    setCostoEnvio('');
  }

  // ── Pantalla de éxito ────────────────────────────────────────
  if (resultado) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="px-6 py-8 flex flex-col items-center bg-emerald-600">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3">
              <Check size={32} className="text-white" strokeWidth={3}/>
            </div>
            <h2 className="text-white font-bold text-lg">Venta registrada</h2>
            <p className="text-emerald-100 text-sm mt-1">{resultado.numero_operacion}</p>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-gray-500">Recibo</span>
              <span className="font-mono font-semibold text-gray-800">{resultado.numero_recibo}</span>
            </div>
            {resultado.numero_recibo_envio && (
              <div className="flex items-center justify-between text-sm bg-amber-50 rounded-xl px-4 py-3">
                <span className="text-amber-700">Recibo de envío</span>
                <span className="font-mono font-semibold text-amber-800">{resultado.numero_recibo_envio}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-gray-500">Remito</span>
              <span className="font-mono font-semibold text-gray-800">
                {resultado.numero_remito}
                <span className={cn('ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                  resultado.estado_remito === 'entregado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                  {resultado.estado_remito === 'entregado' ? 'Entregado' : 'Emitido'}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => window.open(`/imprimir/recibo/${resultado.recibo_id}`, '_blank')}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-sm font-semibold">
                <Printer size={14}/> Imprimir recibo
              </button>
              <button onClick={() => window.open(`/imprimir/remito/${resultado.remito_id}`, '_blank')}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-sm font-semibold">
                <Printer size={14}/> Imprimir remito
              </button>
            </div>
            {resultado.recibo_envio_id && (
              <button onClick={() => window.open(`/imprimir/recibo/${resultado.recibo_envio_id}`, '_blank')}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-semibold">
                <Printer size={14}/> Imprimir recibo de envío
              </button>
            )}

            <button onClick={nuevaVenta}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold mt-2">
              <RefreshCw size={15}/> Nueva venta
            </button>
            <button onClick={() => navigate('/productos')}
              className="w-full py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
              Volver a Productos
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario ───────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-[1440px] mx-auto space-y-4" data-section="venta-rapida">
      <SectionHero
        section="venta-rapida"
        icon={Zap}
        title="Venta rápida de mostrador"
        sub="Cobra, entrega y descuenta stock en un solo paso"
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 items-start">
        {/* ── Columna principal ── */}
        <div className="space-y-4 min-w-0">

          {/* Cliente */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-3.5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users size={13}/> Cliente
            </p>
            {clienteId ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{clienteNombre}</span>
                <button onClick={() => { setClienteId(''); setClienteNombre(''); setClienteDireccion(''); }}
                  className="p-1 hover:bg-white rounded"><X size={13} className="text-gray-400"/></button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl">
                  <Search size={14} className="text-gray-300 shrink-0"/>
                  <input
                    value={clienteSearch}
                    onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
                    onFocus={() => setShowClienteList(true)}
                    onBlur={() => setTimeout(() => setShowClienteList(false), 150)}
                    placeholder="Buscar por nombre, teléfono o DNI..."
                    className="flex-1 text-sm focus:outline-none"
                  />
                </div>
                {showClienteList && clienteSearch && (
                  <div className="absolute z-20 top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {clientes.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">Sin resultados</div>
                    ) : clientes.slice(0, 8).map(c => (
                      <button key={c.id} onMouseDown={() => seleccionarCliente(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        <p className="text-sm font-medium text-gray-800">{nombreCliente(c)}</p>
                        {c.telefono && <p className="text-xs text-gray-400">{c.telefono}</p>}
                      </button>
                    ))}
                    <button onMouseDown={() => { setShowQuickAdd(true); setQNombre(clienteSearch); }}
                      className="w-full text-left px-4 py-2.5 text-emerald-600 hover:bg-emerald-50 text-sm font-semibold flex items-center gap-1.5">
                      <Plus size={13}/> Cliente nuevo
                    </button>
                  </div>
                )}
                {!showQuickAdd && !clienteSearch && (
                  <button onClick={() => setShowQuickAdd(true)}
                    className="mt-2 text-xs text-emerald-600 hover:underline font-semibold flex items-center gap-1">
                    <Plus size={12}/> Cliente nuevo
                  </button>
                )}
              </div>
            )}

            {/* Alta rápida inline */}
            {showQuickAdd && !clienteId && (
              <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={qNombre} onChange={e => setQNombre(e.target.value)} placeholder="Nombre"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
                  <input value={qApellido} onChange={e => setQApellido(e.target.value)} placeholder="Apellido"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
                </div>
                <input value={qTelefono}
                  onChange={e => setQTelefono(e.target.value)}
                  onBlur={() => checkTelDup(qTelefono)}
                  placeholder="Teléfono"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
                {qTelDup && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <span>Ya existe: <strong>{nombreCliente(qTelDup)}</strong></span>
                    <button onClick={() => seleccionarCliente(qTelDup)} className="font-bold hover:underline shrink-0">Usar este</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={crearClienteRapido} disabled={creandoCliente}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {creandoCliente ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}
                    Crear y continuar
                  </button>
                  <button onClick={() => setShowQuickAdd(false)}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-100">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {/* Productos */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ShoppingCart size={13}/> Productos con stock disponible
            </p>

            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl flex-1 min-w-0">
                <Search size={14} className="text-gray-300 shrink-0"/>
                <input
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  placeholder="Filtrar por nombre o código..."
                  className="flex-1 min-w-0 text-sm focus:outline-none"
                />
                {prodSearch && (
                  <button onClick={() => setProdSearch('')} className="text-gray-300 hover:text-gray-500 shrink-0"><X size={13}/></button>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select value={tipoAberturaId} onChange={e => setTipoAberturaId(e.target.value)}
                  className="px-2.5 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 max-w-[160px]">
                  <option value="">Todos los tipos</option>
                  {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
                <button onClick={() => setSoloPromo(v => !v)}
                  className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all',
                    soloPromo ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-amber-300')}>
                  <Tag size={12}/> En promoción
                </button>
              </div>
            </div>

            {loadingCatalogo ? (
              <div className="py-8 text-center text-sm text-gray-400">Cargando catálogo...</div>
            ) : galeria.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                <LayoutGrid size={20} className="text-gray-200"/>
                {q || soloPromo || tipoAberturaId ? 'Sin resultados para el filtro elegido' : 'No hay productos con stock disponible'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[36rem] overflow-y-auto pr-1">
                {galeria.map(p => (
                  <TarjetaProductoMosaico
                    key={p.id}
                    producto={p}
                    priceColor="text-emerald-700"
                    onSelect={agregarItem}
                    mostrarVenderAhora={false}
                    cantidadEnCarrito={items.find(i => i.producto_id === p.id)?.cantidad ?? 0}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar: resumen de la venta ── */}
        <div className="xl:sticky xl:top-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <ClipboardList size={13}/> Resumen de la venta
              {items.length > 0 && (
                <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-bold">
                  {items.length} ítem{items.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>

            {clienteId ? (
              <div className="flex items-center gap-2 text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <Users size={13} className="text-emerald-600 shrink-0"/>
                <span className="truncate font-semibold text-gray-800">{clienteNombre}</span>
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Elegí un cliente para poder confirmar la venta
              </p>
            )}

            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                Elegí productos de la galería para armar la venta
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
                {items.map(i => (
                  <div key={i.producto_id} className="p-2.5 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 min-w-0 text-xs font-semibold text-gray-800 truncate">{i.nombre}</p>
                      <button onClick={() => quitarItem(i.producto_id)} className="p-0.5 text-gray-300 hover:text-red-500 shrink-0">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                    {i.cantidad > i.stock_actual && (
                      <p className="text-[10px] text-red-500 font-semibold">Sin stock suficiente (disp. {i.stock_actual})</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => setCantidad(i.producto_id, i.cantidad - 1)}
                          className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Minus size={9}/></button>
                        <span className="w-5 text-center text-xs font-bold tabular-nums">{i.cantidad}</span>
                        <button onClick={() => setCantidad(i.producto_id, i.cantidad + 1)}
                          className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Plus size={9}/></button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <MontoInput
                          value={String(i.precio_unitario)}
                          onChange={v => setPrecio(i.producto_id, parseFloat(v) || 0)}
                          className="w-full px-2 py-1 border border-gray-200 rounded-md text-xs text-right focus:outline-none focus:ring-1 focus:ring-emerald-300"
                        />
                      </div>
                      <span className="w-[72px] text-right text-xs font-bold text-gray-700 tabular-nums shrink-0">
                        {formatCurrency(i.cantidad * i.precio_unitario)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Forma de pago</p>
                  <select value={formaPago} onChange={e => setFormaPago(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                    {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Bonificación</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[5, 7, 10, 15].map(pct => (
                      <button key={pct} onClick={() => aplicarPreset(pct / 100)}
                        className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
                          bonPct === pct / 100 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300')}>
                        {pct}%
                      </button>
                    ))}
                    <input value={bonCustom} onChange={e => aplicarCustom(e.target.value)}
                      placeholder="Otro %" type="number" min={0} max={50}
                      className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
                    {(bonPct > 0 || bonCustom) && (
                      <button onClick={resetBonificacion} className="text-xs text-gray-400 hover:text-gray-600">Quitar</button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Forma de entrega</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => { setFormaEntrega('retiro_local'); setMedioEnvio(''); setCostoEnvio(''); }}
                      className={cn('flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-xs font-bold border transition-all',
                        formaEntrega === 'retiro_local' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300')}>
                      <Store size={15}/> Retira en local
                    </button>
                    <button onClick={() => setFormaEntrega('envio_domicilio')}
                      className={cn('flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-xs font-bold border transition-all',
                        formaEntrega === 'envio_domicilio' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300')}>
                      <Truck size={15}/> Envío a domicilio
                    </button>
                  </div>

                  {formaEntrega === 'envio_domicilio' ? (
                    <div className="mt-2 space-y-2">
                      <input value={direccionEntrega} onChange={e => setDireccionEntrega(e.target.value)}
                        placeholder="Dirección de entrega"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
                      <select value={medioEnvio} onChange={e => setMedioEnvio(e.target.value as MedioEnvio | '')}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                        <option value="">Medio de envío...</option>
                        {(Object.keys(MEDIO_ENVIO_LABEL) as MedioEnvio[]).map(k => (
                          <option key={k} value={k}>{MEDIO_ENVIO_LABEL[k]}</option>
                        ))}
                      </select>
                      <div>
                        <label className="text-[11px] text-gray-500 font-medium mb-1 block">Costo de envío (opcional)</label>
                        <MontoInput
                          value={costoEnvio}
                          onChange={setCostoEnvio}
                          placeholder="0,00"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        />
                        {parseFloat(costoEnvio) > 0 && (
                          <p className="text-[10px] text-gray-400 mt-1">Se va a generar un recibo aparte por este importe.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none">
                      <input type="checkbox" checked={retira} onChange={e => setRetira(e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"/>
                      <span className="text-xs text-gray-700 font-medium">Cliente retira ahora</span>
                    </label>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-1">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span><span className="tabular-nums">{formatCurrency(montoProductos)}</span>
                  </div>
                  {montoDescuento > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600 font-semibold">
                      <span>Bonificación</span><span className="tabular-nums">- {formatCurrency(montoDescuento)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-black text-gray-900 pt-1">
                    <span>Total</span><span className="tabular-nums">{formatCurrency(montoFinal)}</span>
                  </div>
                  {formaEntrega === 'envio_domicilio' && parseFloat(costoEnvio) > 0 && (
                    <div className="flex justify-between text-xs text-amber-600 font-semibold pt-1 border-t border-dashed border-gray-100">
                      <span>+ Costo de envío (recibo aparte)</span>
                      <span className="tabular-nums">{formatCurrency(parseFloat(costoEnvio) || 0)}</span>
                    </div>
                  )}
                </div>

                <button onClick={confirmarVenta} disabled={saving || !clienteId || items.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
                  {saving ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16}/>}
                  {saving ? 'Procesando...' : 'Confirmar venta'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
