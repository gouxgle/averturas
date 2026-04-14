import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TipoOperacion, Cliente, TipoAbertura, Sistema, Proveedor } from '@/types';

const TIPOS: { value: TipoOperacion; label: string; desc: string }[] = [
  { value: 'estandar',           label: 'Estándar',           desc: 'Abertura de stock disponible' },
  { value: 'a_medida_proveedor', label: 'A medida proveedor', desc: 'Medida especial, encargada a proveedor' },
  { value: 'fabricacion_propia', label: 'Fabricación propia', desc: 'Fabricado en taller propio' },
];

interface Item {
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
}

function emptyItem(): Item {
  return {
    tipo_abertura_id: '', sistema_id: '', descripcion: '',
    medida_ancho: '', medida_alto: '', cantidad: 1,
    costo_unitario: 0, precio_unitario: 0,
    incluye_instalacion: false, costo_instalacion: 0, precio_instalacion: 0,
  };
}

export function NuevaOperacion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  // Catálogos
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tiposAbertura, setTiposAbertura] = useState<TipoAbertura[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  // Form
  const [tipo, setTipo] = useState<TipoOperacion>('estandar');
  const [clienteId, setClienteId] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteList, setShowClienteList] = useState(false);
  const [proveedorId, setProveedorId] = useState('');
  const [incluyeInstalacion, setIncluyeInstalacion] = useState(false);
  const [notas, setNotas] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [fechaValidez, setFechaValidez] = useState('');
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id, nombre, apellido, telefono').eq('activo', true).order('nombre'),
      supabase.from('tipos_abertura').select('*').eq('activo', true).order('orden'),
      supabase.from('sistemas').select('*').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
    ]).then(([{ data: c }, { data: ta }, { data: s }, { data: p }]) => {
      setClientes((c ?? []) as Cliente[]);
      setTiposAbertura((ta ?? []) as TipoAbertura[]);
      setSistemas((s ?? []) as Sistema[]);
      setProveedores((p ?? []) as Proveedor[]);
    });
  }, []);

  const clientesFiltrados = clientes.filter(c =>
    `${c.nombre} ${c.apellido ?? ''} ${c.telefono ?? ''}`.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  function updateItem(i: number, field: keyof Item, value: unknown) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  function addItem() { setItems(prev => [...prev, emptyItem()]); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }

  const costoTotal = items.reduce((s, it) =>
    s + (it.costo_unitario + (it.incluye_instalacion ? it.costo_instalacion : 0)) * it.cantidad, 0);
  const precioTotal = items.reduce((s, it) =>
    s + (it.precio_unitario + (it.incluye_instalacion ? it.precio_instalacion : 0)) * it.cantidad, 0);
  const margen = precioTotal > 0 ? Math.round((precioTotal - costoTotal) / precioTotal * 100) : 0;

  async function handleSave() {
    if (!clienteId) { toast.error('Seleccioná un cliente'); return; }
    if (items.every(it => !it.descripcion.trim())) { toast.error('Agregá al menos un ítem'); return; }

    setSaving(true);
    try {
      const { data: op, error } = await supabase.from('operaciones').insert({
        tipo,
        cliente_id: clienteId,
        vendedor_id: user?.id,
        proveedor_id: proveedorId || null,
        incluye_instalacion: incluyeInstalacion,
        notas: notas || null,
        notas_internas: notasInternas || null,
        fecha_validez: fechaValidez || null,
        created_by: user?.id,
      }).select().single();

      if (error) throw error;

      const itemsToInsert = items
        .filter(it => it.descripcion.trim())
        .map((it, idx) => ({
          operacion_id: op.id,
          tipo_abertura_id: it.tipo_abertura_id || null,
          sistema_id: it.sistema_id || null,
          descripcion: it.descripcion,
          medida_ancho: it.medida_ancho ? parseFloat(it.medida_ancho) : null,
          medida_alto: it.medida_alto ? parseFloat(it.medida_alto) : null,
          cantidad: it.cantidad,
          costo_unitario: it.costo_unitario,
          precio_unitario: it.precio_unitario,
          incluye_instalacion: it.incluye_instalacion,
          costo_instalacion: it.costo_instalacion,
          precio_instalacion: it.precio_instalacion,
          orden: idx,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('operacion_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      toast.success(`Operación ${op.numero} creada`);
      navigate(`/operaciones/${op.id}`);
    } catch (e) {
      toast.error('Error al guardar la operación');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Nueva operación</h1>
          <p className="text-sm text-gray-500 mt-0.5">Presupuesto o venta</p>
        </div>
      </div>

      {/* Tipo de operación */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Tipo de operación *</h2>
        <div className="grid grid-cols-3 gap-3">
          {TIPOS.map(t => (
            <button
              key={t.value}
              onClick={() => setTipo(t.value)}
              className={cn(
                'text-left p-4 rounded-lg border-2 transition-all',
                tipo === t.value
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <p className={cn('text-sm font-semibold', tipo === t.value ? 'text-brand-700' : 'text-gray-700')}>
                {t.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Cliente */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Cliente *</h2>
        {clienteSeleccionado ? (
          <div className="flex items-center justify-between bg-brand-50 rounded-lg px-4 py-3 border border-brand-200">
            <div>
              <p className="text-sm font-semibold text-brand-800">
                {clienteSeleccionado.nombre} {clienteSeleccionado.apellido ?? ''}
              </p>
              <p className="text-xs text-brand-600">{clienteSeleccionado.telefono ?? '—'}</p>
            </div>
            <button
              onClick={() => { setClienteId(''); setClienteSearch(''); }}
              className="text-xs text-brand-600 hover:underline"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cliente por nombre o teléfono..."
              value={clienteSearch}
              onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
              onFocus={() => setShowClienteList(true)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {showClienteList && clienteSearch && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {clientesFiltrados.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No encontrado.{' '}
                    <button className="text-brand-600 hover:underline" onClick={() => navigate('/clientes/nuevo?nombre=' + clienteSearch)}>
                      Crear cliente
                    </button>
                  </div>
                ) : clientesFiltrados.slice(0, 8).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setClienteId(c.id); setClienteSearch(''); setShowClienteList(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-800">{c.nombre} {c.apellido ?? ''}</span>
                    <span className="text-xs text-gray-400">{c.telefono ?? ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Proveedor (solo si aplica) */}
      {(tipo === 'a_medida_proveedor') && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Proveedor</h2>
          <select
            value={proveedorId}
            onChange={e => setProveedorId(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">Seleccionar proveedor...</option>
            {proveedores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* Ítems */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Detalle de ítems</h2>
          <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium">
            <Plus size={14} /> Agregar ítem
          </button>
        </div>

        {items.map((item, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ítem {i + 1}</p>
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo de abertura</label>
                <select value={item.tipo_abertura_id} onChange={e => updateItem(i, 'tipo_abertura_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Seleccionar...</option>
                  {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sistema</label>
                <select value={item.sistema_id} onChange={e => updateItem(i, 'sistema_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Seleccionar...</option>
                  {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Descripción *</label>
              <input type="text" value={item.descripcion} onChange={e => updateItem(i, 'descripcion', e.target.value)}
                placeholder="Ej: Ventana batiente 2 hojas..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            {tipo !== 'estandar' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ancho (cm)</label>
                  <input type="number" value={item.medida_ancho} onChange={e => updateItem(i, 'medida_ancho', e.target.value)}
                    placeholder="120"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Alto (cm)</label>
                  <input type="number" value={item.medida_alto} onChange={e => updateItem(i, 'medida_alto', e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                <input type="number" min={1} value={item.cantidad} onChange={e => updateItem(i, 'cantidad', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Costo unitario</label>
                <input type="number" min={0} value={item.costo_unitario} onChange={e => updateItem(i, 'costo_unitario', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Precio unitario</label>
                <input type="number" min={0} value={item.precio_unitario} onChange={e => updateItem(i, 'precio_unitario', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={item.incluye_instalacion}
                onChange={e => updateItem(i, 'incluye_instalacion', e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-xs text-gray-600">Incluye instalación</span>
            </label>

            {item.incluye_instalacion && (
              <div className="grid grid-cols-2 gap-3 pl-5">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Costo instalación</label>
                  <input type="number" min={0} value={item.costo_instalacion}
                    onChange={e => updateItem(i, 'costo_instalacion', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio instalación</label>
                  <input type="number" min={0} value={item.precio_instalacion}
                    onChange={e => updateItem(i, 'precio_instalacion', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Totales */}
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

      {/* Notas y fecha */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas para el cliente</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
              placeholder="Condiciones, aclaraciones..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas internas</label>
            <textarea value={notasInternas} onChange={e => setNotasInternas(e.target.value)} rows={3}
              placeholder="Solo para el equipo..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Válido hasta</label>
          <input type="date" value={fechaValidez} onChange={e => setFechaValidez(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-3">
        <button onClick={() => navigate(-1)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Save size={15} />
          {saving ? 'Guardando...' : 'Guardar operación'}
        </button>
      </div>
    </div>
  );
}
