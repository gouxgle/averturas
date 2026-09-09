import { describe, it, expect } from 'vitest';
import {
  buildFacets, productoPasaFacets, sortProductos, productoMatchTexto,
  FACET_PROVEEDOR, SORT_LABEL, type SortKey,
} from '../catalogoFiltros';
import type { Producto } from '@/types';

// Fábrica mínima: solo los campos que tocan búsqueda, orden y facetas.
function prod(over: Partial<Producto> & { id: string }): Producto {
  return {
    nombre: 'Producto', codigo: null, precio_base: 100, costo_base: 50,
    stock_actual: 0, activo: true, en_salon: false, atributos: {},
    promocion: null, ancho: null, alto: null, color: null,
    ...over,
  } as unknown as Producto;
}

describe('productoMatchTexto', () => {
  const p = prod({
    id: '1', nombre: 'Ventana corrediza', codigo: 'VC-100',
    tipo_abertura: { id: 't', nombre: 'Ventana' },
    sistema: { id: 's', nombre: 'Aluminio' },
    caracteristica_1: 'DVH', caracteristica_2: null,
  } as unknown as Partial<Producto> & { id: string });

  it('sin query, pasa todo', () => expect(productoMatchTexto(p, '  ')).toBe(true));
  it('matchea nombre, código, tipo, sistema y característica', () => {
    for (const q of ['ventana', 'vc-100', 'Alumin', 'dvh']) {
      expect(productoMatchTexto(p, q)).toBe(true);
    }
  });
  it('no matchea lo que no está', () => expect(productoMatchTexto(p, 'puerta')).toBe(false));
});

describe('sortProductos', () => {
  const barato = prod({ id: 'a', nombre: 'B', precio_base: 100, stock_actual: 0 });
  const caro   = prod({ id: 'b', nombre: 'A', precio_base: 900, stock_actual: 5 });

  it('precio ascendente y descendente', () => {
    expect(sortProductos([caro, barato], 'precio_asc')[0].id).toBe('a');
    expect(sortProductos([barato, caro], 'precio_desc')[0].id).toBe('b');
  });
  it('más stock primero', () => expect(sortProductos([barato, caro], 'stock_desc')[0].id).toBe('b'));
  it('nombre A-Z', () => expect(sortProductos([barato, caro], 'nombre')[0].id).toBe('b'));
  it('relevancia: la etiqueta manda sobre el nombre', () => {
    const etiquetado = prod({ id: 'c', nombre: 'Z', etiqueta: 'mas_vendido' } as unknown as Partial<Producto> & { id: string });
    expect(sortProductos([barato, caro, etiquetado], 'relevancia')[0].id).toBe('c');
  });
  it('no muta el array original', () => {
    const orig = [caro, barato];
    sortProductos(orig, 'precio_asc');
    expect(orig[0].id).toBe('b');
  });
  it('todas las claves de SORT_LABEL son ordenables', () => {
    for (const k of Object.keys(SORT_LABEL) as SortKey[]) {
      expect(sortProductos([caro, barato], k)).toHaveLength(2);
    }
  });
});

describe('sortProductos — entrega más rápida', () => {
  const conStock = prod({ id: 'stock', stock_actual: 3 });
  const plazo5   = prod({ id: 'p5',  proveedor: { id: 'x', nombre: 'X', plazo_entrega_dias: 5 } } as unknown as Partial<Producto> & { id: string });
  const plazo20  = prod({ id: 'p20', proveedor: { id: 'y', nombre: 'Y', plazo_entrega_dias: 20 } } as unknown as Partial<Producto> & { id: string });
  const sinDato  = prod({ id: 'nada' });

  it('stock primero, después por plazo, y lo desconocido siempre último', () => {
    const orden = sortProductos([sinDato, plazo20, plazo5, conStock], 'entrega_rapida').map(p => p.id);
    expect(orden).toEqual(['stock', 'p5', 'p20', 'nada']);
  });

  it('un producto sin plazo nunca queda primero', () => {
    expect(sortProductos([sinDato, plazo20], 'entrega_rapida')[0].id).toBe('p20');
  });
});

describe('buildFacets', () => {
  const items = [
    prod({ id: '1', color: 'blanco', linea: { id: 'l1', nombre: 'Premium' }, ancho: 100, alto: 200,
      proveedor: { id: 'pa', nombre: 'Alumar', plazo_entrega_dias: 7 },
      atributos: { uso: 'interior', premarco_incluido: true } } as unknown as Partial<Producto> & { id: string }),
    prod({ id: '2', color: 'negro', linea: { id: 'l2', nombre: 'Estándar' }, ancho: 150, alto: 200,
      proveedor: { id: 'pb', nombre: 'Monpat', plazo_entrega_dias: null },
      atributos: { uso: 'exterior', premarco_incluido: false } } as unknown as Partial<Producto> & { id: string }),
  ];

  it('arma la faceta de proveedor y le pone el plazo al label cuando existe', () => {
    const prov = buildFacets(items).find(f => f.key === FACET_PROVEEDOR)!;
    expect(prov.options.map(o => o.label)).toEqual(['Alumar · ≈7d', 'Monpat']);
  });

  it('la faceta de proveedor necesita al menos 2 proveedores distintos', () => {
    const unoSolo = [items[0], prod({ id: '3', proveedor: items[0].proveedor } as unknown as Partial<Producto> & { id: string })];
    expect(buildFacets(unoSolo).some(f => f.key === FACET_PROVEEDOR)).toBe(false);
  });

  // "__medida" salió de buildFacets cuando la medida pasó a ser el 4º paso de la
  // búsqueda en cascada (catalogoCascada.ts) — el test seguía esperándola y estaba
  // en rojo desde entonces.
  it('arma color y línea', () => {
    const keys = buildFacets(items).map(f => f.key);
    expect(keys).toEqual(expect.arrayContaining(['color', 'linea']));
  });

  it('los booleanos de atributos se etiquetan Sí/No', () => {
    const f = buildFacets(items).find(f => f.key === 'attr:premarco_incluido')!;
    expect(f.options.map(o => o.label).sort()).toEqual(['No', 'Sí']);
  });

  it('descarta atributos con un solo valor o con más de 8', () => {
    const unico = [prod({ id: 'a', atributos: { uso: 'interior' } }), prod({ id: 'b', atributos: { uso: 'interior' } })];
    expect(buildFacets(unico).some(f => f.key === 'attr:uso')).toBe(false);

    const nueve = Array.from({ length: 9 }, (_, i) => prod({ id: `x${i}`, atributos: { uso: `v${i}` } }));
    expect(buildFacets(nueve).some(f => f.key === 'attr:uso')).toBe(false);
  });

  it('soloTransversales omite las facetas por atributo pero conserva las demás', () => {
    const keys = buildFacets(items, { soloTransversales: true }).map(f => f.key);
    expect(keys).toContain(FACET_PROVEEDOR);
    expect(keys.some(k => k.startsWith('attr:'))).toBe(false);
  });
});

describe('productoPasaFacets', () => {
  const p = prod({ id: '1', color: 'blanco', linea: { id: 'l1', nombre: 'Premium' }, ancho: 100, alto: 200,
    proveedor: { id: 'pa', nombre: 'Alumar', plazo_entrega_dias: 7 },
    atributos: { uso: 'interior', premarco_incluido: true } } as unknown as Partial<Producto> & { id: string });

  it('sin filtros activos pasa siempre', () => {
    expect(productoPasaFacets(p, {})).toBe(true);
    expect(productoPasaFacets(p, { color: [] })).toBe(true);
  });
  it('filtra por proveedor', () => {
    expect(productoPasaFacets(p, { [FACET_PROVEEDOR]: ['pa'] })).toBe(true);
    expect(productoPasaFacets(p, { [FACET_PROVEEDOR]: ['pb'] })).toBe(false);
  });
  it('filtra por color, línea y atributo booleano', () => {
    expect(productoPasaFacets(p, { color: ['blanco'] })).toBe(true);
    expect(productoPasaFacets(p, { linea: ['l1'] })).toBe(true);
    expect(productoPasaFacets(p, { linea: ['l2'] })).toBe(false);
    expect(productoPasaFacets(p, { 'attr:premarco_incluido': ['__true__'] })).toBe(true);
    expect(productoPasaFacets(p, { 'attr:premarco_incluido': ['__false__'] })).toBe(false);
  });
  it('varios filtros se combinan con AND', () => {
    expect(productoPasaFacets(p, { color: ['blanco'], linea: ['l1'] })).toBe(true);
    expect(productoPasaFacets(p, { color: ['blanco'], linea: ['l2'] })).toBe(false);
  });
});
