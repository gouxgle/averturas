import { describe, it, expect } from 'vitest';
import { repartirBonificacion } from '../lib/fiscal/origenes.js';
import { calcularImportes, type ItemEntrada } from '../lib/fiscal/calculo.js';

describe('reparto de bonificaciones al facturar un presupuesto', () => {
  it('reparte solo entre productos, proporcional, y la suma cierra al centavo', () => {
    const lineas: ItemEntrada[] = [
      { descripcion: 'Ventana', cantidad: 3, precio_unitario: 33_333.33 },
      { descripcion: 'Puerta', cantidad: 1, precio_unitario: 150_000 },
      { descripcion: 'Instalación', cantidad: 4, precio_unitario: 20_000, es_servicio: true },
    ];
    repartirBonificacion(lineas, 12_345.67);
    const bonif = lineas.map(l => l.bonificacion ?? 0);
    expect(bonif[2]).toBe(0);                               // la instalación no se bonifica
    expect(Math.round((bonif[0] + bonif[1]) * 100)).toBe(1_234_567);
    expect(bonif[0]).toBeCloseTo(12_345.67 * 99_999.99 / 249_999.99, 1);
    const im = calcularImportes(lineas);
    expect(im.imp_total).toBeCloseTo(99_999.99 + 150_000 + 80_000 - 12_345.67, 2);
  });

  it('sin bonificación no toca nada', () => {
    const lineas: ItemEntrada[] = [{ descripcion: 'x', cantidad: 1, precio_unitario: 100 }];
    repartirBonificacion(lineas, 0);
    expect(lineas[0].bonificacion).toBeUndefined();
  });
});
