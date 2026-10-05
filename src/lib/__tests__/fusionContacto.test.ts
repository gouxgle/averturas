import { describe, it, expect } from 'vitest';
import {
  esNombreProvisorio, partirTelefono, ultimos10, construirFusion, aplicarFusion, type ContactoExistente,
} from '../fusionContacto';

const existente = (o: Partial<ContactoExistente> = {}): ContactoExistente => ({
  apellido: 'Alcides', nombre: 'Contacto', razon_social: null, telefono: '+5493624266648', tipo_persona: 'fisica',
  email: null, localidad: null, direccion: null, notas: null, documento_nro: null, ...o,
});

describe('nombre provisorio', () => {
  it('detecta los nombres que dejó la agenda importada', () => {
    expect(esNombreProvisorio('Alcides', 'Contacto')).toBe(true);
    expect(esNombreProvisorio(null, 'Contacto')).toBe(true);
    expect(esNombreProvisorio('Patricia', '10')).toBe(true);
    expect(esNombreProvisorio('', 'Sin nombre')).toBe(true);
    expect(esNombreProvisorio('Cliente', 'Nuevo')).toBe(true);
    expect(esNombreProvisorio(null, '3624266648', null, '+5493624266648')).toBe(true);
    expect(esNombreProvisorio('', '')).toBe(true);
  });
  it('no confunde un nombre real', () => {
    expect(esNombreProvisorio('Gómez', 'Alcides')).toBe(false);
    expect(esNombreProvisorio('Ruiz Diaz', 'Ana Liz')).toBe(false);
    expect(esNombreProvisorio(null, null, 'García Construcciones SRL')).toBe(false);
  });
});

describe('teléfono', () => {
  it('compara por los últimos 10 dígitos', () => {
    expect(ultimos10('+54 9 3704 12-3456')).toBe('3704123456');
    expect(ultimos10('3704 123456')).toBe('3704123456');
    expect(ultimos10(null)).toBe('');
  });
  it('parte el número de la agenda sin recortarlo', () => {
    expect(partirTelefono('+5493624266648')).toEqual({ prefijo: '3624', numero: '266648' });
    expect(partirTelefono('5493704322616')).toEqual({ prefijo: '3704', numero: '322616' });
    expect(partirTelefono('+5491122334455')).toEqual({ prefijo: '11', numero: '22334455' });
    expect(partirTelefono('03704322616')).toEqual({ prefijo: '3704', numero: '322616' });
    expect(partirTelefono('3704 322616')).toEqual({ prefijo: '3704', numero: '322616' });
    expect(partirTelefono('')).toEqual({ prefijo: '', numero: '' });
  });
  it('un número que no cierra en 10 dígitos no pierde dígitos', () => {
    const p = partirTelefono('+5494521446');
    expect(p.prefijo + p.numero).toBe('4521446');
  });
});

describe('completar un contacto existente', () => {
  it('reemplaza el nombre provisorio y completa solo lo que faltaba', () => {
    const filas = construirFusion(existente({ email: 'viejo@mail.com' }),
      { email: 'otro@mail.com', localidad: 'Formosa', documento_nro: '' }, 'Gómez, Alcides');
    const r = aplicarFusion(filas);
    expect(r.nombreCompleto).toBe('Gómez, Alcides');
    expect(r.resumen.nombreAnterior).toBe('Alcides, Contacto');
    expect(r.valores).toEqual({ localidad: 'Formosa' });                // el mail ya estaba: no se pisa
    expect(r.resumen.completados).toEqual(['Localidad']);
    expect(r.resumen.mantenidos).toEqual(['Email']);
    expect(filas.find(f => f.campo === 'email')).toMatchObject({ resolucion: 'conflicto', usar: 'existente' });
  });

  it('un nombre real distinto no se pisa solo', () => {
    const filas = construirFusion(existente({ apellido: 'Pérez', nombre: 'Juan' }), {}, 'Gómez, Alcides');
    expect(filas[0]).toMatchObject({ campo: 'nombre', resolucion: 'conflicto', usar: 'existente' });
    expect(aplicarFusion(filas).nombreCompleto).toBeUndefined();
    // …pero el operador puede elegir el nuevo
    filas[0].usar = 'nuevo';
    expect(aplicarFusion(filas).nombreCompleto).toBe('Gómez, Alcides');
  });

  it('el mismo nombre escrito en otro orden no es un conflicto', () => {
    const filas = construirFusion(existente({ apellido: 'Gómez', nombre: 'Alcides' }), {}, 'Alcides Gomez');
    expect(filas[0].resolucion).toBe('igual');
  });

  it('las observaciones se juntan', () => {
    const filas = construirFusion(existente({ notas: 'Pidió presupuesto de ventanas' }), { notas: 'Vive en Clorinda' }, '');
    const r = aplicarFusion(filas);
    expect(r.valores.notas).toBe('Pidió presupuesto de ventanas\nVive en Clorinda');
  });

  it('lo que el operador dejó vacío no borra nada', () => {
    const filas = construirFusion(existente({ email: 'a@b.com', localidad: 'Fsa' }), { email: '', localidad: '' }, '');
    expect(filas).toEqual([]);
    expect(aplicarFusion(filas).valores).toEqual({});
  });

  it('empresa: completa la razón social si faltaba', () => {
    const filas = construirFusion(existente({ tipo_persona: 'juridica', apellido: null, nombre: 'Contacto', razon_social: null }), {}, 'García SRL');
    expect(filas[0]).toMatchObject({ etiqueta: 'Razón social', resolucion: 'completa', usar: 'nuevo' });
  });
});
