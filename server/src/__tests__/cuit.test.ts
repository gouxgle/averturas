import { describe, it, expect } from 'vitest';
import { cuitValido, formatearCuit, normalizarCuit } from '../lib/fiscal/cuit.js';

describe('CUIT', () => {
  it('acepta CUITs con dígito verificador correcto, con o sin guiones', () => {
    expect(cuitValido('20-11111111-2')).toBe(true);
    expect(cuitValido('30714522538')).toBe(true);       // persona jurídica
    expect(cuitValido('23-25889760-9')).toBe(true);     // el CUIT de la empresa
  });
  it('rechaza dígito verificador, largo o prefijo incorrectos', () => {
    expect(cuitValido('20111111113')).toBe(false);
    expect(cuitValido('2011111111')).toBe(false);
    expect(cuitValido('99111111112')).toBe(false);
    expect(cuitValido('')).toBe(false);
    expect(cuitValido(null)).toBe(false);
  });
  it('normaliza y formatea', () => {
    expect(normalizarCuit('23-25889760-9')).toBe('23258897609');
    expect(formatearCuit('23258897609')).toBe('23-25889760-9');
  });
});
