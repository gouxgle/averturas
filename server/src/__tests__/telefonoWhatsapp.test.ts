import { describe, it, expect } from 'vitest';
import { normalizarNumeroAR } from '../lib/whatsapp.js';

// Misma tabla que src/lib/__tests__/telefono.test.ts (numeroWhatsapp del frontend).
describe('normalizarNumeroAR', () => {
  it('argentino: agrega 549', () => {
    expect(normalizarNumeroAR('3704 322616')).toBe('5493704322616');
    expect(normalizarNumeroAR('+54 9 3704 322616')).toBe('5493704322616');
    expect(normalizarNumeroAR('03704322616')).toBe('5493704322616');
  });
  it('del exterior (+código de país): va tal cual (antes al paraguayo se le agregaba 549)', () => {
    expect(normalizarNumeroAR('+595 972 454770')).toBe('595972454770');
    expect(normalizarNumeroAR('00595972454770')).toBe('595972454770');
    expect(normalizarNumeroAR('+55 11 98765 4321')).toBe('5511987654321');
  });
});
