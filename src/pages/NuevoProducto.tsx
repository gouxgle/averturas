import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TipoOperacion, TipoAbertura, Sistema } from '@/types';

const TIPOS: { value: TipoOperacion; label: string; desc: string }[] = [
  { value: 'estandar',           label: 'Estándar',           desc: 'Medida de stock, dimensiones fijas' },
  { value: 'a_medida_proveedor', label: 'A medida',           desc: 'Se encarga al proveedor según medida' },
  { value: 'fabricacion_propia', label: 'Fabricación propia', desc: 'Fabricado en taller propio' },
];

export function NuevoProducto() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [saving, setSaving] = useState(false);
  const [tiposAbertura, setTiposAbertura] = useState<TipoAbertura[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'estandar' as TipoOperacion,
    tipo_abertura_id: '',
    sistema_id: '',
    ancho: '',
    alto: '',
    costo_base: '',
    precio_base: '',
    precio_por_m2: false,
    activo: true,
  });

  useEffect(() => {
    Promise.all([
      api.get<TipoAbertura[]>('/catalogo/tipos-abertura'),
      api.get<Sistema[]>('/catalogo/sistemas'),
    ]).then(([ta, s]) => {
      setTiposAbertura(ta);
      setSistemas(s);
    });

    if (isEdit && id) {
      api.get<any>(`/productos/${id}`).then(data => {
        setForm({
          nombre: data.nombre,
          descripcion: data.descripcion ?? '',
          tipo: data.tipo,
          tipo_abertura_id: data.tipo_abertura_id ?? '',
          sistema_id: data.sistema_id ?? '',
          ancho: data.ancho ? String(data.ancho) : '',
          alto: data.alto ? String(data.alto) : '',
          costo_base: String(data.costo_base),
          precio_base: String(data.precio_base),
          precio_por_m2: data.precio_por_m2 ?? false,
          activo: data.activo ?? true,
        });
      });
    }
  }, [id, isEdit]);

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const costo = parseFloat(form.costo_base) || 0;
  const precio = parseFloat(form.precio_base) || 0;
  const margen = precio > 0 ? Math.round((precio - costo) / precio * 100) : 0;

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    if (!form.costo_base || !form.precio_base) { toast.error('Los precios son requeridos'); return; }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        tipo: form.tipo,
        tipo_abertura_id: form.tipo_abertura_id || null,
        sistema_id: form.sistema_id || null,
        ancho: form.ancho ? parseFloat(form.ancho) : null,
        alto: form.alto ? parseFloat(form.alto) : null,
        costo_base: parseFloat(form.costo_base),
        precio_base: parseFloat(form.precio_base),
        precio_por_m2: form.precio_por_m2,
        activo: form.activo,
      };

      if (isEdit && id) {
        await api.put(`/productos/${id}`, payload);
        toast.success('Producto actualizado');
      } else {
        await api.post('/productos', payload);
        toast.success('Producto creado');
      }
      navigate('/productos');
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/productos')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Tipo de producto *</h2>
        <div className="grid grid-cols-3 gap-3">
          {TIPOS.map(t => (
            <button
              key={t.value}
              onClick={() => { set('tipo', t.value); set('precio_por_m2', false); set('ancho', ''); set('alto', ''); }}
              className={cn(
                'text-left p-3.5 rounded-lg border-2 transition-all',
                form.tipo === t.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <p className={cn('text-sm font-semibold', form.tipo === t.value ? 'text-brand-700' : 'text-gray-700')}>
                {t.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Datos del producto</h2>
        <div>
          <label className={labelClass}>Nombre *</label>
          <input
            value={form.nombre}
            onChange={e => set('nombre', e.target.value)}
            autoFocus
            placeholder={form.tipo === 'estandar' ? 'Ej: Ventana batiente 2H 120x100' : 'Ej: Ventana a medida batiente'}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Descripción</label>
          <textarea
            value={form.descripcion}
            onChange={e => set('descripcion', e.target.value)}
            rows={2}
            placeholder="Detalles adicionales..."
            className={inputClass + ' resize-none'}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipo de abertura</label>
            <select value={form.tipo_abertura_id} onChange={e => set('tipo_abertura_id', e.target.value)} className={inputClass + ' bg-white'}>
              <option value="">Seleccionar...</option>
              {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Sistema / Línea</label>
            <select value={form.sistema_id} onChange={e => set('sistema_id', e.target.value)} className={inputClass + ' bg-white'}>
              <option value="">Seleccionar...</option>
              {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        </div>
        {form.tipo === 'estandar' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ancho (cm)</label>
              <input type="number" value={form.ancho} onChange={e => set('ancho', e.target.value)} placeholder="120" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Alto (cm)</label>
              <input type="number" value={form.alto} onChange={e => set('alto', e.target.value)} placeholder="100" className={inputClass} />
            </div>
          </div>
        )}
        {form.tipo !== 'estandar' && (
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.precio_por_m2}
              onChange={e => set('precio_por_m2', e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-700">El precio base es por m²</span>
            <span className="text-xs text-gray-400">(se multiplicará por las medidas del presupuesto)</span>
          </label>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">
          Precios base{form.precio_por_m2 && ' (por m²)'}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Costo *</label>
            <input type="number" min={0} value={form.costo_base} onChange={e => set('costo_base', e.target.value)} placeholder="0" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Precio de venta *</label>
            <input type="number" min={0} value={form.precio_base} onChange={e => set('precio_base', e.target.value)} placeholder="0" className={inputClass} />
          </div>
        </div>
        {precio > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Margen:</span>
            <span className={cn('font-semibold', margen >= 30 ? 'text-green-600' : margen >= 15 ? 'text-amber-600' : 'text-red-600')}>
              {margen}%
            </span>
            <span className="text-gray-400 text-xs">({formatCurrency(precio - costo)} por unidad{form.precio_por_m2 ? '/m²' : ''})</span>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/productos')} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium shadow-sm">
          <Save size={15} />
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </div>
  );
}
