import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, ToggleLeft, ToggleRight, Search, Layers, Package } from 'lucide-react';
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

const FILTROS: { value: TipoOperacion | 'todos'; label: string }[] = [
  { value: 'todos',              label: 'Todos' },
  { value: 'estandar',          label: 'Estándar' },
  { value: 'a_medida_proveedor', label: 'A medida' },
  { value: 'fabricacion_propia', label: 'Fabricación' },
];

export function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<TipoOperacion | 'todos'>('todos');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtro !== 'todos') params.set('tipo', filtro);
    if (search.trim()) params.set('search', search);
    const data = await api.get<Producto[]>(`/productos?${params}`);
    setProductos(data);
    setLoading(false);
  }, [filtro, search]);

  useEffect(() => { load(); }, [load]);

  async function toggleActivo(producto: Producto) {
    const { activo } = await api.patch<{ id: string; activo: boolean }>(`/productos/${producto.id}/toggle`);
    setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, activo } : p));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
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

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTROS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFiltro(value)}
            className={cn(
              'whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
              filtro === value
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300 hover:text-sky-600'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse flex gap-4">
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : productos.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-1">No hay productos en el catálogo</p>
            <Link to="/productos/nuevo" className="text-sm text-sky-600 hover:underline">
              Agregar el primero
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {productos.map(p => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  !p.activo && 'opacity-50 bg-gray-50'
                )}
              >
                {/* Imagen thumbnail */}
                <div className="w-10 h-10 shrink-0 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {p.imagen_url
                    ? <img src={p.imagen_url} alt="" className="w-full h-full object-cover" />
                    : <Package size={16} className="text-gray-300" />}
                </div>
                <div className="w-24 shrink-0">
                  <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', TIPO_COLOR[p.tipo])}>
                    {TIPO_LABEL[p.tipo]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.nombre}</p>
                    {p.codigo && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">{p.codigo}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                    {(p.tipo_abertura as any)?.nombre && <span>{(p.tipo_abertura as any).nombre}</span>}
                    {(p.sistema as any)?.nombre && <span>· {(p.sistema as any).nombre}</span>}
                    {p.color && <span>· {p.color}</span>}
                    {p.ancho && p.alto && <span>· {p.ancho} × {p.alto} cm</span>}
                    {p.precio_por_m2 && <span className="text-violet-500">· precio/m²</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 w-36">
                  <p className="text-sm font-semibold text-gray-800">
                    {formatCurrency(p.precio_base)}
                    {p.precio_por_m2 && <span className="text-xs font-normal text-gray-400">/m²</span>}
                  </p>
                  <p className="text-xs text-gray-400">costo: {formatCurrency(p.costo_base)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/productos/${p.id}`}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-sky-600 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </Link>
                  <button
                    onClick={() => toggleActivo(p)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      p.activo
                        ? 'hover:bg-gray-100 text-green-500 hover:text-gray-400'
                        : 'hover:bg-gray-100 text-gray-300 hover:text-green-500'
                    )}
                    title={p.activo ? 'Desactivar' : 'Activar'}
                  >
                    {p.activo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
