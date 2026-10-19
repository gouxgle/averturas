import { describe, it, expect } from 'vitest';
import { calcularBonificacion, baseBonificable, rotuloBonificacion } from '../bonificacion';

// Mismos casos que server/src/__tests__/bonificacionPresupuesto.db.test.ts: la copia del
// navegador es solo vista previa y tiene que dar lo mismo que el servidor (si cambia una, cambiar la otra).
describe('bonificación (paridad con el servidor)', () => {
  it('porcentaje sobre productos, redondeado a centavos', () => {
    expect(calcularBonificacion(100000, 'porcentaje', 10)).toBe(10000);
    expect(calcularBonificacion(33333.33, 'porcentaje', 7)).toBe(2333.33);
  });
  it('monto fijo sin pasar de la base; sin tipo o valor no bonifica', () => {
    expect(calcularBonificacion(100000, 'monto', 25000)).toBe(25000);
    expect(calcularBonificacion(20000, 'monto', 25000)).toBe(20000);
    expect(calcularBonificacion(100000, null, 10)).toBe(0);
    expect(calcularBonificacion(100000, 'porcentaje', 0)).toBe(0);
  });
  it('la base son solo productos', () => {
    expect(baseBonificable([{ precio_unitario: 1000, cantidad: 2 }, { precio_unitario: '500', cantidad: '1' }])).toBe(2500);
  });
  it('rótulos', () => {
    expect(rotuloBonificacion('porcentaje', 10)).toBe('10%');
    expect(rotuloBonificacion('monto', 50000)).toContain('50.000');
    expect(rotuloBonificacion(null, 10)).toBe('');
  });
});
