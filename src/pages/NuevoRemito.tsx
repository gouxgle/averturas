import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, Truck, Package,
  MapPin, Hash, RefreshCw, Search, X as XIcon
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ── Tipos ─────────────────────────────────────────────────────
interface Cliente {
  id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  telefono: string | null;
  direccion: string | null;
}

interface Producto {
  id: string;
  nombre: string;
  codigo: string | null;
  tipo: string;
  precio_base: number | null;
  stock_actual?: number;
}

interface RemitoItem {
  producto_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: string;
  estado_producto: 'nuevo' | 'bueno' | 'con_detalles';
  notas_item: string;
}

interface RemitoDetalle {
  id: string;
  numero: string;
  estado: string;
  cliente_id: string;
  operacion_id: string | null;
  medio_envio: string;
  transportista: string | null;
  nro_seguimiento: string | null;
  direccion_entrega: string | null;
  fecha_emision: string;
  fecha_entrega_est: string | null;
  notas: string | null;
  items: (RemitoItem & { id: string; producto: Producto | null })[];
  cliente: Cliente;
}

// ── Constantes ────────────────────────────────────────────────
const MEDIOS_ENVIO = [
  { value: 'retiro_local',    label: 'Retiro en local',    icon: '🏪' },
  { value: 'encomienda',      label: 'Encomienda',         icon: '📦' },
  { value: 'flete_propio',    label: 'Flete propio',       icon: '🚚' },
  { value: 'flete_tercero',   label: 'Flete tercerizado',  icon: '🚛' },
  { value: 'correo_argentino',label: 'Correo Argentino',   icon: '✉️' },
  { value: 'otro',            label: 'Otro',               icon: '📋' },
] as const;

const ESTADOS_PRODUCTO = [
  { value: 'nuevo',        label: 'Nuevo',        color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { value: 'bueno',        label: 'Bueno',        color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'con_detalles', label: 'C/ detalles',  color: 'text-amber-600 bg-amber-50 border-amber-200' },
] as const;

function emptyItem(): RemitoItem {
  return { producto_id: '', descripcion: '', cantidad: 1, precio_unitario: '', estado_producto: 'nuevo', notas_item: '' };
}

function clienteLabel(c: Cliente) {
  return c.tipo_persona === 'juridica'
    ? c.razon_social ?? ''
    : `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim();
}

// ── Componente ────────────────────────────────────────────────
export function NuevoRemito() {
  const navigate     = useNavigate();
  const { id }       = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit       = Boolean(id);

  const [saving, setSaving]     = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  // Campos
  const [clienteId, setClienteId]         = useState(searchParams.get('cliente_id') ?? '');
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteList, setShowClienteList] = useState(false);
  const [operacionId, setOperacionId]     = useState('');
  const [medioEnvio, setMedioEnvio]       = useState<string>('retiro_local');
  const [transportista, setTransportista] = useState('');
  const [nroSeguimiento, setNroSeguimiento] = useState('');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [fechaEmision, setFechaEmision]   = useState(new Date().toISOString().split('T')[0]);
  const [fechaEntregaEst, setFechaEntregaEst] = useState('');
  const [notas, setNotas]                 = useState('');
  const [items, setItems]                 = useState<RemitoItem[]>([emptyItem()]);
  // búsqueda de producto por posición de ítem
  const [prodSearch, setProdSearch]       = useState<string[]>(['']);
  const [prodOpen, setProdOpen]           = useState<boolean[]>([false]);

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);
  const clientesFiltrados   = clientes.filter(c =>
    clienteLabel(c).toLowerCase().includes(clienteSearch.toLowerCase()) ||
    (c.telefono ?? '').includes(clienteSearch)
  );

  useEffect(() => {
    Promise.all([
      api.get<Cliente[]>('/clientes'),
      api.get<{ id: string; nombre: string; codigo: string | null; tipo: string; precio_base: number | null }[]>('/catalogo/productos?tipo=todos'),
    ]).then(([cls, prods]) => {
      setClientes(cls);
      setProductos(prods as Producto[]);
    });
  }, []);

  // Cargar datos en modo edición
  useEffect(() => {
    if (!isEdit || !id) return;
    api.get<RemitoDetalle>(`/remitos/${id}`).then(r => {
      setClienteId(r.cliente_id);
      setClienteSearch('');
      setOperacionId(r.operacion_id ?? '');
      setMedioEnvio(r.medio_envio);
      setTransportista(r.transportista ?? '');
      setNroSeguimiento(r.nro_seguimiento ?? '');
      setDireccionEntrega(r.direccion_entrega ?? '');
      setFechaEmision(r.fecha_emision.split('T')[0]);
      setFechaEntregaEst(r.fecha_entrega_est?.split('T')[0] ?? '');
      setNotas(r.notas ?? '');
      const mappedItems = r.items.map(it => ({
        producto_id:     it.producto_id,
        descripcion:     it.descripcion,
        cantidad:        it.cantidad,
        precio_unitario: it.precio_unitario != null ? String(it.precio_unitario) : '',
        estado_producto: it.estado_producto,
        notas_item:      it.notas_item ?? '',
      }));
      setItems(mappedItems);
      setProdSearch(r.items.map(it => it.producto?.nombre ?? ''));
      setProdOpen(r.items.map(() => false));
    }).catch(() => { toast.error('Error al cargar remito'); navigate('/remitos'); });
  }, [id, isEdit, navigate]);

  function updateItem(i: number, field: keyof RemitoItem, value: unknown) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  function seleccionarProducto(i: number, productoId: string) {
    if (!productoId) {
      setItems(prev => prev.map((item, idx) => idx !== i ? item : { ...item, producto_id: '' }));
      return;
    }
    const p = productos.find(x => x.id === productoId);
    setItems(prev => prev.map((item, idx) => idx !== i ? item : {
      ...item,
      producto_id:     productoId,
      descripcion:     item.descripcion || p?.nombre || '',
      precio_unitario: item.precio_unitario || String(p?.precio_base ?? ''),
    }));
  }

  function addItem() {
    setItems(prev => [...prev, emptyItem()]);
    setProdSearch(prev => [...prev, '']);
    setProdOpen(prev => [...prev, false]);
  }
  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
    setProdSearch(prev => prev.filter((_, idx) => idx !== i));
    setProdOpen(prev => prev.filter((_, idx) => idx !== i));
  }
  function setProdSearchAt(i: number, v: string) {
    setProdSearch(prev => prev.map((s, idx) => idx === i ? v : s));
  }
  function setProdOpenAt(i: number, v: boolean) {
    setProdOpen(prev => prev.map((s, idx) => idx === i ? v : s));
  }

  const precioTotal = items.reduce((s, it) => {
    const p = parseFloat(it.precio_unitario) || 0;
    return s + p * it.cantidad;
  }, 0);

  async function handleSave() {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return; }
    if (!medioEnvio) { toast.error('Seleccioná medio de envío'); return; }
    const itemsValidos = items.filter(it => it.descripcion.trim());
    if (!itemsValidos.length) { toast.error('Agregá al menos un ítem'); return; }

    setSaving(true);
    try {
      const body = {
        cliente_id:       clienteId,
        operacion_id:     operacionId  || null,
        medio_envio:      medioEnvio,
        transportista:    transportista    || null,
        nro_seguimiento:  nroSeguimiento  || null,
        direccion_entrega:direccionEntrega || null,
        fecha_emision:    fechaEmision,
        fecha_entrega_est:fechaEntregaEst || null,
        notas:            notas            || null,
        items: itemsValidos.map(it => ({
          ...it,
          precio_unitario: it.precio_unitario ? parseFloat(it.precio_unitario) : null,
        })),
      };

      if (isEdit) {
        await api.put(`/remitos/${id}`, body);
        toast.success('Remito actualizado');
      } else {
        const nuevo = await api.post<{ id: string }>('/remitos', body);
        toast.success('Remito creado');
        navigate(`/remitos/${nuevo.id}`);
        return;
      }
      navigate('/remitos');
    } catch (e: unknown) {
      const msg = (e as Error).message;
      toast.error(msg || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const necesitaTransportista = ['encomienda','flete_propio','flete_tercero','correo_argentino'].includes(medioEnvio);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/remitos')}
          className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
            <Truck size={20} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Editar remito' : 'Nuevo remito'}
            </h1>
            <p className="text-sm text-gray-500">Solo borradores editables</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {isEdit ? 'Guardar cambios' : 'Crear remito'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Columna izquierda — datos principales */}
        <div className="lg:col-span-2 space-y-5">

          {/* Cliente */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-600">1</span>
              Cliente
            </h2>

            {clienteSeleccionado ? (
              <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-xl border border-teal-200">
                <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-sm">
                  {clienteLabel(clienteSeleccionado).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{clienteLabel(clienteSeleccionado)}</p>
                  {clienteSeleccionado.telefono && (
                    <p className="text-xs text-gray-500">{clienteSeleccionado.telefono}</p>
                  )}
                </div>
                <button onClick={() => { setClienteId(''); setClienteSearch(''); }}
                  className="text-xs text-teal-600 hover:underline">Cambiar</button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={clienteSearch}
                  onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
                  onFocus={() => setShowClienteList(true)}
                  onBlur={() => setTimeout(() => setShowClienteList(false), 150)}
                  placeholder="Buscar cliente..."
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {showClienteList && clientesFiltrados.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                    {clientesFiltrados.slice(0, 8).map(cl => (
                      <button key={cl.id} onMouseDown={() => { setClienteId(cl.id); setShowClienteList(false); setClienteSearch(''); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0">
                        <span className="font-medium">{clienteLabel(cl)}</span>
                        {cl.telefono && <span className="text-gray-400 ml-2 text-xs">{cl.telefono}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ítems */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-600">2</span>
              Ítems del remito
            </h2>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="grid grid-cols-12 gap-2 mb-2">
                    {/* Selector producto con búsqueda */}
                    <div className="col-span-5">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Producto</label>
                      {item.producto_id ? (
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-teal-50 border border-teal-200 rounded-lg">
                          <span className="text-xs text-teal-800 flex-1 truncate">
                            {productos.find(p => p.id === item.producto_id)?.nombre ?? '—'}
                          </span>
                          <button
                            type="button"
                            onClick={() => { seleccionarProducto(i, ''); setProdSearchAt(i, ''); }}
                            className="text-teal-400 hover:text-teal-600 flex-shrink-0">
                            <XIcon size={10} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            value={prodSearch[i] ?? ''}
                            onChange={e => { setProdSearchAt(i, e.target.value); setProdOpenAt(i, true); }}
                            onFocus={() => setProdOpenAt(i, true)}
                            onBlur={() => setTimeout(() => setProdOpenAt(i, false), 150)}
                            placeholder="Buscar producto..."
                            className="w-full pl-6 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                          {prodOpen[i] && (
                            <div className="absolute z-30 left-0 right-0 mt-0.5 bg-white rounded-xl border border-gray-200 shadow-lg max-h-44 overflow-y-auto">
                              {productos
                                .filter(p => {
                                  const q = (prodSearch[i] ?? '').toLowerCase();
                                  return !q || p.nombre.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q);
                                })
                                .slice(0, 10)
                                .map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onMouseDown={() => {
                                      seleccionarProducto(i, p.id);
                                      setProdSearchAt(i, p.nombre);
                                      setProdOpenAt(i, false);
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs border-b border-gray-50 last:border-0">
                                    <span className="font-medium text-gray-800">{p.nombre}</span>
                                    {p.codigo && <span className="text-gray-400 ml-1.5">{p.codigo}</span>}
                                    <span className="text-gray-300 ml-1.5 capitalize">{p.tipo.replace('_', ' ')}</span>
                                  </button>
                                ))}
                              {productos.filter(p => {
                                const q = (prodSearch[i] ?? '').toLowerCase();
                                return !q || p.nombre.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q);
                              }).length === 0 && (
                                <p className="px-3 py-2 text-xs text-gray-400">Sin resultados</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Descripción */}
                    <div className="col-span-7">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Descripción *</label>
                      <input
                        value={item.descripcion}
                        onChange={e => updateItem(i, 'descripcion', e.target.value)}
                        placeholder="Descripción del ítem"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-end">
                    {/* Cantidad */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Cant.</label>
                      <input type="number" min="1"
                        value={item.cantidad}
                        onChange={e => updateItem(i, 'cantidad', parseInt(e.target.value) || 1)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
                      />
                    </div>

                    {/* Precio */}
                    <div className="col-span-3">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Precio unit.</label>
                      <input type="number" min="0" step="0.01"
                        value={item.precio_unitario}
                        onChange={e => updateItem(i, 'precio_unitario', e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    {/* Estado producto */}
                    <div className="col-span-4">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Estado</label>
                      <div className="flex gap-1">
                        {ESTADOS_PRODUCTO.map(ep => (
                          <button key={ep.value}
                            onClick={() => updateItem(i, 'estado_producto', ep.value)}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                              item.estado_producto === ep.value ? ep.color : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}>
                            {ep.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notas item */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Notas</label>
                      <input
                        value={item.notas_item}
                        onChange={e => updateItem(i, 'notas_item', e.target.value)}
                        placeholder="—"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    {/* Eliminar */}
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => removeItem(i)} disabled={items.length === 1}
                        className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg disabled:opacity-30">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addItem}
              className="mt-3 flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium">
              <Plus size={14} /> Agregar ítem
            </button>

            {precioTotal > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Total estimado</p>
                  <p className="text-lg font-bold text-gray-900">
                    $ {precioTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha — logística */}
        <div className="space-y-4">

          {/* Medio de envío */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Truck size={14} className="text-teal-500" /> Envío
            </h2>
            <div className="space-y-1.5">
              {MEDIOS_ENVIO.map(m => (
                <button key={m.value} onClick={() => setMedioEnvio(m.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm border transition-all ${
                    medioEnvio === m.value
                      ? 'bg-teal-50 border-teal-300 text-teal-800 font-medium'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                  }`}>
                  <span className="text-base">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {necesitaTransportista && (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Transportista</label>
                  <input value={transportista} onChange={e => setTransportista(e.target.value)}
                    placeholder="Nombre empresa"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <Hash size={11} /> N° seguimiento
                  </label>
                  <input value={nroSeguimiento} onChange={e => setNroSeguimiento(e.target.value)}
                    placeholder="Tracking code"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
            )}
          </div>

          {/* Fechas y dirección */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Package size={14} className="text-teal-500" /> Detalles
            </h2>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de emisión</label>
              <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Entrega estimada</label>
              <input type="date" value={fechaEntregaEst} onChange={e => setFechaEntregaEst(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <MapPin size={11} /> Dirección de entrega
              </label>
              <textarea value={direccionEntrega} onChange={e => setDireccionEntrega(e.target.value)}
                rows={2} placeholder="Dirección completa"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)}
                rows={2} placeholder="Observaciones del remito"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
