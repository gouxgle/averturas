import { describe, it, expect } from 'vitest';
import { parseImporte, filasDesdeTabla } from '../listaPrecios';

describe('parseImporte', () => {
  it('formato argentino y con punto decimal', () => {
    expect(parseImporte('1.234,56')).toBe(1234.56);
    expect(parseImporte('$ 12.500')).toBe(12500);
    expect(parseImporte('1234.56')).toBe(1234.56);
    expect(parseImporte(12500)).toBe(12500);
    expect(parseImporte('12,500')).toBe(12500);
  });
  it('un cero inicial es decimal, no miles ("0,125" ya no daba 125)', () => {
    expect(parseImporte('0,125')).toBe(0.125);
    expect(parseImporte('0.125')).toBe(0.125);
    expect(parseImporte('0,5')).toBe(0.5);
  });
  it('lo que no es número da null', () => {
    expect(parseImporte('abc')).toBeNull();
    expect(parseImporte('')).toBeNull();
  });
});

describe('filasDesdeTabla', () => {
  const tabla = [
    ['Código', 'Descripción', 'Cód. barras', 'Precio lista'],
    ['A1', 'Ventana', '7790001', '1.500,00'],
    ['A2', 'Puerta', '7790002', '2.000,00'],
    ['a1', 'Ventana (otra vez)', '7790003', '1.700,00'],
  ];
  it('detecta columnas por el encabezado y avisa los códigos repetidos', () => {
    const r = filasDesdeTabla(tabla);
    expect(r.conEncabezado).toBe(true);
    expect(r.filas.map(f => [f.sku, f.precio])).toEqual([['A1', 1500], ['A2', 2000], ['a1', 1700]]);
    expect(r.duplicados).toEqual(['A1']);
    expect(r.encabezados[r.detectadas.precio]).toBe('Precio lista');
  });
  it('permite elegir las columnas a mano (si detectó mal)', () => {
    const r = filasDesdeTabla(tabla, { sku: 2, precio: 3 });
    expect(r.filas[0].sku).toBe('7790001');
  });
  it('sin encabezado avisa que tomó el orden código, descripción, precio', () => {
    const r = filasDesdeTabla([['A1', 'Ventana', '1500'], ['A2', 'Puerta', '2000']]);
    expect(r.conEncabezado).toBe(false);
    expect(r.filas.length).toBe(2);
  });
});
