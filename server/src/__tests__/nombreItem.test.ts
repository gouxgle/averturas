import { describe, it, expect } from 'vitest';
import { nombreItem } from '../lib/nombreItem.js';

describe('nombreItem (factura desde remito/presupuesto)', () => {
  it('saca el código y antepone el tipo de abertura', () => {
    expect(nombreItem('MOSQ-1,50x1,00 — Mosq p/ventana de 1,50x1,00 cm', 'MOSQ-1,50x1,00', 'Mosquera'))
      .toBe('Mosquera — Mosq p/ventana de 1,50x1,00 cm');
  });
  it('no repite el tipo ni toca un ítem cargado a mano', () => {
    expect(nombreItem('Ventana corrediza 150x110', null, 'Ventana')).toBe('Ventana corrediza 150x110');
    expect(nombreItem('Flete a obra')).toBe('Flete a obra');
  });
});
