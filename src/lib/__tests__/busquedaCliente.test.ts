import { describe, it, expect } from 'vitest';
import { coincideBusqueda } from '../busquedaCliente';

const hugo = { apellido: 'Lescano', nombre: 'Hugo Alberto', telefono: '+5493704592000', localidad: 'Formosa', email: null };

describe('coincideBusqueda', () => {
  it.each(['lescano hugo', 'Lescano, Hugo', 'hugo lescano', 'lescano,hugo', 'LESCANO', 'hug lesc', 'formosa hugo'])('encuentra con "%s"', q => {
    expect(coincideBusqueda(hugo, q)).toBe(true);
  });
  it('ignora tildes', () => expect(coincideBusqueda({ apellido: 'Núñez', nombre: 'José' }, 'jose nunez')).toBe(true));
  it('encuentra por teléfono en otro formato', () => {
    expect(coincideBusqueda(hugo, '3704-592000')).toBe(true);
    expect(coincideBusqueda(hugo, 'hugo 3704592000')).toBe(true);
  });
  it('exige todas las palabras', () => expect(coincideBusqueda(hugo, 'lescano pedro')).toBe(false));
  it('vacío no filtra', () => expect(coincideBusqueda(hugo, '  ')).toBe(true));
});
