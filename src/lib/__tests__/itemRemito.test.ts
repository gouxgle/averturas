import { describe, it, expect } from 'vitest';
import { describirItemRemito, textoItemRemito } from '../itemRemito';

describe('describirItemRemito', () => {
  it('saca el código de la descripción y antepone el tipo de abertura', () => {
    const it = { descripcion: 'MOSQ-1,50x1,00 — Mosq p/ventana de 1,50x1,00 cm', tipo_abertura_nombre: 'Mosquera', producto: { codigo: 'MOSQ-1,50x1,00' } };
    expect(describirItemRemito(it)).toEqual({ tipo: 'Mosquera', detalle: 'Mosq p/ventana de 1,50x1,00 cm', codigo: 'MOSQ-1,50x1,00' });
    expect(textoItemRemito(it)).toBe('Mosquera — Mosq p/ventana de 1,50x1,00 cm');
  });
  it('no repite el tipo si el detalle ya empieza con él', () => {
    expect(textoItemRemito({ descripcion: 'Ventana corrediza 150x110', tipo_abertura_nombre: 'Ventana' })).toBe('Ventana corrediza 150x110');
  });
  it('un ítem cargado a mano queda tal cual', () => {
    expect(describirItemRemito({ descripcion: 'Flete a obra' })).toEqual({ tipo: null, detalle: 'Flete a obra', codigo: null });
  });
  it('si la descripción es solo el código, no la deja vacía', () => {
    expect(describirItemRemito({ descripcion: 'ABC-1', producto_codigo: 'ABC-1' }).detalle).toBe('ABC-1');
  });
});
