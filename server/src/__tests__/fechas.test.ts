import { describe, it, expect } from 'vitest';
import { hoyAR, mesAR } from '../lib/fechas.js';

describe('fechas en horario Argentina', () => {
  it('a las 22 h del 30/09 en Argentina sigue siendo 30/09 (en UTC ya es 01/10)', () => {
    const d = new Date('2026-10-01T01:00:00Z');
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(hoyAR(d)).toBe('2026-09-30');
    expect(mesAR(d)).toBe('202609');
  });

  it('a la medianoche argentina ya cambia el día', () => {
    const d = new Date('2026-10-01T03:00:00Z');
    expect(hoyAR(d)).toBe('2026-10-01');
    expect(mesAR(d)).toBe('202610');
  });
});
