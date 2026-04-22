import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Upload, X, ImageIcon, Package, Tag, Ruler, DollarSign, FileText, Boxes } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TipoOperacion, TipoAbertura, Sistema, Proveedor } from '@/types';

const CATEGORIAS: { value: TipoOperacion; label: string; desc: string }[] = [
  { value: 'estandar',           label: 'Estándar',                 desc: 'Medida de stock, dimensiones fijas' },
  { value: 'a_medida_proveedor', label: 'A medida / Fabricación',   desc: 'Producto a pedido — proveedor o taller propio' },
];

const VIDRIO_OPTS = ['Transparente', 'Traslúcido', 'Laminado', 'DVH', 'Sin vidrio'];
const ACCESORIO_OPTS = ['Barral', 'Cerradura', 'Manijón', 'Otros'];

export function NuevoProducto() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [tiposAbertura, setTiposAbertura] = useState<TipoAbertura[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [colores, setColores] = useState<{ id: string; nombre: string; hex: string | null }[]>([]);

  const [form, setForm] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    tipo: 'estandar' as TipoOperacion,
    tipo_abertura_id: '',
    sistema_id: '',
    color: '',
    ancho: '',
    alto: '',
    stock_inicial: '0',
    stock_minimo: '0',
    proveedor_id: '',
    costo_base: '',
    precio_base: '',
    precio_por_m2: false,
    imagen_url: '',
    caracteristica_1: '',
    caracteristica_2: '',
    caracteristica_3: '',
    caracteristica_4: '',
    // a medida / fabricacion
    origen: 'proveedor' as 'proveedor' | 'fabricacion',
    vidrio: '',
    premarco: false,
    accesorios: [] as string[],
    activo: true,
  });

  useEffect(() => {
    Promise.all([
      api.get<TipoAbertura[]>('/catalogo/tipos-abertura'),
      api.get<Sistema[]>('/catalogo/sistemas'),
      api.get<Proveedor[]>('/catalogo/proveedores'),
      api.get<{ id: string; nombre: string; hex: string | null }[]>('/catalogo/colores'),
    ]).then(([ta, s, prov, col]) => {
      setTiposAbertura(ta);
      setSistemas(s);
      setProveedores(prov);
      setColores(col);
    });

    if (isEdit && id) {
      api.get<any>(`/productos/${id}`).then(data => {
        setForm({
          nombre:           data.nombre ?? '',
          codigo:           data.codigo ?? '',
          descripcion:      data.descripcion ?? '',
          tipo:             data.tipo,
          tipo_abertura_id: data.tipo_abertura_id ?? '',
          sistema_id:       data.sistema_id ?? '',
          color:            data.color ?? '',
          ancho:            data.ancho ? String(data.ancho) : '',
          alto:             data.alto ? String(data.alto) : '',
          stock_inicial:    String(data.stock_inicial ?? 0),
          stock_minimo:     String(data.stock_minimo ?? 0),
          proveedor_id:     data.proveedor_id ?? '',
          costo_base:       String(data.costo_base),
          precio_base:      String(data.precio_base),
          precio_por_m2:    data.precio_por_m2 ?? false,
          imagen_url:       data.imagen_url ?? '',
          caracteristica_1: data.caracteristica_1 ?? '',
          caracteristica_2: data.caracteristica_2 ?? '',
          caracteristica_3: data.caracteristica_3 ?? '',
          caracteristica_4: data.caracteristica_4 ?? '',
          origen:           data.tipo === 'fabricacion_propia' ? 'fabricacion' : 'proveedor',
          vidrio:           data.vidrio ?? '',
          premarco:         data.premarco ?? false,
          accesorios:       data.accesorios ?? [],
          activo:           data.activo ?? true,
        });
      });
    }
  }, [id, isEdit]);

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const token = localStorage.getItem('aberturas_token');
      const res = await fetch('/api/productos/upload-imagen', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error('Error al subir imagen');
      const { url } = await res.json();
      set('imagen_url', url);
      toast.success('Imagen cargada');
    } catch {
      toast.error('No se pudo subir la imagen');
    } finally {
      setUploadingImg(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const costo = parseFloat(form.costo_base) || 0;
  const precio = parseFloat(form.precio_base) || 0;
  const margen = precio > 0 ? Math.round((precio - costo) / precio * 100) : 0;

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    if (!form.costo_base || !form.precio_base) { toast.error('Los precios son requeridos'); return; }

    setSaving(true);
    try {
      const tipoFinal: TipoOperacion = form.tipo === 'estandar'
        ? 'estandar'
        : form.origen === 'fabricacion' ? 'fabricacion_propia' : 'a_medida_proveedor';

      const payload = {
        nombre:           form.nombre.trim(),
        codigo:           form.codigo.trim() || null,
        descripcion:      form.descripcion.trim() || null,
        tipo:             tipoFinal,
        tipo_abertura_id: form.tipo_abertura_id || null,
        sistema_id:       form.sistema_id || null,
        color:            form.color || null,
        ancho:            form.ancho ? parseFloat(form.ancho) : null,
        alto:             form.alto ? parseFloat(form.alto) : null,
        stock_inicial:    parseInt(form.stock_inicial) || 0,
        stock_minimo:     parseInt(form.stock_minimo) || 0,
        proveedor_id:     form.proveedor_id || null,
        costo_base:       parseFloat(form.costo_base),
        precio_base:      parseFloat(form.precio_base),
        precio_por_m2:    form.precio_por_m2,
        imagen_url:       form.imagen_url || null,
        caracteristica_1: form.caracteristica_1.trim() || null,
        caracteristica_2: form.caracteristica_2.trim() || null,
        caracteristica_3: form.caracteristica_3.trim() || null,
        caracteristica_4: form.caracteristica_4.trim() || null,
        vidrio:           form.tipo !== 'estandar' ? (form.vidrio || null) : null,
        premarco:         form.tipo !== 'estandar' ? form.premarco : false,
        accesorios:       form.tipo !== 'estandar' ? form.accesorios : [],
        activo:           form.activo,
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

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white';
  const labelCls = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5';

  const SectionHeader = ({ icon: Icon, label, primary = false }: { icon: React.ElementType; label: string; primary?: boolean }) => (
    <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b', primary ? 'bg-sky-50 border-sky-100' : 'bg-gray-50 border-gray-100')}>
      <Icon size={13} className={primary ? 'text-sky-500' : 'text-gray-400'} />
      <span className={cn('text-[11px] font-semibold uppercase tracking-wider', primary ? 'text-sky-600' : 'text-gray-500')}>{label}</span>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <button onClick={() => navigate('/productos')} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
            <ArrowLeft size={17} className="text-gray-500" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
            <Package size={16} className="text-sky-600" />
          </div>
          <h1 className="text-base font-bold text-gray-900">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h1>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button onClick={() => navigate('/productos')}
            className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium shadow-sm">
            <Save size={14} />
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </div>

      {/* Categoría */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader icon={Tag} label="Categoría de producto *" primary />
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIAS.map(t => (
            <button key={t.value} onClick={() => {
              set('tipo', t.value);
              set('precio_por_m2', false);
              set('ancho', '');
              set('alto', '');
            }}
              className={cn('text-left p-3.5 rounded-lg border-2 transition-all',
                form.tipo === t.value ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
              )}>
              <p className={cn('text-sm font-semibold', form.tipo === t.value ? 'text-sky-700' : 'text-gray-700')}>
                {t.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Datos principales */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader icon={Package} label="Datos del producto" primary />
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus
                placeholder="Ej: Ventana batiente 2H 120x100" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Código</label>
              <input value={form.codigo} onChange={e => set('codigo', e.target.value)}
                placeholder="Ej: VB-120-100" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Tipo de abertura</label>
              <select value={form.tipo_abertura_id} onChange={e => set('tipo_abertura_id', e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sistema</label>
              <select value={form.sistema_id} onChange={e => set('sistema_id', e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Color</label>
              <select value={form.color} onChange={e => set('color', e.target.value)} className={inputCls}>
                <option value="">—</option>
                {colores.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          {form.tipo === 'estandar' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ancho (cm)</label>
                <input type="number" value={form.ancho} onChange={e => set('ancho', e.target.value)} placeholder="120" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Alto (cm)</label>
                <input type="number" value={form.alto} onChange={e => set('alto', e.target.value)} placeholder="100" className={inputCls} />
              </div>
            </div>
          )}

          {form.tipo !== 'estandar' && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={form.precio_por_m2}
                onChange={e => set('precio_por_m2', e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
              <span className="text-sm text-gray-700">Precio base por m²</span>
              <span className="text-xs text-gray-400">(se multiplica por medidas del presupuesto)</span>
            </label>
          )}
        </div>
      </div>

      {/* A medida / Fabricación — campos extra */}
      {form.tipo !== 'estandar' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Ruler} label="Detalles a medida / fabricación" primary />
          <div className="p-4 space-y-4">

            {/* Origen — reemplaza el tipo */}
            <div>
              <label className={labelCls}>Origen *</label>
              <div className="flex gap-3">
                {(['proveedor', 'fabricacion'] as const).map(op => (
                  <label key={op} className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all flex-1 justify-center',
                    form.origen === op ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
                  )}>
                    <input type="radio" name="origen" value={op}
                      checked={form.origen === op}
                      onChange={() => set('origen', op)}
                      className="accent-sky-600" />
                    <span className={cn('text-sm font-semibold', form.origen === op ? 'text-sky-700' : 'text-gray-700')}>
                      {op === 'proveedor' ? 'Proveedor' : 'Fabricación propia'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Medidas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ancho (cm)</label>
                <input type="number" value={form.ancho} onChange={e => set('ancho', e.target.value)} placeholder="120" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Alto (cm)</label>
                <input type="number" value={form.alto} onChange={e => set('alto', e.target.value)} placeholder="100" className={inputCls} />
              </div>
            </div>

            {/* Vidrio */}
            <div>
              <label className={labelCls}>Vidrio</label>
              <select value={form.vidrio} onChange={e => set('vidrio', e.target.value)} className={inputCls}>
                <option value="">— Sin especificar —</option>
                {VIDRIO_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* Premarco + Accesorios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Premarco</label>
                <select value={form.premarco ? 'si' : 'no'} onChange={e => set('premarco', e.target.value === 'si')} className={inputCls}>
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Accesorios</label>
                <select multiple value={form.accesorios}
                  onChange={e => set('accesorios', Array.from(e.target.selectedOptions).map(o => o.value))}
                  className={inputCls + ' h-24'}>
                  {ACCESORIO_OPTS.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Ctrl+clic para seleccionar varios</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Stock + Proveedor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Boxes} label="Stock" />
          <div className="p-4 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Stock inicial</label>
              <input type="number" min={0} value={form.stock_inicial}
                onChange={e => set('stock_inicial', e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Stock mínimo</label>
              <input type="number" min={0} value={form.stock_minimo}
                onChange={e => set('stock_minimo', e.target.value)} placeholder="0" className={inputCls} />
              <p className="text-[10px] text-gray-400 mt-1">Alerta cuando stock baje de este valor</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Tag} label="Proveedor" />
          <div className="p-4">
            <label className={labelCls}>Proveedor</label>
            <select value={form.proveedor_id} onChange={e => set('proveedor_id', e.target.value)} className={inputCls}>
              <option value="">— Sin proveedor —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Precios */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader icon={DollarSign} label={`Precios base${form.precio_por_m2 ? ' (por m²)' : ''}`} />
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Costo *</label>
              <input type="number" min={0} value={form.costo_base}
                onChange={e => set('costo_base', e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Precio de venta *</label>
              <input type="number" min={0} value={form.precio_base}
                onChange={e => set('precio_base', e.target.value)} placeholder="0" className={inputCls} />
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
      </div>

      {/* Imagen */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader icon={ImageIcon} label="Imagen del producto" />
        <div className="p-4 flex items-start gap-4">
          {/* Preview */}
          <div className="w-28 h-28 shrink-0 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
            {form.imagen_url ? (
              <img src={form.imagen_url} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={28} className="text-gray-300" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingImg}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors">
              <Upload size={14} />
              {uploadingImg ? 'Subiendo...' : 'Elegir imagen'}
            </button>
            {form.imagen_url && (
              <button type="button" onClick={() => set('imagen_url', '')}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600">
                <X size={11} /> Quitar imagen
              </button>
            )}
            <p className="text-[11px] text-gray-400">JPG, PNG o WebP. Se muestra en detalle y tienda online.</p>
          </div>
        </div>
      </div>

      {/* 4 Descripciones */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader icon={FileText} label="Características del producto" />
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-gray-400">Se muestran en el detalle del producto y en la tienda online.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Característica 1</label>
              <input value={form.caracteristica_1} onChange={e => set('caracteristica_1', e.target.value)}
                placeholder="Ej: Doble vidriado hermético" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Característica 2</label>
              <input value={form.caracteristica_2} onChange={e => set('caracteristica_2', e.target.value)}
                placeholder="Ej: Perfil de aluminio serie 25" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Característica 3</label>
              <input value={form.caracteristica_3} onChange={e => set('caracteristica_3', e.target.value)}
                placeholder="Ej: Burlete de goma incluido" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Característica 4</label>
              <input value={form.caracteristica_4} onChange={e => set('caracteristica_4', e.target.value)}
                placeholder="Ej: Apertura tipo batiente" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Descripción / Notas internas</label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              rows={2} placeholder="Notas internas, referencias de proveedor..."
              className={inputCls + ' resize-none'} />
          </div>
        </div>
      </div>

    </div>
  );
}
