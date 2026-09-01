import { useEffect, useMemo, useState } from 'react';
import {
  Search, X, Layers, Package, AppWindow, DoorOpen, Store,
  SlidersHorizontal, ArrowUpDown, ChevronRight, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SORT_LABEL, buildFacets, productoMatchTexto, productoPasaFacets, sortProductos,
  type SortKey,
} from '@/lib/catalogoFiltros';
import { ningunProveedorConPlazo } from '@/lib/disponibilidad';
import {
  CATEGORIA_SIN_TIPO, EN_SALON_KEY, FILTRO_BTN, PALETA_CATEGORIAS, SIN_TIPO_KEY,
  buildDescendientes, buildHijosDe, buildNodeById, paletaDeNodo, rootIdDe,
  type Categoria,
} from '@/lib/catalogoCategorias';
import { FacetsPanel } from '@/components/catalogo/FacetsPanel';
import { GridMosaico } from '@/components/catalogo/GridMosaico';
import { ColumnaCategoria } from '@/components/catalogo/ColumnaCategoria';
import type { Producto } from '@/types';

// Explorador del catálogo: buscador + árbol de categorías + orden + facetas + grilla.
//
// Es UNA sola implementación con dos consumidores: la sección Productos (modo gestión:
// activar/desactivar, marcar en salón, vender ahora) y el modal de catálogo al armar
// un presupuesto (modo selección: agregar al presupuesto, contador por producto). El
// modo no es un flag: se deriva de qué callbacks se pasan.

export interface ExploradorCatalogoProps {
  productos: Producto[];
  categorias: Categoria[];
  loading?: boolean;

  /** Click en la tarjeta — típicamente abrir el detalle. */
  onSelect: (p: Producto) => void;

  // Modo gestión
  onToggleActivo?: (p: Producto) => void;
  onToggleSalon?: (p: Producto) => void | Promise<void>;
  mostrarVenderAhora?: boolean;

  // Modo selección
  onAgregar?: (p: Producto) => void;
  cantidadEnCarrito?: (p: Producto) => number;
  /** Qué hacer al elegir una variante de un modelo (default: onSelect). */
  onSelectVariante?: (p: Producto) => void;

  /**
   * Mostrar facetas transversales (proveedor / color / nivel / medida) también en
   * "Todos" y en la búsqueda. Las facetas por `atributos` siguen apareciendo solo
   * dentro de una categoría, porque su schema depende del tipo de abertura.
   */
  facetasTransversalesEnBusqueda?: boolean;

  /** Slots — para que la página no tenga que meter su lógica dentro del explorador. */
  renderHeader?: (visibles: Producto[]) => React.ReactNode;
  renderFooter?: () => React.ReactNode;
  vacio?: React.ReactNode;

  /** Sube los modales anidados por encima del contenedor (ver ModalCatalogoProductos). */
  zDrawer?: string;
  zModales?: string;
}

export function ExploradorCatalogo({
  productos, categorias, loading = false,
  onSelect, onToggleActivo, onToggleSalon, mostrarVenderAhora,
  onAgregar, cantidadEnCarrito, onSelectVariante,
  facetasTransversalesEnBusqueda = false,
  renderHeader, renderFooter, vacio,
  zDrawer = 'z-50', zModales,
}: ExploradorCatalogoProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('relevancia');
  const [categoriaPath, setCategoriaPath] = useState<string[]>([]);
  const [facetFilters, setFacetFilters] = useState<Record<string, string[]>>({});
  const [soloInmediata, setSoloInmediata] = useState(false);
  const [mobileFiltrosOpen, setMobileFiltrosOpen] = useState(false);

  const nodoActivoId = categoriaPath.length ? categoriaPath[categoriaPath.length - 1] : null;
  // Las facetas de una categoría no tienen sentido en otra — se limpian al navegar.
  useEffect(() => { setFacetFilters({}); }, [nodoActivoId]);

  function toggleFacetValue(key: string, value: string) {
    setFacetFilters(prev => {
      const cur = prev[key] ?? [];
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
      const copy = { ...prev };
      if (next.length) copy[key] = next; else delete copy[key];
      return copy;
    });
  }
  const activeFacetCount = Object.values(facetFilters).reduce((s, v) => s + v.length, 0);

  const filtered = useMemo(
    () => productos.filter(p => productoMatchTexto(p, search)),
    [productos, search],
  );

  // ── Árbol de categorías
  const hijosDe   = useMemo(() => buildHijosDe(categorias), [categorias]);
  const raices    = hijosDe['__root__'] ?? [];
  const nodeById  = useMemo(() => buildNodeById(categorias), [categorias]);
  const descendientesDe = useMemo(() => buildDescendientes(categorias, hijosDe), [categorias, hijosDe]);

  // Agrupa por Familia (raíz del árbol) — vista "Todos" apilada. Cualquier categoría
  // nueva cargada en Configuración aparece sola al agregarle productos.
  const categorizarPorRaiz = useMemo(() => (lista: Producto[]) => {
    const grupos: Record<string, Producto[]> = { [SIN_TIPO_KEY]: [] };
    raices.forEach(r => { grupos[r.id] = []; });
    lista.forEach(p => {
      const rid = rootIdDe(nodeById, p.categoria_id);
      const key = rid && grupos[rid] ? rid : SIN_TIPO_KEY;
      grupos[key].push(p);
    });
    Object.keys(grupos).forEach(k => { grupos[k] = sortProductos(grupos[k], sortBy); });
    return grupos;
  }, [raices, nodeById, sortBy]);

  const gruposFiltrados = useMemo(() => categorizarPorRaiz(filtered), [categorizarPorRaiz, filtered]);
  // Existencia por categoría en TODO el catálogo — a propósito sobre `productos` y no
  // sobre `filtered`: si no, los pills aparecen y desaparecen mientras se tipea.
  const existeCategoria = useMemo(() => {
    const c = categorizarPorRaiz(productos);
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.length > 0]));
  }, [categorizarPorRaiz, productos]);

  const columnas = useMemo(() => [
    ...raices.map((t, i) => {
      const pal = PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length];
      const n = t.nombre.toLowerCase();
      const icono = n.includes('puerta') && !n.includes('balc') ? DoorOpen
        : (n.includes('ventana') || n.includes('balc')) ? AppWindow : Package;
      return {
        key: t.id, titulo: t.nombre, items: gruposFiltrados[t.id] ?? [], icono, color: pal.color,
        headerBg: pal.headerBg, headerText: pal.headerText, badgeBg: 'bg-white', badgeText: pal.badgeText,
        borderCol: pal.borderCol, priceColor: pal.priceColor,
      };
    }),
    ...(existeCategoria[SIN_TIPO_KEY] ? [{
      key: SIN_TIPO_KEY, titulo: 'Sin categoría', items: gruposFiltrados[SIN_TIPO_KEY] ?? [], icono: Package, color: CATEGORIA_SIN_TIPO.color,
      headerBg: CATEGORIA_SIN_TIPO.headerBg, headerText: CATEGORIA_SIN_TIPO.headerText, badgeBg: 'bg-white', badgeText: CATEGORIA_SIN_TIPO.badgeText,
      borderCol: CATEGORIA_SIN_TIPO.borderCol, priceColor: CATEGORIA_SIN_TIPO.priceColor,
    }] : []),
  ], [raices, gruposFiltrados, existeCategoria]);

  // "En salón" es un subgrupo transversal (cruza categorías) — pill aparte, solo en la raíz.
  const existeEnSalon = productos.some(p => p.en_salon);

  const categoriaActiva = nodoActivoId ? {
    key: nodoActivoId,
    titulo: nodoActivoId === EN_SALON_KEY ? 'En salón' : (nodeById[nodoActivoId]?.nombre ?? ''),
    items: nodoActivoId === EN_SALON_KEY
      ? filtered.filter(p => p.en_salon)
      : filtered.filter(p => p.categoria_id && descendientesDe[nodoActivoId]?.has(p.categoria_id)),
    priceColor: paletaDeNodo(nodeById, raices, nodoActivoId).priceColor,
  } : null;

  // Facetas por atributo solo dentro de una categoría real: fuera de ahí el set mezcla
  // materiales, y por lo tanto schemas de atributos distintos. Las transversales
  // (proveedor, color, nivel, medida) no tienen ese problema.
  const facetsActivas = useMemo(() => {
    if (categoriaActiva && categoriaActiva.key !== EN_SALON_KEY) return buildFacets(categoriaActiva.items);
    if (!facetasTransversalesEnBusqueda) return [];
    return buildFacets(categoriaActiva ? categoriaActiva.items : filtered, { soloTransversales: true });
  }, [categoriaActiva?.key, categoriaActiva?.items, filtered, facetasTransversalesEnBusqueda]);

  // Pipeline común a las dos vistas planas: facetas → chip de entrega → orden.
  // Con Productos por default (sin facetas fuera de categoría y el chip apagado) da
  // exactamente la misma lista que antes de la extracción.
  const visibles = useMemo(() => {
    const base = categoriaActiva ? categoriaActiva.items : filtered;
    let out = base.filter(p => productoPasaFacets(p, facetFilters));
    if (soloInmediata) out = out.filter(p => (p.stock_actual ?? 0) >= 1);
    return sortProductos(out, sortBy);
  }, [categoriaActiva?.items, filtered, facetFilters, soloInmediata, sortBy]);

  const hayFiltroDeLista = activeFacetCount > 0 || soloInmediata;
  const sinPlazoCargado = facetasTransversalesEnBusqueda && !loading && productos.length > 0
    && ningunProveedorConPlazo(productos);

  const propsGrilla = {
    onSelect, onToggle: onToggleActivo, onToggleSalon, onAgregar,
    cantidadEnCarrito, mostrarVenderAhora, onSelectVariante, zModales,
  };

  return (
    <div className="space-y-5">
      {/* Buscador + orden + entrega inmediata */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600"/>
          <input
            type="text" placeholder="Buscar por nombre, código o tipo..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white shadow-md"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-600">
              <X size={14}/>
            </button>
          )}
        </div>
        <div className="relative shrink-0">
          <ArrowUpDown size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"/>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="appearance-none pl-8 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map(k => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setSoloInmediata(v => !v)}
          title="Solo productos con stock — se entregan sin esperar al proveedor"
          className={cn(
            'flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all shrink-0',
            soloInmediata
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
          )}
        >
          <Zap size={14}/> Entrega inmediata
        </button>
        {facetsActivas.length > 0 && (
          <button
            onClick={() => setMobileFiltrosOpen(true)}
            className="lg:hidden flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white shadow-md text-gray-600 shrink-0"
          >
            <SlidersHorizontal size={14}/> Filtros
            {activeFacetCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-600 text-white">{activeFacetCount}</span>
            )}
          </button>
        )}
      </div>

      {sinPlazoCargado && (
        <p className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Ningún proveedor tiene cargado el plazo de entrega.{' '}
          <a href="/proveedores" className="text-sky-600 hover:underline font-medium">Cargalo en Proveedores</a>{' '}
          para ver acá una estimación por producto.
        </p>
      )}

      {/* Navegación por árbol de categorías — breadcrumb + nivel actual */}
      {!loading && productos.length > 0 && (
        <div className="space-y-2">
          {categoriaPath.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap text-xs font-semibold text-gray-600">
              <button onClick={() => setCategoriaPath([])} className="hover:text-sky-600 hover:underline">Todos</button>
              {categoriaPath.map((id, i) => (
                <span key={id} className="flex items-center gap-1">
                  <ChevronRight size={12} className="text-gray-600"/>
                  {i === categoriaPath.length - 1 ? (
                    <span className="text-gray-800">{id === EN_SALON_KEY ? 'En salón' : nodeById[id]?.nombre}</span>
                  ) : (
                    <button onClick={() => setCategoriaPath(categoriaPath.slice(0, i + 1))} className="hover:text-sky-600 hover:underline">
                      {nodeById[id]?.nombre}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setCategoriaPath([])}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all',
                categoriaPath.length === 0
                  ? 'bg-gray-800 text-white shadow-md shadow-gray-300'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              )}
            >
              <Layers size={16}/> Todos
              <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-full', categoriaPath.length === 0 ? 'bg-white/20' : 'bg-gray-100')}>
                {filtered.length}
              </span>
            </button>

            {categoriaPath.length === 0 && columnas.map(col => (
              <button
                key={col.key}
                onClick={() => setCategoriaPath([col.key])}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all', FILTRO_BTN[col.color].inactive)}
              >
                <col.icono size={16}/> {col.titulo}
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white">{col.items.length}</span>
              </button>
            ))}
            {categoriaPath.length === 0 && existeEnSalon && (
              <button
                onClick={() => setCategoriaPath([EN_SALON_KEY])}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ml-1.5 border-l-2 border-gray-200 pl-3.5', FILTRO_BTN.emerald.inactive)}
              >
                <Store size={16}/> En salón
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white">{filtered.filter(p => p.en_salon).length}</span>
              </button>
            )}

            {nodoActivoId && nodoActivoId !== EN_SALON_KEY && (hijosDe[nodoActivoId] ?? []).map(hijo => {
              const count = filtered.filter(p => p.categoria_id && descendientesDe[hijo.id]?.has(p.categoria_id)).length;
              return (
                <button
                  key={hijo.id}
                  onClick={() => setCategoriaPath([...categoriaPath, hijo.id])}
                  className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all', FILTRO_BTN[paletaDeNodo(nodeById, raices, nodoActivoId).color ?? 'sky'].inactive)}
                >
                  {hijo.nombre}
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {renderHeader?.(visibles)}

      {/* Contenido */}
      {loading ? (
        <div className="flex gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
              <div className="h-12 bg-gray-100"/>
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex gap-3 p-3 border-t border-gray-200">
                  <div className="w-[108px] h-[108px] bg-gray-100 rounded"/>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-gray-100 rounded w-3/4"/>
                    <div className="h-2 bg-gray-100 rounded w-1/2"/>
                    <div className="h-4 bg-gray-100 rounded w-1/3"/>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        vacio ?? (
          <div className="py-16 text-center">
            <Package size={36} className="text-gray-200 mx-auto mb-3"/>
            <p className="text-sm text-gray-600">Ningún producto coincide con la búsqueda</p>
          </div>
        )
      ) : categoriaActiva ? (
        /* Categoría activa: sidebar de facetas + mosaico de esa categoría */
        <div className="flex gap-4 items-start">
          {facetsActivas.length > 0 && (
            <aside className="hidden lg:block w-52 shrink-0 sticky top-4 space-y-4">
              <FacetsPanel facets={facetsActivas} activos={facetFilters} onToggle={toggleFacetValue}
                onLimpiar={() => setFacetFilters({})} activeCount={activeFacetCount}/>
            </aside>
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm text-gray-600">
              {visibles.length} producto{visibles.length !== 1 ? 's' : ''} en {categoriaActiva.titulo}
            </p>
            {visibles.length === 0 ? (
              <div className="py-16 text-center">
                <Package size={36} className="text-gray-200 mx-auto mb-3"/>
                <p className="text-sm text-gray-600">
                  {categoriaActiva.items.length === 0
                    ? `Sin productos en esta categoría${search ? ' para tu búsqueda' : ''}`
                    : 'Ningún producto coincide con los filtros elegidos'}
                </p>
                {hayFiltroDeLista && (
                  <button onClick={() => { setFacetFilters({}); setSoloInmediata(false); }}
                    className="text-sm text-sky-600 hover:underline font-medium mt-2">Limpiar filtros</button>
                )}
              </div>
            ) : (
              <GridMosaico productos={visibles} priceColor={categoriaActiva.priceColor} {...propsGrilla}/>
            )}
          </div>
        </div>
      ) : search || hayFiltroDeLista ? (
        /* Búsqueda o filtro transversal: mosaico plano */
        <div className="flex gap-4 items-start">
          {facetsActivas.length > 0 && (
            <aside className="hidden lg:block w-52 shrink-0 sticky top-4 space-y-4">
              <FacetsPanel facets={facetsActivas} activos={facetFilters} onToggle={toggleFacetValue}
                onLimpiar={() => setFacetFilters({})} activeCount={activeFacetCount}/>
            </aside>
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm text-gray-600">
              {visibles.length} resultado{visibles.length !== 1 ? 's' : ''}{search ? ` para "${search}"` : ''}
            </p>
            {visibles.length === 0 ? (
              <div className="py-16 text-center">
                <Package size={36} className="text-gray-200 mx-auto mb-3"/>
                <p className="text-sm text-gray-600">Ningún producto coincide con los filtros elegidos</p>
                {hayFiltroDeLista && (
                  <button onClick={() => { setFacetFilters({}); setSoloInmediata(false); }}
                    className="text-sm text-sky-600 hover:underline font-medium mt-2">Limpiar filtros</button>
                )}
              </div>
            ) : (
              <GridMosaico productos={visibles} priceColor="text-sky-700" {...propsGrilla}/>
            )}
          </div>
        </div>
      ) : (
        /* Vista normal: secciones apiladas por categoría, cada una en mosaico */
        <div className="space-y-5">
          {columnas.map(col => (
            <ColumnaCategoria
              key={col.titulo}
              titulo={col.titulo}
              productos={col.items}
              icono={col.icono}
              headerBg={col.headerBg}
              headerText={col.headerText}
              badgeBg={col.badgeBg}
              badgeText={col.badgeText}
              borderCol={col.borderCol}
              priceColor={col.priceColor}
              {...propsGrilla}
            />
          ))}
        </div>
      )}

      {!loading && !search && !categoriaActiva && !hayFiltroDeLista && renderFooter?.()}

      {mobileFiltrosOpen && (
        <div className={cn('fixed inset-0 flex lg:hidden', zDrawer)}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltrosOpen(false)}/>
          <div className="relative ml-auto w-[85%] max-w-xs h-full bg-gray-50 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-800">Filtros</p>
              <button onClick={() => setMobileFiltrosOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600"><X size={16}/></button>
            </div>
            <FacetsPanel facets={facetsActivas} activos={facetFilters} onToggle={toggleFacetValue}
              onLimpiar={() => setFacetFilters({})} activeCount={activeFacetCount}/>
            <button
              onClick={() => setMobileFiltrosOpen(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold"
            >
              Ver {visibles.length} producto{visibles.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
