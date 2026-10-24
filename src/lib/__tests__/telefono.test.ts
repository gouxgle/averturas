import { describe, it, expect } from 'vitest';
import { esTelefonoExterior, partirExterior, armarExterior, validarExterior, numeroWhatsapp, mostrarTelefono } from '../telefono';

describe('teléfonos del exterior', () => {
  it('reconoce el número de Paraguay en sus distintas formas', () => {
    expect(esTelefonoExterior('+595 972 454770')).toBe(true);
    expect(esTelefonoExterior('+595972454770')).toBe(true);
    expect(esTelefonoExterior('00595 972454770')).toBe(true);
    expect(partirExterior('+595 972 454770')).toEqual({ codigo: '595', numero: '972454770' });
    expect(partirExterior('+595972454770')).toEqual({ codigo: '595', numero: '972454770' });
  });
  it('los argentinos no son del exterior (con o sin +54)', () => {
    expect(esTelefonoExterior('3704 322616')).toBe(false);
    expect(esTelefonoExterior('+5493704322616')).toBe(false);
    expect(esTelefonoExterior('')).toBe(false);
  });
  it('arma, valida y muestra', () => {
    expect(armarExterior('595', '972 454 770')).toBe('+595 972454770');
    expect(validarExterior('595', '972454770')).toBeNull();
    expect(validarExterior('54', '3704322616')).toMatch(/Argentina/);
    expect(validarExterior('595', '123')).toMatch(/corto/);
    expect(validarExterior('', '972454770')).toMatch(/código de país/);
    expect(mostrarTelefono('+595 972454770')).toBe('+595 972 454 770');
    expect(mostrarTelefono('3704 322616')).toBe('3704 322616');
  });
  it('WhatsApp: el del exterior va tal cual; el argentino lleva 549 (antes al paraguayo se le agregaba 549)', () => {
    expect(numeroWhatsapp('+595 972454770')).toBe('595972454770');
    expect(numeroWhatsapp('3704 322616')).toBe('5493704322616');
    expect(numeroWhatsapp('+54 9 3704 322616')).toBe('5493704322616');
    expect(numeroWhatsapp('03704322616')).toBe('5493704322616');
  });
});
