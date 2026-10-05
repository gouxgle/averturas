import { describe, it, expect } from 'vitest';
import { planCompletar, faltantesParaFacturar, cuitDeCliente, nombreProvisorio, type ClienteFiscal } from '../lib/fiscal/clienteArca.js';
import type { PersonaArca } from '../lib/arca/padron.js';

const cli = (o: Partial<ClienteFiscal> = {}): ClienteFiscal => ({
  id: '1', tipo_persona: 'fisica', nombre: 'Juan', apellido: 'Perez', razon_social: null, documento_nro: null, telefono: null,
  cuit: null, condicion_iva: null, domicilio_fiscal: null, direccion: null, localidad: null, codigo_postal: null, ...o,
});
const persona = (o: Partial<PersonaArca> = {}): PersonaArca => ({
  cuit: '20333333334', tipo_persona: 'fisica', nombre: 'Juan Carlos', apellido: 'Perez', razon_social: null, nombre_completo: 'Perez Juan Carlos',
  estado_clave: 'ACTIVO', domicilio: { direccion: 'San Martin 100', localidad: 'Formosa', cp: '3600', provincia: 'FORMOSA' },
  domicilio_texto: 'San Martin 100, Formosa, Formosa (CP 3600)', condicion_iva: 'responsable_inscripto', condicion_iva_id: 1,
  monotributo_categoria: null, actividad: null, avisos: [], ...o,
});

describe('completar ficha con ARCA', () => {
  it('completa lo que falta y no pisa un nombre real', () => {
    const { columnas } = planCompletar(cli(), persona());
    expect(columnas).toMatchObject({ cuit: '20333333334', condicion_iva: 'responsable_inscripto', direccion: 'San Martin 100', localidad: 'Formosa', codigo_postal: '3600', documento_nro: '33333333' });
    expect(columnas.apellido).toBeUndefined();
    expect(columnas.nombre).toBeUndefined();
  });
  it('no pisa dirección/localidad ya cargadas, pero sí la condición de IVA y el domicilio fiscal', () => {
    const { columnas } = planCompletar(cli({ condicion_iva: 'consumidor_final', direccion: 'Mitre 5', localidad: 'Clorinda', domicilio_fiscal: 'viejo' }), persona());
    expect(columnas.direccion).toBeUndefined();
    expect(columnas.localidad).toBeUndefined();
    expect(columnas.condicion_iva).toBe('responsable_inscripto');
    expect(columnas.domicilio_fiscal).toContain('San Martin 100');
  });
  it('reemplaza un nombre provisorio por el de ARCA', () => {
    const { columnas } = planCompletar(cli({ nombre: 'Contacto', apellido: null }), persona());
    expect(columnas).toMatchObject({ apellido: 'Perez', nombre: 'Juan Carlos' });
  });
  it('empresa con nombre provisorio pasa a razón social', () => {
    const { columnas } = planCompletar(cli({ nombre: 'Sin nombre', apellido: null }), persona({ cuit: '30700000008', tipo_persona: 'juridica', razon_social: 'ACME SA', apellido: null, nombre: null }));
    expect(columnas).toMatchObject({ razon_social: 'ACME SA', tipo_persona: 'juridica' });
  });
  it('si ARCA no informa impuestos no baja a consumidor final a quien ya tenía condición', () => {
    const { columnas } = planCompletar(cli({ condicion_iva: 'monotributista' }), persona({ condicion_iva: 'consumidor_final', avisos: ['sin impuestos'] }));
    expect(columnas.condicion_iva).toBeUndefined();
  });
  it('detecta qué falta y el CUIT escondido en el campo documento', () => {
    expect(faltantesParaFacturar(cli())).toEqual(['cuit', 'condicion_iva', 'domicilio']);
    expect(faltantesParaFacturar(cli({ documento_nro: '33333333', condicion_iva: 'consumidor_final', direccion: 'x' }))).toEqual([]);
    expect(cuitDeCliente(cli({ documento_nro: '20-33333333-4' }))).toBe('20333333334');
    expect(nombreProvisorio(cli({ nombre: 'Contacto Alcides', apellido: null }))).toBe(true);
  });
});
