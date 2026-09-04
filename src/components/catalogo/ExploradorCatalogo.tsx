import { useMemo, useState } from 'react';
import {
  Search, X, Package, AppWindow, DoorOpen, Store,
  SlidersHorizontal, ArrowUpDown, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SORT_LABEL, buildFacets, productoMatchTexto, productoPasaFacets, sortProductos,
  type SortKey,
} from '@/lib/catalogoFiltros';
import { ningunProveedorConPlazo } from '@/lib/disponibilidad';
import {
  CASCADA_VACIA, cascadaActiva, productosFiltradosPorCascada, tipologiaKeyDeFamilia,
  type CascadaFiltro,
} from '@/lib/catalogoCascada';
import { CATEGORIA_SIN_TIPO, PALETA_CATEGORIAS, SIN_TIPO_KEY } from '@/lib/catalogoCategorias';
import { BusquedaCascada } from '@/components/catalogo/BusquedaCascada';
import { FacetsPanel } from '@/components/catalogo/FacetsPanel';
import { GridMosaico } from '@/components/catalogo/GridMosaico';
import { ColumnaCategoria } from '@/components/catalogo/ColumnaCategoria';
import type { Producto } from '@/types';

// Explorador del catálogo: buscador libre + búsqueda en cascada (Material → Familia →
// Tipología → Medida) + facetas de afinado + orden + grilla.
//
// Es UNA sola implementación con dos consumidores: la sección Productos (modo gestión:
// activar/desactivar, marcar en salón, vender ahora) y el modal de catálogo al armar
// un presupuesto (modo selección: agregar al presupuesto, contador por producto). El
// modo no es un flag: se deriva de qué callbacks se pasan.

export interface ExploradorCatalogoProps {
  productos: Producto[];
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
   * Mostrar facetas transversales (proveedor / color / nivel) también sin ningún filtro
   * de la cascada activo. Las facetas por `atributos` (Sistema/Línea, Diseño, Vidrio,
   * Funcionamiento...) siguen apareciendo solo con una Familia elegida, porque su
   * schema depende del tipo de abertura.
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
  productos, loading = false,
  onSelect, onToggleActivo, onToggleSalon, mostrarVenderAhora,
  onAgregar, cantidadEnCarrito, onSelectVariante,
  facetasTransversalesEnBusqueda = false,
  renderHeader, renderFooter, vacio,
  zDrawer = 'z-50', zModales,
}: ExploradorCatalogoProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('relevancia');
  const [cascada, setCascada] = useState<CascadaFiltro>(CASCADA_VACIA);
  const [facetFilters, setFacetFilters] = useState<Record<string, string[]>>({});
  const [soloInmediata, setSoloInmediata] = useState(false);
  const [soloEnSalon, setSoloEnSalon] = useState(false);
  const [mobileFiltrosOpen, setMobileFiltrosOpen] = useState(false);

  // Las facetas de afinado dependen del schema de la Familia — no tienen sentido en
  // otra, se limpian al cambiar de familia.
  const familiaSel = cascada.familiaId;

  function setCascadaYLimpiarFacetas(next: CascadaFiltro) {
    if (next.familiaId !== cascada.familiaId) setFacetFilters({});
    setCascada(next);
  }

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

  const trasCascada = useMemo(() => productosFiltradosPorCascada(filtered, cascada), [filtered, cascada]);

  // ── Agrupación por Familia (tipo_abertura) — vista "Todos" apilada por defecto.
  const familiasOrdenadas = useMemo(() => {
    const seen = new Map<string, { id: string; nombre: string }>();
    productos.forEach(p => {
      if (p.tipo_abertura_id && p.tipo_abertura?.nombre && !seen.has(p.tipo_abertura_id)) {
        seen.set(p.tipo_abertura_id, { id: p.tipo_abertura_id, nombre: p.tipo_abertura.nombre });
      }
    });
    return [...seen.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos]);

  const agruparPorFamilia = useMemo(() => (lista: Producto[]) => {
    const grupos: Record<string, Producto[]> = { [SIN_TIPO_KEY]: [] };
    familiasOrdenadas.forEach(f => { grupos[f.id] = []; });
    lista.forEach(p => {
      const key = p.tipo_abertura_id && grupos[p.tipo_abertura_id] ? p.tipo_abertura_id : SIN_TIPO_KEY;
      grupos[key].push(p);
    });
    Object.keys(grupos).forEach(k => { grupos[k] = sortProductos(grupos[k], sortBy); });
    return grupos;
  }, [familiasOrdenadas, sortBy]);

  const gruposFiltrados = useMemo(() => agruparPorFamilia(filtered), [agruparPorFamilia, filtered]);
  // Existencia por familia en TODO el catálogo — a propósito sobre `productos` y no
  // sobre `filtered`: si no, los pills aparecerían y desaparecerían mientras se tipea.
  const existeFamilia = useMemo(() => {
    const c = agruparPorFamilia(productos);
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.length > 0]));
  }, [agruparPorFamilia, productos]);

  const columnas = useMemo(() => [
    ...familiasOrdenadas.map((f, i) => {
      const pal = PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length];
      const n = f.nombre.toLowerCase();
      const icono = n.includes('puerta') && !n.includes('balc') ? DoorOpen
        : (n.includes('ventana') || n.includes('balc')) ? AppWindow : Package;
      return {
        key: f.id, titulo: f.nombre, items: gruposFiltrados[f.id] ?? [], icono, color: pal.color,
        headerBg: pal.headerBg, headerText: pal.headerText, badgeBg: 'bg-white', badgeText: pal.badgeText,
        borderCol: pal.borderCol, priceColor: pal.priceColor,
      };
    }),
    ...(existeFamilia[SIN_TIPO_KEY] ? [{
      key: SIN_TIPO_KEY, titulo: 'Sin categoría', items: gruposFiltrados[SIN_TIPO_KEY] ?? [], icono: Package, color: CATEGORIA_SIN_TIPO.color,
      headerBg: CATEGORIA_SIN_TIPO.headerBg, headerText: CATEGORIA_SIN_TIPO.headerText, badgeBg: 'bg-white', badgeText: CATEGORIA_SIN_TIPO.badgeText,
      borderCol: CATEGORIA_SIN_TIPO.borderCol, priceColor: CATEGORIA_SIN_TIPO.priceColor,
    }] : []),
  ], [familiasOrdenadas, gruposFiltrados, existeFamilia]);

  const existeEnSalon = productos.some(p => p.en_salon);

  // Facetas de afinado (Sistema/Línea, Diseño, Vidrio, Funcionamiento...) solo con una
  // Familia elegida: fuera de ahí el set mezcla materiales y por lo tanto schemas de
  // atributos distintos. Se excluye la clave que ya se usa como paso 3 (Tipología) para
  // no mostrar el mismo dato dos veces. Proveedor/color/nivel sí son transversales.
  const facetsActivas = useMemo(() => {
    if (familiaSel) {
      const nombreFamilia = trasCascada[0]?.tipo_abertura?.nombre ?? '';
      const keyTipologia = tipologiaKeyDeFamilia(nombreFamilia);
      return buildFacets(trasCascada, { excludeAttrKeys: keyTipologia ? [keyTipologia] : [] });
    }
    if (!facetasTransversalesEnBusqueda) return [];
    return buildFacets(trasCascada, { soloTransversales: true });
  }, [familiaSel, trasCascada, facetasTransversalesEnBusqueda]);

  const visibles = useMemo(() => {
    let out = trasCascada.filter(p => productoPasaFacets(p, facetFilters));
    if (soloInmediata) out = out.filter(p => (p.stock_actual ?? 0) >= 1);
    if (soloEnSalon) out = out.filter(p => p.en_salon);
    return sortProductos(out, sortBy);
  }, [trasCascada, facetFilters, soloInmediata, soloEnSalon, sortBy]);

  const hayFiltroDeLista = activeFacetCount > 0 || soloInmediata || soloEnSalon || cascadaActiva(cascada);
  const sinPlazoCargado = facetasTransversalesEnBusqueda && !loading && productos.length > 0
    && ningunProveedorConPlazo(productos);

  const propsGrilla = {
    onSelect, onToggle: onToggleActivo, onToggleSalon, onAgregar,
    cantidadEnCarrito, mostrarVenderAhora, onSelectVariante, zModales,
  };

  return (
    <div className="space-y-5">
      {/* Buscador libre + orden + entrega inmediata + en salón */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600"/>
          <input
            type="text" placeholder='Buscar producto, código o medida... Ej: "ventana 120x100"'
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
        {existeEnSalon && (
          <button
            onClick={() => setSoloEnSalon(v => !v)}
            title="Solo productos exhibidos en el local"
            className={cn(
              'flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all shrink-0',
              soloEnSalon
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
            )}
          >
            <Store size={14}/> En salón
          </button>
        )}
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

      {/* Búsqueda en cascada: Material → Familia → Tipología → Medida */}
      {!loading && productos.length > 0 && (
        <BusquedaCascada productos={filtered} valor={cascada} onChange={setCascadaYLimpiarFacetas}/>
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
      ) : search || hayFiltroDeLista ? (
        /* Búsqueda o cascada/facetas activas: mosaico plano de resultados */
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
                  <button onClick={() => { setFacetFilters({}); setSoloInmediata(false); setSoloEnSalon(false); setCascada(CASCADA_VACIA); }}
                    className="text-sm text-sky-600 hover:underline font-medium mt-2">Limpiar filtros</button>
                )}
              </div>
            ) : (
              <GridMosaico productos={visibles} priceColor="text-sky-700" {...propsGrilla}/>
            )}
          </div>
        </div>
      ) : (
        /* Vista normal: secciones apiladas por familia, cada una en mosaico */
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

      {!loading && !search && !hayFiltroDeLista && renderFooter?.()}

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
