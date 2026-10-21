import { describe, it, expect } from 'vitest';
import { armarHoja, leerPlanilla, nombreCompleto, COL_ID, COL_NUEVO, type DatosPlanilla } from '../planillaPrecios';

const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const datos: DatosPlanilla = {
  proveedor: { id: 'p', nombre: 'Alumar' },
  filas: [
    { id: ID1, codigo: 'V-1', sku: 'A-100', nombre: 'Ventana corrediza', descripcion: '120x100 blanca', familia: 'Ventanas', activo: true, lista_actual: 1000, venta_actual: 1500 },
    { id: ID2, codigo: null, sku: null, nombre: 'Puerta 80', descripcion: 'puerta 80', familia: 'Puertas', activo: true, lista_actual: 2000, venta_actual: 3000 },
  ],
};

describe('planilla de precios por proveedor', () => {
  it('nombre – descripción, sin repetir cuando la descripción ya está en el nombre', () => {
    expect(nombreCompleto(datos.filas[0])).toBe('Ventana corrediza – 120x100 blanca');
    expect(nombreCompleto(datos.filas[1])).toBe('Puerta 80');
  });

  it('la hoja tiene las 7 columnas y la última (nuevo precio) va vacía', () => {
    const hoja = armarHoja(datos, '2026-10-21');
    const cab = hoja[3] as { value: string }[];
    expect(cab.map(c => c.value)).toEqual([COL_ID, 'Código', 'Código proveedor', 'Producto', 'Precio de lista actual (costo)', 'Precio de venta actual', COL_NUEVO]);
    const fila = hoja[4] as ({ value: unknown } | null)[];
    expect(fila[0]?.value).toBe(ID1);
    expect(fila[6]?.value).toBeNull();
    expect(hoja.length).toBe(4 + datos.filas.length);
  });

  it('leer: toma el nuevo precio por ID, ignora las filas vacías y avisa las inválidas', () => {
    const hoja = armarHoja(datos, '2026-10-21').map(r => r.map(c => (c && typeof c === 'object' ? (c as { value: unknown }).value : c)));
    hoja[4][6] = '1.250,50';          // se completó
    // la 2ª queda vacía
    const r = leerPlanilla(hoja)!;
    expect(r.items).toEqual([{ producto_id: ID1, precio: 1250.5 }]);
    expect(r.vacias).toBe(1);
    expect(r.invalidas).toBe(0);
    expect(r.filas).toBe(2);
  });

  it('leer: texto o valores no válidos cuentan como inválidos, un ID roto también', () => {
    const t = [[COL_ID, 'Producto', COL_NUEVO], [ID1, 'a', 'consultar'], ['no-es-uuid', 'b', '100'], [ID2, 'c', 0]];
    const r = leerPlanilla(t)!;
    expect(r.items).toEqual([]);
    expect(r.invalidas).toBe(3);
  });

  it('un archivo común (código y precio) no es una planilla del sistema', () => {
    expect(leerPlanilla([['Código', 'Descripción', 'Precio'], ['A1', 'Ventana', 1500]])).toBeNull();
  });
});
