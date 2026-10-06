import { describe, it, expect } from 'vitest';
import { precioPorFormula, redondearTerminacion, elegirFormula, clasificarContraFormula, type Formula } from '../formulaPrecio';

const F: Formula = { id: 'g', nombre: 'Estándar', divisor: 0.6, recargo_pct: 15, adicional_costo_pct: 12, redondeo_paso: 1000, redondeo_terminacion: 900, tipo_abertura_id: null, proveedor_id: null, activa: true };

describe('fórmula de precio en pantalla (igual al servidor)', () => {
  it('100.000 → 203.900', () => expect(precioPorFormula(100_000, F).precio).toBe(203_900));
  it('redondeo terminado en 900', () => {
    expect(redondearTerminacion(203_900, 1000, 900)).toBe(203_900);
    expect(redondearTerminacion(203_950, 1000, 900)).toBe(204_900);
  });
  it('cambiar los números cambia el precio (10 % en vez de 12 %)', () => {
    expect(precioPorFormula(100_000, { ...F, adicional_costo_pct: 10 }).precio).toBe(201_900);
  });
  it('excepción por familia', () => {
    const fam = { ...F, id: 'f', tipo_abertura_id: 'x', divisor: 0.65 };
    expect(elegirFormula([F, fam], { tipo: 'estandar', tipo_abertura_id: 'x', proveedor_id: null })?.id).toBe('f');
    expect(elegirFormula([F, fam], { tipo: 'a_medida_proveedor', tipo_abertura_id: 'x', proveedor_id: null })).toBeNull();
  });
  it('clasificación', () => {
    const c = (precio: number, costo = 100_000, extra = {}) => clasificarContraFormula({ precio, costo, precio_manual: false, formula: true, ...extra }, 203_900, 3);
    expect(c(191_700)).toBe('debajo');
    expect(c(201_700)).toBe('en');
    expect(c(380_000)).toBe('encima');
    expect(c(354_600, 175.8)).toBe('error');
    expect(c(191_700, 100_000, { precio_manual: true })).toBe('excluido');
    expect(c(191_700, 100_000, { formula: false })).toBe('excluido');
  });
});
