import { describe, it, expect } from 'vitest';
import { quincenaDe, siguienteQuincena } from '../lib/fiscal/contingencia.js';

describe('quincenas del CAEA', () => {
  it('primera y segunda quincena, con fin de mes real', () => {
    expect(quincenaDe('2026-10-01')).toEqual({ periodo: 202610, orden: 1, desde: '2026-10-01', hasta: '2026-10-15' });
    expect(quincenaDe('2026-10-16')).toEqual({ periodo: 202610, orden: 2, desde: '2026-10-16', hasta: '2026-10-31' });
    expect(quincenaDe('2028-02-20').hasta).toBe('2028-02-29');   // bisiesto
  });
  it('la siguiente cruza de mes y de año', () => {
    expect(siguienteQuincena(quincenaDe('2026-10-03'))).toMatchObject({ periodo: 202610, orden: 2 });
    expect(siguienteQuincena(quincenaDe('2026-12-20'))).toMatchObject({ periodo: 202701, orden: 1, desde: '2027-01-01' });
  });
});
