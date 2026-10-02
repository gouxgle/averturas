import { describe, it, expect } from 'vitest';
import { parseImporte, filasDesdeTabla, tablaDesdeCsv } from '../listaPrecios';

describe('importes de listas de proveedores', () => {
  it('formato argentino y con punto decimal', () => {
    expect(parseImporte('1.234,56')).toBe(1234.56);
    expect(parseImporte('$ 12.500')).toBe(12500);
    expect(parseImporte('12500,5')).toBe(12500.5);
    expect(parseImporte('1,234.56')).toBe(1234.56);
    expect(parseImporte('1234.56')).toBe(1234.56);
    expect(parseImporte('1.234.567')).toBe(1234567);
    expect(parseImporte(98765.4)).toBe(98765.4);
    expect(parseImporte('consultar')).toBeNull();
  });
});

describe('lectura de la planilla', () => {
  it('detecta las columnas por el encabezado, aunque estén en otro orden', () => {
    const t = tablaDesdeCsv('Lista Septiembre\nDescripción;Código;Precio lista\nVentana 150x110;V-150;"1.234.500,00"\nPuerta;P-80;98.000\n;;\nSin precio;X-1;consultar');
    const r = filasDesdeTabla(t);
    expect(r.filas).toEqual([
      { sku: 'V-150', descripcion: 'Ventana 150x110', precio: 1234500 },
      { sku: 'P-80', descripcion: 'Puerta', precio: 98000 },
    ]);
    expect(r.descartadas).toBe(1);
  });
  it('sin encabezado: código, descripción y precio', () => {
    const r = filasDesdeTabla(tablaDesdeCsv('A1,Ventana chica,1500.50\nA2,"Puerta, doble",2000'));
    expect(r.filas).toEqual([
      { sku: 'A1', descripcion: 'Ventana chica', precio: 1500.5 },
      { sku: 'A2', descripcion: 'Puerta, doble', precio: 2000 },
    ]);
  });
  it('desde Excel llegan números', () => {
    const r = filasDesdeTabla([['SKU', 'Descripcion', 'Precio'], ['A1', 'Ventana', 1500.5], ['A2', 'Puerta', 2000]]);
    expect(r.filas.map(f => f.precio)).toEqual([1500.5, 2000]);
  });
});
