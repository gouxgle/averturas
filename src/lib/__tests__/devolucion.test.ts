import { describe, it, expect } from 'vitest';
import { calcularResultado } from '../devolucion';

const op = (saldo: number, descuentos = 0, precio_total = 100000) =>
  ({ id: 'x', numero: 'OP-1', precio_total, cobrado: 0, descuentos, devuelto_a_saldo: 0, saldo });

// Mismos casos que server/src/__tests__/devoluciones.db.test.ts: si divergen, la vista previa miente.
describe('calcularResultado (vista previa = cuenta del servidor)', () => {
  it('A: debía 40.000 y devuelve 50.000 → 10.000 a favor, saldo 0', () => {
    expect(calcularResultado(op(40000), [{ cantidad: 1, precio_bruto: 50000 }]))
      .toEqual({ valor_total: 50000, aplicado_a_saldo: 40000, excedente: 10000, saldo_final: 0 });
  });
  it('B: la bonificación no se devuelve (45.000, no 50.000)', () => {
    expect(calcularResultado(op(0, 10000), [{ cantidad: 1, precio_bruto: 50000 }]))
      .toEqual({ valor_total: 45000, aplicado_a_saldo: 0, excedente: 45000, saldo_final: 0 });
  });
  it('C: debía mucho más → solo baja la deuda y sigue debiendo 50.000', () => {
    expect(calcularResultado(op(80000), [{ cantidad: 1, precio_bruto: 30000 }]))
      .toEqual({ valor_total: 30000, aplicado_a_saldo: 30000, excedente: 0, saldo_final: 50000 });
  });
  it('sin operación todo es a favor y no hay saldo final', () => {
    expect(calcularResultado(null, [{ cantidad: 3, precio_bruto: 1000 }]))
      .toEqual({ valor_total: 3000, aplicado_a_saldo: 0, excedente: 3000, saldo_final: null });
  });
  it('redondea el medio centavo hacia arriba (10,05 con 50 % → 5,03)', () => {
    expect(calcularResultado(op(0, 50, 100), [{ cantidad: 3, precio_bruto: 10.05 }]).valor_total).toBe(15.09);
  });
});
