import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Zap, Users, Search, X, Plus, Minus, Trash2,
  ShoppingCart, Check, Loader2, Printer, RefreshCw, Package,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MontoInput } from '@/components/MontoInput';
import type { Cliente, Producto } from '@/types';

const FORMAS_PAGO = [
  'Contado',
  'Tarjeta de débito/crédito en 1 pago',
  'Transferencia',
  'Tarjeta de crédito 3 cuotas sin interés',
];

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
}

export function VentaRapida() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productoIdInicial = searchParams.get('producto_id');

  // Cliente
  const [clienteId, setClienteId]           = useState('');
  const [clienteNombre, setClienteNombre]   = useState('');
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

  // Pago
  const [formaPago, setFormaPago]           = useState('Contado');
  const [bonPct, setBonPct]                 = useState(0);
  const [bonCustom, setBonCustom]           = useState('');
  const [retira, setRetira]                 = useState(true);

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
  }, []);

  const conStock = catalogo.filter(p => p.activo && (p.stock_actual ?? 0) > 0);
  const q = prodSearch.trim().toLowerCase();
  const galeria = q
    ? conStock.filter(p => p.nombre.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q))
    : conStock;

  function nombreCliente(c: Cliente) {
    return c.tipo_persona === 'juridica'
      ? (c.razon_social ?? '')
      : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim();
  }

  function seleccionarCliente(c: Cliente) {
    setClienteId(c.id);
    setClienteNombre(nombreCliente(c));
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
        precio_unitario: Number(p.precio_base),
        stock_actual: p.stock_actual ?? 0,
      }];
    });
    toast.success(`${p.nombre} agregado`);
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
        retira,
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
    setClienteId(''); setClienteNombre(''); setClienteSearch('');
    setItems([]);
    setFormaPago('Contado');
    resetBonificacion();
    setRetira(true);
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
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-500"/>
        </button>
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Zap size={18} className="text-emerald-600"/>
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900">Venta rápida de mostrador</h1>
          <p className="text-xs text-gray-400">Cobra, entrega y descuenta stock en un solo paso</p>
        </div>
      </div>

      {/* Cliente */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Users size={13}/> Cliente
        </p>
        {clienteId ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{clienteNombre}</span>
            <button onClick={() => { setClienteId(''); setClienteNombre(''); }}
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
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl mb-3">
          <Search size={14} className="text-gray-300 shrink-0"/>
          <input
            value={prodSearch}
            onChange={e => setProdSearch(e.target.value)}
            placeholder="Filtrar por nombre o código..."
            className="flex-1 text-sm focus:outline-none"
          />
          {prodSearch && (
            <button onClick={() => setProdSearch('')} className="text-gray-300 hover:text-gray-500"><X size={13}/></button>
          )}
        </div>

        {loadingCatalogo ? (
          <div className="py-8 text-center text-sm text-gray-400">Cargando catálogo...</div>
        ) : galeria.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {q ? 'Sin resultados para tu búsqueda' : 'No hay productos con stock disponible'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-96 overflow-y-auto pr-1">
            {galeria.map(p => {
              const enCarrito = items.find(i => i.producto_id === p.id);
              return (
                <button key={p.id} onClick={() => agregarItem(p)}
                  className={cn(
                    'relative text-left rounded-xl border overflow-hidden transition-all hover:shadow-md hover:border-emerald-300',
                    enCarrito ? 'border-emerald-400 ring-1 ring-emerald-300' : 'border-gray-200'
                  )}>
                  <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                    {p.imagen_url
                      ? <img src={p.imagen_url} alt={p.nombre} loading="lazy" className="w-full h-full object-contain p-2"/>
                      : <Package size={26} className="text-gray-200"/>}
                  </div>
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/90 text-gray-600 shadow">
                    stock {p.stock_actual}
                  </span>
                  {enCarrito && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow">
                      {enCarrito.cantidad}
                    </span>
                  )}
                  <div className="p-2">
                    <p className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-2">{p.nombre}</p>
                    <p className="text-[11px] font-bold text-emerald-700 mt-0.5">{formatCurrency(Number(p.precio_base))}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-3 divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {items.map(i => (
              <div key={i.producto_id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{i.nombre}</p>
                  {i.cantidad > i.stock_actual && (
                    <p className="text-[10px] text-red-500 font-semibold">Sin stock suficiente (disp. {i.stock_actual})</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setCantidad(i.producto_id, i.cantidad - 1)}
                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Minus size={11}/></button>
                  <span className="w-7 text-center text-sm font-bold tabular-nums">{i.cantidad}</span>
                  <button onClick={() => setCantidad(i.producto_id, i.cantidad + 1)}
                    className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Plus size={11}/></button>
                </div>
                <div className="w-28 shrink-0">
                  <MontoInput value={String(i.precio_unitario)} onChange={v => setPrecio(i.producto_id, parseFloat(v) || 0)}/>
                </div>
                <span className="w-24 text-right text-sm font-bold text-gray-700 tabular-nums shrink-0">
                  {formatCurrency(i.cantidad * i.precio_unitario)}
                </span>
                <button onClick={() => quitarItem(i.producto_id)} className="p-1 text-gray-300 hover:text-red-500 shrink-0">
                  <Trash2 size={13}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pago */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Forma de pago</p>
          <select value={formaPago} onChange={e => setFormaPago(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-1">Bonificación</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[5, 7, 10, 15].map(pct => (
              <button key={pct} onClick={() => aplicarPreset(pct / 100)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                  bonPct === pct / 100 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300')}>
                {pct}%
              </button>
            ))}
            <input value={bonCustom} onChange={e => aplicarCustom(e.target.value)}
              placeholder="Otro %" type="number" min={0} max={50}
              className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
            {(bonPct > 0 || bonCustom) && (
              <button onClick={resetBonificacion} className="text-xs text-gray-400 hover:text-gray-600">Quitar</button>
            )}
          </div>

          <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none">
            <input type="checkbox" checked={retira} onChange={e => setRetira(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"/>
            <span className="text-sm text-gray-700 font-medium">Cliente retira ahora</span>
            <span className="text-xs text-gray-400">(cierra la venta y marca el remito entregado)</span>
          </label>

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
          </div>

          <button onClick={confirmarVenta} disabled={saving || !clienteId || items.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16}/>}
            {saving ? 'Procesando...' : 'Confirmar venta'}
          </button>
        </div>
      )}
    </div>
  );
}
