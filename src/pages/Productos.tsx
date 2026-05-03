import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, ToggleLeft, ToggleRight, Search, Layers, Package,
  X, AppWindow, DoorOpen, Tag, Percent, CalendarDays, RefreshCw, Play
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { Producto, TipoOperacion } from '@/types';

const TIPO_LABEL: Record<TipoOperacion, string> = {
  estandar:           'Estándar',
  a_medida_proveedor: 'A medida',
  fabricacion_propia: 'Fabricación',
};

const TIPO_COLOR: Record<TipoOperacion, string> = {
  estandar:           'bg-sky-50 text-sky-700 border-sky-200',
  a_medida_proveedor: 'bg-violet-50 text-violet-700 border-violet-200',
  fabricacion_propia: 'bg-orange-50 text-orange-700 border-orange-200',
};

const MARGEN_LABEL: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
const MARGEN_COLOR: Record<string, string> = {
  bajo:  'bg-sky-50 text-sky-700 border-sky-200',
  medio: 'bg-amber-50 text-amber-700 border-amber-200',
  alto:  'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// Label maps para atributos
const L_TIPO_VENTANA: Record<string, string> = {
  corrediza: 'Corrediza', con_celosia: 'Con celosía', de_abrir: 'De abrir',
  banderola: 'Banderola', ventiluz: 'Ventiluz', aireador: 'Aireador',
};
const L_HOJAS_VNT: Record<string, string> = {
  '2_hojas': '2 hojas', '3_hojas': '3 hojas', '4_hojas': '4 hojas',
};
const L_CONFIG_HOJAS: Record<string, string> = {
  hoja_simple: 'Hoja simple', hoja_y_media: 'Hoja y media',
  dos_hojas: '2 hojas iguales', puerta_pano_fijo: 'Puerta + paño fijo',
};
const L_MARCO: Record<string, string> = {
  transitable: 'Transitable', no_transitable: 'No transitable',
};
const L_USO: Record<string, string> = {
  interior: 'Interior', exterior: 'Exterior', ingreso_frente: 'Ingreso/Frente',
};

function buildSubtitle(p: Producto): string {
  const a = p.atributos ?? {};
  const parts: string[] = [];
  if (a.tipo_ventana)  parts.push(L_TIPO_VENTANA[a.tipo_ventana as string] ?? String(a.tipo_ventana));
  if (a.config_hojas)  parts.push(L_CONFIG_HOJAS[a.config_hojas as string] ?? String(a.config_hojas));
  if (a.hojas)         parts.push(L_HOJAS_VNT[a.hojas as string] ?? String(a.hojas));
  if (a.marco_tipo)    parts.push(L_MARCO[a.marco_tipo as string] ?? String(a.marco_tipo));
  if (a.uso)           parts.push(L_USO[a.uso as string] ?? String(a.uso));
  if (p.ancho && p.alto) parts.push(`${p.ancho} × ${p.alto} cm`);
  return parts.join(', ');
}

function lastDayOfMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

function isPromoActiva(p: Producto): boolean {
  if (!p.promocion?.activo) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  if (p.promocion.fecha_inicio && hoy < p.promocion.fecha_inicio) return false;
  if (p.promocion.auto_renovar) return true;
  if (p.promocion.fecha_fin && hoy > p.promocion.fecha_fin) return false;
  return true;
}

// ── Modal de detalle ──────────────────────────────────────────────────────────

function ProductoModal({ producto, onClose, onToggle }: {
  producto: Producto;
  onClose: () => void;
  onToggle: () => void;
}) {
  const [activeImg, setActiveImg] = useState(0);
  const costo  = producto.costo_base;
  const precio = producto.precio_base;
  const margen = precio > 0 ? Math.round((precio - costo) / precio * 100) : 0;
  const promoOk = isPromoActiva(producto);
  const subtitle = buildSubtitle(producto);
  const imagenes = producto.imagenes?.length ? producto.imagenes
                   : producto.imagen_url ? [producto.imagen_url] : [];

  const attrs: [string, string][] = Object.entries(producto.atributos ?? {})
    .filter(([, v]) => v !== null && v !== '' && !Array.isArray(v))
    .map(([k, v]) => [k.replace(/_/g, ' '), String(v)]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-5 py-4 flex items-start justify-between z-10">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', TIPO_COLOR[producto.tipo])}>
                {TIPO_LABEL[producto.tipo]}
              </span>
              {producto.codigo && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">{producto.codigo}</span>
              )}
              {!producto.activo && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">Inactivo</span>
              )}
            </div>
            <h2 className="text-base font-bold text-gray-900">{producto.nombre}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Galería de imágenes */}
          {imagenes.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 aspect-video flex items-center justify-center">
                <img src={imagenes[activeImg]} alt={producto.nombre} className="max-w-full max-h-full object-contain" />
              </div>
              {imagenes.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {imagenes.map((url, i) => (
                    <button key={i} type="button" onClick={() => setActiveImg(i)}
                      className={cn('w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all',
                        i === activeImg ? 'border-sky-500' : 'border-transparent hover:border-gray-300')}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Video */}
          {producto.video_url && (
            <a href={producto.video_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors">
              <Play size={13} className="fill-red-500 text-red-500" />
              Ver video del producto
            </a>
          )}

          {/* Precios */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Precio de venta</span>
              <span className="text-base font-bold text-gray-900">{formatCurrency(precio)}{producto.precio_por_m2 && <span className="text-xs font-normal text-gray-400">/m²</span>}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Costo</span>
              <span className="text-sm text-gray-600">{formatCurrency(costo)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Margen</span>
              <span className={cn('text-sm font-semibold', margen >= 30 ? 'text-emerald-600' : margen >= 15 ? 'text-amber-600' : 'text-red-600')}>
                {margen}%
              </span>
            </div>
            {producto.margen_tipo && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Segmento</span>
                <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', MARGEN_COLOR[producto.margen_tipo])}>
                  {MARGEN_LABEL[producto.margen_tipo]}
                </span>
              </div>
            )}
          </div>

          {/* Promo */}
          {producto.promocion && (
            <div className={cn('rounded-xl p-3 border', promoOk ? 'bg-pink-50 border-pink-200' : 'bg-gray-50 border-gray-200 opacity-60')}>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <Tag size={13} className={promoOk ? 'text-pink-500' : 'text-gray-400'} />
                <span className="text-xs font-semibold text-gray-700">
                  Promoción {promoOk ? '· activa' : '· inactiva'}
                </span>
                {producto.promocion.auto_renovar && (
                  <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-700 font-medium">
                    <RefreshCw size={9} /> Auto-renovar mensual
                  </span>
                )}
              </div>
              {producto.promocion.precio_oferta && (
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-pink-700">{formatCurrency(producto.promocion.precio_oferta)}</span>
                  <span className="text-xs text-gray-400 line-through">{formatCurrency(precio)}</span>
                  <span className="text-xs text-pink-600 font-medium">
                    -{Math.round((1 - producto.promocion.precio_oferta / precio) * 100)}%
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1 flex-wrap">
                <CalendarDays size={10} />
                {producto.promocion.fecha_inicio && <span>desde {producto.promocion.fecha_inicio}</span>}
                {producto.promocion.auto_renovar
                  ? <span>hasta el {lastDayOfMonth()} (renovación mensual)</span>
                  : producto.promocion.fecha_fin && <span>hasta {producto.promocion.fecha_fin}</span>
                }
              </div>
            </div>
          )}

          {/* Atributos de abertura */}
          {((producto.tipo_abertura as any)?.nombre || (producto.sistema as any)?.nombre || producto.color || attrs.length > 0) && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Especificaciones</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {(producto.tipo_abertura as any)?.nombre && (
                  <Row k="Tipo" v={(producto.tipo_abertura as any).nombre} />
                )}
                {(producto.sistema as any)?.nombre && (
                  <Row k="Sistema" v={(producto.sistema as any).nombre} />
                )}
                {producto.color && <Row k="Color" v={producto.color} />}
                {attrs.slice(0, 8).map(([k, v]) => <Row key={k} k={k} v={v} />)}
              </div>
            </div>
          )}

          {/* Características */}
          {([producto.caracteristica_1, producto.caracteristica_2, producto.caracteristica_3, producto.caracteristica_4].filter(Boolean) as string[]).length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Características</p>
              <ul className="space-y-1">
                {[producto.caracteristica_1, producto.caracteristica_2, producto.caracteristica_3, producto.caracteristica_4]
                  .filter(Boolean)
                  .map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <span className="mt-0.5 text-sky-400 shrink-0">·</span> {c}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Accesorios / vidrio */}
          {(producto.vidrio || producto.premarco || producto.accesorios?.length > 0) && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Incluye</p>
              <div className="flex flex-wrap gap-1.5">
                {producto.vidrio && <Tag2 label={`Vidrio: ${producto.vidrio}`} />}
                {producto.premarco && <Tag2 label="Premarco" />}
                {(producto.accesorios ?? []).map(a => <Tag2 key={a} label={a.replace(/_/g, ' ')} />)}
              </div>
            </div>
          )}

          {/* Descripción */}
          {producto.descripcion && (
            <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">{producto.descripcion}</p>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 rounded-b-2xl px-5 py-3 flex items-center justify-between">
          <button onClick={onToggle}
            className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
              producto.activo
                ? 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500'
                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
            )}>
            {producto.activo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {producto.activo ? 'Desactivar' : 'Activar'}
          </button>
          <Link to={`/productos/${producto.id}`} onClick={onClose}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium transition-colors">
            <Pencil size={12} /> Editar
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-[10px] text-gray-400 capitalize">{k}</span>
      <p className="text-xs font-medium text-gray-700 capitalize">{v}</p>
    </div>
  );
}
function Tag2({ label }: { label: string }) {
  return (
    <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">{label}</span>
  );
}

// ── Columna de productos ──────────────────────────────────────────────────────

function Columna({ titulo, productos, icono: Icono, color, onSelect, onToggle }: {
  titulo: string;
  productos: Producto[];
  icono: React.ElementType;
  color: string;
  onSelect: (p: Producto) => void;
  onToggle: (p: Producto) => void;
}) {
  return (
    <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Column header */}
      <div className={cn('px-4 py-3 border-b border-gray-100 flex items-center gap-2', color)}>
        <Icono size={15} />
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="ml-auto text-xs opacity-60">{productos.length}</span>
      </div>

      {productos.length === 0 ? (
        <div className="py-10 text-center text-xs text-gray-400">Sin productos</div>
      ) : (
        <div className="divide-y divide-gray-50 overflow-y-auto flex-1">
          {productos.map(p => {
            const sub = buildSubtitle(p);
            const promoOk = isPromoActiva(p);
            return (
              <div key={p.id}
                className={cn('flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors group',
                  !p.activo && 'opacity-50')}
                onClick={() => onSelect(p)}
              >
                {/* Thumbnail */}
                <div className="w-9 h-9 shrink-0 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden mt-0.5">
                  {(p.imagenes?.[0] || p.imagen_url)
                    ? <img src={p.imagenes?.[0] || p.imagen_url!} alt="" className="w-full h-full object-cover" />
                    : <Package size={14} className="text-gray-300" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-snug">{p.nombre}</p>
                  {sub && <p className="text-[10px] text-gray-400 mt-0.5 leading-snug truncate">{sub}</p>}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', TIPO_COLOR[p.tipo])}>
                      {TIPO_LABEL[p.tipo]}
                    </span>
                    {p.margen_tipo && (
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-0.5', MARGEN_COLOR[p.margen_tipo])}>
                        <Percent size={8} />{MARGEN_LABEL[p.margen_tipo]}
                      </span>
                    )}
                    {promoOk && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-pink-200 bg-pink-50 text-pink-700 flex items-center gap-0.5">
                        <Tag size={8} />Promo
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {promoOk && p.promocion?.precio_oferta ? (
                    <>
                      <p className="text-xs font-bold text-pink-700">{formatCurrency(p.promocion.precio_oferta)}</p>
                      <p className="text-[10px] text-gray-400 line-through">{formatCurrency(p.precio_base)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-gray-800">{formatCurrency(p.precio_base)}</p>
                      {p.precio_por_m2 && <p className="text-[10px] text-gray-400">/m²</p>}
                    </>
                  )}
                  <button
                    className="hidden group-hover:flex items-center mt-0.5 text-[10px] text-gray-400 hover:text-gray-600"
                    onClick={e => { e.stopPropagation(); onToggle(p); }}
                    title={p.activo ? 'Desactivar' : 'Activar'}
                  >
                    {p.activo ? <ToggleRight size={14} className="text-emerald-400" /> : <ToggleLeft size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Producto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get<Producto[]>('/productos');
    setProductos(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActivo(producto: Producto) {
    const { activo } = await api.patch<{ id: string; activo: boolean }>(`/productos/${producto.id}/toggle`);
    setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, activo } : p));
    if (selected?.id === producto.id) setSelected(prev => prev ? { ...prev, activo } : null);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return productos;
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q) ||
      (p.tipo_abertura as any)?.nombre?.toLowerCase().includes(q)
    );
  }, [productos, search]);

  const { ventanas, puertas, balcon, otros } = useMemo(() => {
    const ventanas: Producto[] = [];
    const puertas: Producto[]  = [];
    const balcon: Producto[]   = [];
    const otros: Producto[]    = [];
    filtered.forEach(p => {
      const n = ((p.tipo_abertura as any)?.nombre ?? '').toLowerCase();
      if (n.includes('balc'))    balcon.push(p);
      else if (n.includes('ventana')) ventanas.push(p);
      else if (n.includes('puerta'))  puertas.push(p);
      else                            otros.push(p);
    });
    const byName = (a: Producto, b: Producto) => a.nombre.localeCompare(b.nombre);
    return {
      ventanas: ventanas.sort(byName),
      puertas:  puertas.sort(byName),
      balcon:   balcon.sort(byName),
      otros:    otros.sort(byName),
    };
  }, [filtered]);

  const cols = [
    { titulo: 'Ventanas',       items: ventanas, icono: AppWindow, color: 'text-sky-700 bg-sky-50' },
    { titulo: 'Puertas',        items: puertas,  icono: DoorOpen,  color: 'text-violet-700 bg-violet-50' },
    { titulo: 'Puerta-Balcón',  items: balcon,   icono: AppWindow, color: 'text-teal-700 bg-teal-50' },
    ...(otros.length ? [{ titulo: 'Otros', items: otros, icono: Package, color: 'text-gray-600 bg-gray-50' }] : []),
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
            <Layers size={20} className="text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Productos</h1>
            <p className="text-sm text-gray-500">Catálogo de aberturas y precios base</p>
          </div>
        </div>
        <Link
          to="/productos/nuevo"
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all"
        >
          <Plus size={16} /> Nuevo producto
        </Link>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, código o tipo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 animate-pulse">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-12 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Package size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-1">No hay productos en el catálogo</p>
          <Link to="/productos/nuevo" className="text-sm text-sky-600 hover:underline">
            Agregar el primero
          </Link>
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          {cols.map(col => (
            <Columna
              key={col.titulo}
              titulo={col.titulo}
              productos={col.items}
              icono={col.icono}
              color={col.color}
              onSelect={setSelected}
              onToggle={toggleActivo}
            />
          ))}
        </div>
      )}

      {selected && (
        <ProductoModal
          producto={selected}
          onClose={() => setSelected(null)}
          onToggle={() => toggleActivo(selected)}
        />
      )}
    </div>
  );
}
