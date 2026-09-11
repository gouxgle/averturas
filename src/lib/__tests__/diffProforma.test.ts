import { describe, it, expect } from 'vitest';
import { diffProforma, type DiffSnapshot, type DiffSnapshotItem } from '../diffProforma';

function baseItem(over: Partial<DiffSnapshotItem> = {}): DiffSnapshotItem {
  return {
    id: 'item-1', orden: 0, descripcion: 'Ventana 2 hojas', cantidad: 1,
    precio_unitario: 100000, precio_lista: null, precio_instalacion: 0,
    incluye_instalacion: false, medida_ancho: 1.2, medida_alto: 1,
    color: 'Blanco', vidrio: 'DVH', premarco: false, accesorios: [],
    notas: null, tipo_item: 'estandar',
    tipo_abertura_id: 'ta-1', sistema_id: 'si-1', producto_id: 'prod-1', servicio_id: null,
    tipo_abertura_nombre: 'Ventana', sistema_nombre: 'Herrero', producto_nombre: 'Ventana Herrero',
    ...over,
  };
}

function baseSnapshot(items: DiffSnapshotItem[], over: Partial<DiffSnapshot> = {}): DiffSnapshot {
  return {
    forma_pago: 'Contado', forma_envio: 'retiro_local', costo_envio: 0,
    tiempo_entrega: 20, fecha_validez: '2026-09-30', notas: null,
    precio_total: items.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0),
    items, formas_pago_alternativas: [],
    ...over,
  };
}

describe('diffProforma', () => {
  it('detecta un cambio de cantidad manteniendo el mismo id de ítem', () => {
    const a = baseSnapshot([baseItem({ id: 'item-1', cantidad: 2, precio_total: 200000 })]);
    const b = baseSnapshot([baseItem({ id: 'item-1', cantidad: 3, precio_total: 300000 })]);
    const d = diffProforma(a, b);
    expect(d.items).toHaveLength(1);
    expect(d.items[0].estado).toBe('modificado');
    const cambio = d.items[0].cambios.find(c => c.campo === 'Cantidad');
    expect(cambio).toBeDefined();
    expect(cambio?.antes).toBe(2);
    expect(cambio?.despues).toBe(3);
    expect(d.resumen).toEqual({ agregados: 0, quitados: 0, modificados: 1, iguales: 0 });
  });

  it('matchea por clave fuerte cuando el PUT cambió los ids de operacion_items', () => {
    // Simula lo que pasa en un PUT real: DELETE+INSERT deja ids nuevos, pero el
    // mismo producto/medidas/color deberían seguir matcheando como "el mismo ítem".
    const a = baseSnapshot([baseItem({ id: 'old-1', cantidad: 1 })]);
    const b = baseSnapshot([baseItem({ id: 'new-1', cantidad: 2, precio_total: 200000 })]);
    const d = diffProforma(a, b);
    expect(d.items).toHaveLength(1);
    expect(d.items[0].estado).toBe('modificado');
    expect(d.items[0].antes?.id).toBe('old-1');
    expect(d.items[0].despues?.id).toBe('new-1');
    expect(d.items[0].cambios.some(c => c.campo === 'Cantidad')).toBe(true);
  });

  it('matchea por score cuando cambian medidas y color a la vez (mismo producto)', () => {
    const a = baseSnapshot([baseItem({ id: 'old-2', medida_ancho: 1.2, medida_alto: 1, color: 'Blanco' })]);
    const b = baseSnapshot([baseItem({ id: 'new-2', medida_ancho: 1.5, medida_alto: 1.2, color: 'Negro' })]);
    const d = diffProforma(a, b);
    expect(d.items).toHaveLength(1);
    expect(d.items[0].estado).toBe('modificado');
    const campos = d.items[0].cambios.map(c => c.campo);
    expect(campos).toEqual(expect.arrayContaining(['Ancho', 'Alto', 'Color']));
  });

  it('marca ítems agregados y quitados cuando no hay ninguna coincidencia posible', () => {
    const a = baseSnapshot([baseItem({ id: 'a-1', producto_id: 'prod-A', tipo_abertura_id: 'ta-A', sistema_id: 'si-A' })]);
    const b = baseSnapshot([baseItem({ id: 'b-1', producto_id: 'prod-B', tipo_abertura_id: 'ta-B', sistema_id: 'si-B', descripcion: 'Puerta corrediza' })]);
    const d = diffProforma(a, b);
    expect(d.items).toHaveLength(2);
    expect(d.items.find(f => f.estado === 'agregado')?.despues?.id).toBe('b-1');
    expect(d.items.find(f => f.estado === 'quitado')?.antes?.id).toBe('a-1');
  });

  it('detecta cambios de header (ej. extender validez) y calcula el delta de total', () => {
    const a = baseSnapshot([baseItem()], { fecha_validez: '2026-09-30', precio_total: 100000 });
    const b = baseSnapshot([baseItem()], { fecha_validez: '2026-10-15', precio_total: 110000 });
    const d = diffProforma(a, b);
    expect(d.header).toEqual([{ campo: 'Válido hasta', antes: '2026-09-30', despues: '2026-10-15' }]);
    expect(d.total).toEqual({ antes: 100000, despues: 110000, delta: 10000, delta_pct: 10 });
  });
});
