import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, BookOpen, X, ChevronRight, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TipoOperacion, Cliente, TipoAbertura, Sistema, Proveedor, Producto } from '@/types';

const TIPOS: { value: TipoOperacion; label: string; desc: string }[] = [
  { value: 'estandar',           label: 'Estándar',    desc: 'Aberturas de medidas de stock' },
  { value: 'a_medida_proveedor', label: 'A medida',    desc: 'Medida especial, encargada a proveedor' },
  { value: 'fabricacion_propia', label: 'Fabricación', desc: 'Fabricado en taller propio' },
];

interface ItemForm {
  _key: string;
  producto_id: string;
  tipo_abertura_id: string;
  sistema_id: string;
  descripcion: string;
  medida_ancho: string;
  medida_alto: string;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  precio_por_m2: boolean;
  precio_base_m2: number;
  incluye_instalacion: boolean;
  costo_instalacion: number;
  precio_instalacion: number;
}

function emptyItem(): ItemForm {
  return {
    _key: crypto.randomUUID(),
    producto_id: '', tipo_abertura_id: '', sistema_id: '', descripcion: '',
    medida_ancho: '', medida_alto: '', cantidad: 1,
    costo_unitario: 0, precio_unitario: 0,
    precio_por_m2: false, precio_base_m2: 0,
    incluye_instalacion: false, costo_instalacion: 0, precio_instalacion: 0,
  };
}

function calcPrecioM2(item: ItemForm): number {
  if (!item.precio_por_m2 || !item.precio_base_m2) return item.precio_unitario;
  const ancho = parseFloat(item.medida_ancho) || 0;
  const alto  = parseFloat(item.medida_alto)  || 0;
  if (!ancho || !alto) return item.precio_unitario;
  return Math.round(item.precio_base_m2 * (ancho / 100) * (alto / 100));
}

export function NuevoPresupuesto() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);

  const [clientes, setClientes]         = useState<Cliente[]>([]);
  const [tiposAbertura, setTiposAbertura] = useState<TipoAbertura[]>([]);
  const [sistemas, setSistemas]         = useState<Sistema[]>([]);
  const [proveedores, setProveedores]   = useState<Proveedor[]>([]);
  const [catalogo, setCatalogo]         = useState<Producto[]>([]);

  const [tipo, setTipo]                 = useState<TipoOperacion>('estandar');
  const [clienteId, setClienteId]       = useState(searchParams.get('cliente_id') ?? '');
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteList, setShowClienteList] = useState(false);
  const [proveedorId, setProveedorId]   = useState('');
  const [notas, setNotas]               = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [fechaValidez, setFechaValidez] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [items, setItems]               = useState<ItemForm[]>([emptyItem()]);
  const [showCatalog, setShowCatalog]   = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Cliente[]>('/clientes'),
      api.get<TipoAbertura[]>('/catalogo/tipos-abertura'),
      api.get<Sistema[]>('/catalogo/sistemas'),
      api.get<Proveedor[]>('/catalogo/proveedores'),
      api.get<Producto[]>('/catalogo/productos'),
    ]).then(([c, ta, s, p, cat]) => {
      setClientes(c);
      setTiposAbertura(ta);
      setSistemas(s);
      setProveedores(p);
      setCatalogo(cat);
    });
  }, []);

  const catalogoFiltrado = catalogo.filter(p => {
    const matchTipo   = p.tipo === tipo;
    const matchSearch = !catalogSearch.trim() || p.nombre.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchTipo && matchSearch;
  });

  const clientesFiltrados = clientes.filter(c =>
    `${c.nombre} ${c.apellido ?? ''} ${c.telefono ?? ''}`.toLowerCase().includes(clienteSearch.toLowerCase())
  );
  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  function updateItem(key: string, field: keyof ItemForm, value: unknown) {
    setItems(prev => prev.map(item => {
      if (item._key !== key) return item;
      const updated = { ...item, [field]: value };
      if ((field === 'medida_ancho' || field === 'medida_alto') && updated.precio_por_m2) {
        updated.precio_unitario = calcPrecioM2(updated);
      }
      return updated;
    }));
  }

  function addFromCatalog(producto: Producto) {
    const newItem: ItemForm = {
      _key: crypto.randomUUID(),
      producto_id: producto.id,
      tipo_abertura_id: producto.tipo_abertura_id ?? '',
      sistema_id: producto.sistema_id ?? '',
      descripcion: producto.nombre,
      medida_ancho: producto.ancho ? String(producto.ancho) : '',
      medida_alto:  producto.alto  ? String(producto.alto)  : '',
      cantidad: 1,
      costo_unitario:  producto.costo_base,
      precio_unitario: producto.precio_base,
      precio_por_m2:   producto.precio_por_m2,
      precio_base_m2:  producto.precio_por_m2 ? producto.precio_base : 0,
      incluye_instalacion: false, costo_instalacion: 0, precio_instalacion: 0,
    };
    setItems(prev => {
      const soloVacios = prev.filter(i => i.descripcion.trim() === '');
      const conContenido = prev.filter(i => i.descripcion.trim() !== '');
      return soloVacios.length === prev.length ? [newItem] : [...conContenido, newItem];
    });
  }

  const costoTotal  = items.reduce((s, it) => s + (it.costo_unitario  + (it.incluye_instalacion ? it.costo_instalacion  : 0)) * it.cantidad, 0);
  const precioTotal = items.reduce((s, it) => s + (it.precio_unitario + (it.incluye_instalacion ? it.precio_instalacion : 0)) * it.cantidad, 0);
  const margen = precioTotal > 0 ? Math.round((precioTotal - costoTotal) / precioTotal * 100) : 0;

  async function handleSave() {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return; }
    if (items.every(it => !it.descripcion.trim())) { toast.error('Agregá al menos un ítem'); return; }

    setSaving(true);
    try {
      const op = await api.post<{ id: string; numero: string }>('/operaciones', {
        tipo,
        estado: 'presupuesto',
        cliente_id: clienteId,
        proveedor_id: proveedorId || null,
        incluye_instalacion: items.some(i => i.incluye_instalacion),
        notas: notas || null,
        notas_internas: notasInternas || null,
        fecha_validez: fechaValidez || null,
        items: items.filter(it => it.descripcion.trim()).map((it, idx) => ({
          tipo_abertura_id: it.tipo_abertura_id || null,
          sistema_id: it.sistema_id || null,
          descripcion: it.descripcion,
          medida_ancho: it.medida_ancho ? parseFloat(it.medida_ancho) : null,
          medida_alto:  it.medida_alto  ? parseFloat(it.medida_alto)  : null,
          cantidad: it.cantidad,
          costo_unitario: it.costo_unitario,
          precio_unitario: it.precio_unitario,
          incluye_instalacion: it.incluye_instalacion,
          costo_instalacion: it.costo_instalacion,
          precio_instalacion: it.precio_instalacion,
          orden: idx,
        })),
      });
      toast.success(`Presupuesto ${op.numero} creado`);
      navigate(`/operaciones/${op.id}`);
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar el presupuesto');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
          <FileText size={18} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Nuevo presupuesto</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cotización para cliente</p>
        </div>
      </div>

      {/* Tipo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Tipo de operación *</h2>
        <div className="grid grid-cols-3 gap-3">
          {TIPOS.map(t => (
            <button key={t.value} onClick={() => { setTipo(t.value); setShowCatalog(false); }}
              className={cn('text-left p-4 rounded-lg border-2 transition-all',
                tipo === t.value ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300')}>
              <p className={cn('text-sm font-semibold', tipo === t.value ? 'text-violet-700' : 'text-gray-700')}>{t.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Cliente */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Cliente *</h2>
        {clienteSeleccionado ? (
          <div className="flex items-center justify-between bg-violet-50 rounded-lg px-4 py-3 border border-violet-200">
            <div>
              <p className="text-sm font-semibold text-violet-800">{clienteSeleccionado.nombre} {clienteSeleccionado.apellido ?? ''}</p>
              <p className="text-xs text-violet-600">{clienteSeleccionado.telefono ?? '—'}</p>
            </div>
            <button onClick={() => { setClienteId(''); setClienteSearch(''); }} className="text-xs text-violet-600 hover:underline">Cambiar</button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cliente por nombre o teléfono..."
              value={clienteSearch}
              onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
              onFocus={() => setShowClienteList(true)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {showClienteList && clienteSearch && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {clientesFiltrados.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No encontrado.{' '}
                    <button className="text-violet-600 hover:underline" onClick={() => navigate('/clientes/nuevo?nombre=' + clienteSearch)}>
                      Crear cliente
                    </button>
                  </div>
                ) : clientesFiltrados.slice(0, 8).map(c => (
                  <button key={c.id} onClick={() => { setClienteId(c.id); setClienteSearch(''); setShowClienteList(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between">
                    <span className="text-sm text-gray-800">{c.nombre} {c.apellido ?? ''}</span>
                    <span className="text-xs text-gray-400">{c.telefono ?? ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Proveedor */}
      {tipo === 'a_medida_proveedor' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Proveedor</h2>
          <select value={proveedorId} onChange={e => setProveedorId(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
            <option value="">Seleccionar proveedor...</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Ítems */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Ítems del presupuesto</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowCatalog(v => !v); setCatalogSearch(''); }}
              className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all',
                showCatalog ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-violet-600 border-violet-300 hover:bg-violet-50')}>
              <BookOpen size={13} />
              {showCatalog ? 'Cerrar catálogo' : 'Desde catálogo'}
            </button>
            <button onClick={() => setItems(prev => [...prev, emptyItem()])}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
              <Plus size={13} /> Ítem manual
            </button>
          </div>
        </div>

        {showCatalog && (
          <div className="border-b border-gray-100 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <input type="text"
                placeholder={`Buscar en catálogo (${TIPOS.find(t => t.value === tipo)?.label ?? tipo})...`}
                value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" autoFocus />
              <button onClick={() => setShowCatalog(false)} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            {catalogoFiltrado.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">
                No hay productos de tipo "{TIPOS.find(t => t.value === tipo)?.label}" en el catálogo.{' '}
                <button onClick={() => navigate('/productos/nuevo')} className="text-violet-600 hover:underline">Agregar</button>
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {catalogoFiltrado.map(producto => (
                  <button key={producto.id} onClick={() => addFromCatalog(producto)}
                    className="flex items-center gap-3 text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition-all group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{producto.nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(producto.tipo_abertura as any)?.nombre ?? ''}
                        {(producto.sistema as any)?.nombre ? ` · ${(producto.sistema as any).nombre}` : ''}
                        {producto.ancho && producto.alto ? ` · ${producto.ancho}×${producto.alto}cm` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-700">
                        {formatCurrency(producto.precio_base)}
                        {producto.precio_por_m2 && <span className="text-xs font-normal text-gray-400">/m²</span>}
                      </p>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-violet-500 ml-auto mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="p-5 space-y-4">
          {items.map((item, i) => (
            <div key={item._key} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ítem {i + 1}</p>
                {items.length > 1 && (
                  <button onClick={() => setItems(prev => prev.filter(it => it._key !== item._key))} className="text-red-400 hover:text-red-600 p-0.5">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo de abertura</label>
                  <select value={item.tipo_abertura_id} onChange={e => updateItem(item._key, 'tipo_abertura_id', e.target.value)} className={inputCls + ' bg-white'}>
                    <option value="">Seleccionar...</option>
                    {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sistema / Línea</label>
                  <select value={item.sistema_id} onChange={e => updateItem(item._key, 'sistema_id', e.target.value)} className={inputCls + ' bg-white'}>
                    <option value="">Seleccionar...</option>
                    {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Descripción *</label>
                <input type="text" value={item.descripcion} onChange={e => updateItem(item._key, 'descripcion', e.target.value)}
                  placeholder="Ej: Ventana batiente 2 hojas, vidrio DVH..." className={inputCls} />
              </div>
              {(tipo !== 'estandar' || item.producto_id) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ancho (cm)</label>
                    <input type="number" value={item.medida_ancho} onChange={e => updateItem(item._key, 'medida_ancho', e.target.value)} placeholder="120" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Alto (cm)</label>
                    <input type="number" value={item.medida_alto} onChange={e => updateItem(item._key, 'medida_alto', e.target.value)} placeholder="100" className={inputCls} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                  <input type="number" min={1} value={item.cantidad} onChange={e => updateItem(item._key, 'cantidad', parseInt(e.target.value) || 1)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Costo unitario</label>
                  <input type="number" min={0} value={item.costo_unitario} onChange={e => updateItem(item._key, 'costo_unitario', parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio unitario{item.precio_por_m2 && ' (auto/m²)'}</label>
                  <input type="number" min={0} value={item.precio_unitario} onChange={e => updateItem(item._key, 'precio_unitario', parseFloat(e.target.value) || 0)}
                    className={cn(inputCls, item.precio_por_m2 && 'bg-blue-50 border-blue-200')} />
                </div>
              </div>
              {item.precio_por_m2 && item.medida_ancho && item.medida_alto && (
                <p className="text-xs text-blue-600">
                  {formatCurrency(item.precio_base_m2)}/m² × {(parseFloat(item.medida_ancho)/100).toFixed(2)}m × {(parseFloat(item.medida_alto)/100).toFixed(2)}m = {formatCurrency(item.precio_unitario)}
                </p>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={item.incluye_instalacion} onChange={e => updateItem(item._key, 'incluye_instalacion', e.target.checked)} className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                <span className="text-xs text-gray-600">Incluye instalación</span>
              </label>
              {item.incluye_instalacion && (
                <div className="grid grid-cols-2 gap-3 pl-5">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Costo instalación</label>
                    <input type="number" min={0} value={item.costo_instalacion} onChange={e => updateItem(item._key, 'costo_instalacion', parseFloat(e.target.value) || 0)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Precio instalación</label>
                    <input type="number" min={0} value={item.precio_instalacion} onChange={e => updateItem(item._key, 'precio_instalacion', parseFloat(e.target.value) || 0)} className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="border-t border-gray-100 pt-4 flex justify-end">
            <div className="space-y-1.5 text-right">
              <div className="flex gap-8">
                <span className="text-sm text-gray-500">Costo total:</span>
                <span className="text-sm font-medium text-gray-700 w-28 text-right">{formatCurrency(costoTotal)}</span>
              </div>
              <div className="flex gap-8">
                <span className="text-sm text-gray-500">Precio total:</span>
                <span className="text-sm font-bold text-gray-800 w-28 text-right">{formatCurrency(precioTotal)}</span>
              </div>
              <div className="flex gap-8">
                <span className="text-sm text-gray-500">Margen:</span>
                <span className={cn('text-sm font-semibold w-28 text-right', margen >= 30 ? 'text-green-600' : margen >= 15 ? 'text-amber-600' : 'text-red-600')}>
                  {margen}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas para el cliente</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
              placeholder="Condiciones, aclaraciones, formas de pago..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas internas</label>
            <textarea value={notasInternas} onChange={e => setNotasInternas(e.target.value)} rows={2}
              placeholder="Solo para el equipo..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Válido hasta</label>
          <input type="date" value={fechaValidez} onChange={e => setFechaValidez(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <p className="text-xs text-gray-400 mt-1.5">Por defecto 30 días desde hoy</p>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate(-1)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium shadow-sm">
          <Save size={15} />
          {saving ? 'Guardando...' : 'Guardar presupuesto'}
        </button>
      </div>
    </div>
  );
}
