import { describe, it, expect } from 'vitest';
import { validezPrecio } from '../validezPrecio';
import { fechaDiaAR } from '../utils';

// Fecha de hace N días calendario (horario Argentina) a mediodía, para no caer en bordes de huso.
function haceDias(n: number): string {
  const d = new Date(fechaDiaAR(new Date()) + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
const cfg = { dias_al_dia: 7, dias_vencido: 10 };

describe('validezPrecio', () => {
  it('verde hasta dias_al_dia, amarillo hasta dias_vencido, rojo después', () => {
    expect(validezPrecio(haceDias(0), cfg).estado).toBe('al_dia');
    expect(validezPrecio(haceDias(7), cfg).estado).toBe('al_dia');
    expect(validezPrecio(haceDias(8), cfg).estado).toBe('por_vencer');
    expect(validezPrecio(haceDias(10), cfg).estado).toBe('por_vencer');
    expect(validezPrecio(haceDias(11), cfg).estado).toBe('vencido');
  });
  it('usa los días configurados', () => {
    expect(validezPrecio(haceDias(15), { dias_al_dia: 20, dias_vencido: 30 }).estado).toBe('al_dia');
  });
  it('sin fecha cuenta como vencido', () => {
    expect(validezPrecio(null, cfg)).toEqual({ estado: 'vencido', dias: null, venceEl: null });
  });
  it('el período nuevo arranca el día de la actualización', () => {
    const hoy = fechaDiaAR(new Date());
    const v = validezPrecio(new Date().toISOString(), cfg);
    const esperado = new Date(hoy + 'T12:00:00'); esperado.setDate(esperado.getDate() + 7);
    expect(v.venceEl).toBe(fechaDiaAR(esperado));
  });
});
