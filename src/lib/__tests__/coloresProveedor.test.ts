import { describe, it, expect } from 'vitest';
import {
  colorProveedor,
  COLORES_PROVEEDOR,
  CLAVES_COLOR_PROVEEDOR,
} from '../coloresProveedor';

describe('colorProveedor', () => {
  it('devuelve null si no hay proveedor', () => {
    expect(colorProveedor(null)).toBeNull();
    expect(colorProveedor(undefined)).toBeNull();
  });

  it('respeta el color elegido a mano', () => {
    const c = colorProveedor({ id: 'abc-123', color: 'rosa' });
    expect(c?.key).toBe('rosa');
  });

  it('es determinístico: el mismo id siempre da el mismo color', () => {
    const id = 'd4f1c2a8-1111-2222-3333-444455556666';
    const primero = colorProveedor({ id });
    for (let i = 0; i < 20; i++) {
      expect(colorProveedor({ id })?.key).toBe(primero?.key);
    }
  });

  it('el color derivado no depende del nombre (renombrar no cambia el color)', () => {
    const id = 'abc-123';
    const antes = colorProveedor({ id, nombre: 'Alumar SRL' });
    const despues = colorProveedor({ id, nombre: 'Alumar S.R.L. — Formosa' });
    expect(despues?.key).toBe(antes?.key);
  });

  it('ignora un color inválido y cae al derivado', () => {
    const id = 'abc-123';
    const conBasura = colorProveedor({ id, color: 'no-existe-este-color' });
    const derivado = colorProveedor({ id });
    expect(conBasura?.key).toBe(derivado?.key);
    expect(CLAVES_COLOR_PROVEEDOR).toContain(conBasura!.key);
  });

  it('siempre devuelve una entrada real de la paleta', () => {
    // ids variados: cubre que el módulo del hash nunca se vaya de rango
    for (let i = 0; i < 200; i++) {
      const c = colorProveedor({ id: `proveedor-${i}` });
      expect(COLORES_PROVEEDOR).toContainEqual(c);
    }
  });
});

describe('paleta', () => {
  it('no tiene claves repetidas', () => {
    expect(new Set(CLAVES_COLOR_PROVEEDOR).size).toBe(COLORES_PROVEEDOR.length);
  });

  it('todas las entradas tienen hex válido y clases de badge', () => {
    for (const c of COLORES_PROVEEDOR) {
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.badge).toMatch(/bg-\S+ text-\S+ border-\S+/);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  // La franja sólida lleva texto blanco encima: si alguna entrada usa un tono
  // claro, el nombre del proveedor queda ilegible sobre la banda.
  it('la variante sólida usa tono -700 con texto blanco en toda la paleta', () => {
    for (const c of COLORES_PROVEEDOR) {
      expect(c.solid).toMatch(/^bg-[a-z]+-700 text-white$/);
    }
  });

  it('no hay dos colores con la misma clase sólida', () => {
    const solids = COLORES_PROVEEDOR.map(c => c.solid);
    expect(new Set(solids).size).toBe(solids.length);
  });
});
