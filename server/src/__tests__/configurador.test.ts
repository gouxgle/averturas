import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  camposVisibles, normalizarFicha, tipologiasDe, herrajesDe, faltantesFicha, detalleFicha, sectoresDe, desdeFichaVieja, descripcionSugerida,
} from '../lib/configuradorAbertura.js';
import { SolicitudCompraSchema } from '../lib/schemas.js';
import { esquemaAberturaSVG } from '../lib/esquemaAbertura.js';

// Configurador de aberturas a medida (Compras) + esquema SVG. Las copias del navegador y del servidor
// deben ser idénticas: si este test falla, copiar el archivo que se cambió sobre el otro.

describe('configurador-espejo', () => {
  for (const archivo of ['configuradorAbertura.ts', 'esquemaAbertura.ts']) {
    it(`${archivo}: front y back son iguales`, () => {
      const back = readFileSync(fileURLToPath(new URL(`../lib/${archivo}`, import.meta.url)), 'utf8');
      const front = readFileSync(fileURLToPath(new URL(`../../../src/lib/${archivo}`, import.meta.url)), 'utf8');
      expect(front).toBe(back);
    });
  }
});

describe('configurador de aberturas', () => {
  it('cada tipo ofrece solo sus tipologías', () => {
    expect(tipologiasDe('pano_fijo').map(t => t.v)).toEqual(['fijo', 'otro']);
    expect(tipologiasDe('puerta').map(t => t.v)).toContain('de_abrir');
    expect(tipologiasDe('puerta').map(t => t.v)).not.toContain('banderola');
  });

  it('puerta de abrir: sentido, composición, herrajes de puerta; corrediza: hojas sin sentido', () => {
    const puerta = camposVisibles({ tipo_abertura: 'puerta', tipologia: 'de_abrir' });
    expect([...puerta]).toEqual(expect.arrayContaining(['sentido', 'composicion', 'herrajes', 'hojas']));
    expect(herrajesDe('puerta', 'de_abrir').map(h => h.v)).toEqual(expect.arrayContaining(['barral', 'picaporte', 'medio_picaporte']));
    const corrediza = camposVisibles({ tipo_abertura: 'ventana', tipologia: 'corrediza' });
    expect(corrediza.has('sentido')).toBe(false);
    expect(corrediza.has('hojas')).toBe(true);
    expect(camposVisibles({ tipo_abertura: 'mosquitero', tipologia: 'fijo' }).has('vidrio')).toBe(false);
    expect(camposVisibles({ tipo_abertura: 'puerta' }).size).toBe(0);
  });

  it('normalizar borra lo que dejó de aplicar y deriva las claves viejas', () => {
    const f = normalizarFicha({
      tipo_abertura: 'ventana', tipologia: 'corrediza', ancho_m: 1.5, alto_m: 1.1, hojas: 2,
      sentido: 'izquierda', abre_hacia: 'adentro',                      // no aplica a corrediza
      composicion: 'vidriado', vidrio_tipo: 'DVH', vidrio_espesor: 'dvh_4_9_4', vidrio_color: 'incoloro',
      panel: 'chapa',                                                    // no aplica a vidriado
      herrajes_lista: ['cierre_embutido', 'barral'],                     // barral no es de ventana corrediza
      accesorios_lista: ['mosquitero', 'premarco'],
    });
    expect(f.sentido).toBeUndefined();
    expect(f.abre_hacia).toBeUndefined();
    expect(f.panel).toBeUndefined();
    expect(f.herrajes_lista).toEqual(['cierre_embutido']);
    expect(f).toMatchObject({
      apertura: 'Corrediza', vidrio: 'DVH 4/9/4 incoloro', herrajes: 'Cierre embutido',
      mosquitero: true, premarco: true, esquema_version: 1, hojas: 2,
    });
    expect(normalizarFicha(f)).toEqual(f);   // idempotente
  });

  it('una tipología que no corresponde al tipo se descarta', () => {
    expect(normalizarFicha({ tipo_abertura: 'pano_fijo', tipologia: 'corrediza' }).tipologia).toBeUndefined();
  });

  it('ciega: sin vidrio, con panel; combinada: un sector por franja', () => {
    const ciega = normalizarFicha({ tipo_abertura: 'puerta', tipologia: 'de_abrir', composicion: 'ciego', vidrio_tipo: 'DVH', panel: 'inyectado' });
    expect(ciega.vidrio_tipo).toBeUndefined();
    expect(ciega).toMatchObject({ panel: 'inyectado', vidrio: 'Ciego' });
    const comb = normalizarFicha({
      tipo_abertura: 'puerta', tipologia: 'de_abrir', ancho_m: 0.9, alto_m: 2.05, composicion: 'combinado',
      divisiones: [{ orientacion: 'horizontal', posicion_mm: 1000 }, { orientacion: 'horizontal', posicion_mm: 5000 }],
      sectores: ['ciego', 'vidrio'],
    });
    expect(comb.divisiones).toEqual([{ orientacion: 'horizontal', posicion_mm: 1000 }]);   // 5000 > alto
    expect(sectoresDe(comb)).toEqual(['ciego', 'vidrio']);
  });

  it('faltantes y detalle legible', () => {
    expect(faltantesFicha({ tipo_abertura: 'puerta', tipologia: 'de_abrir' })).toEqual(['las medidas', 'la cantidad de hojas', 'el sentido de apertura']);
    const filas = detalleFicha(normalizarFicha({
      tipo_abertura: 'puerta', tipologia: 'de_abrir', ancho_m: 0.9, alto_m: 2.05, hojas: 1, sentido: 'derecha', abre_hacia: 'adentro',
      sistema: 'Módena', color: 'Blanco', herrajes_lista: ['barral', 'cerradura'],
    }));
    const v = Object.fromEntries(filas.map(f => [f.label, f.valor]));
    expect(v.Medidas).toBe('900 × 2050 mm (ancho × alto)');
    expect(v.Sentido).toBe('Bisagra a la derecha, abre hacia adentro (visto desde adentro)');
    expect(v.Herrajes).toBe('Barral, Cerradura');
    expect(v.Sistema).toBe('Módena');
  });
});

describe('fichas viejas y servidor', () => {
  it('una ficha autocompletada del presupuesto se traduce al configurador', () => {
    const f = desdeFichaVieja({ tipo_abertura: 'Puerta-Balcon', apertura: 'corrediza', hojas: '2_hojas', ancho_m: 1.8, alto_m: 2,
      vidrio: 'DVH', mosquitero: true, herrajes: 'cerradura doble paleta', observaciones: 'con premarco de chapa' });
    expect(f).toMatchObject({ tipo_abertura: 'puerta_balcon', tipologia: 'corrediza', hojas: 2, vidrio_tipo: 'DVH',
      accesorios_lista: ['mosquitero'], esquema_version: 1 });
    expect(f.obs_fabricacion).toBe('con premarco de chapa · Herrajes: cerradura doble paleta');
    expect(descripcionSugerida(f)).toBe('Puerta balcón corrediza 1800 × 2000 mm');
    expect(desdeFichaVieja({ tipo_abertura: 'Portón' })).toMatchObject({ tipo_abertura: 'otro', tipo_abertura_otro: 'Portón' });
  });

  it('el servidor guarda la ficha del configurador normalizada y no toca las viejas', () => {
    const r = SolicitudCompraSchema.parse({ origen: 'faltante', tipo_producto: 'abertura_medida', items: [
      { descripcion: 'A', cantidad: 1, especificaciones: { esquema_version: 1, tipo_abertura: 'ventana', tipologia: 'corrediza', sentido: 'izquierda' } },
      { descripcion: 'B', cantidad: 1, especificaciones: { sentido: 'izquierda', color: 'Blanco' } },
    ] });
    expect(r.items[0].especificaciones.sentido).toBeUndefined();
    expect(r.items[1].especificaciones).toEqual({ sentido: 'izquierda', color: 'Blanco' });
  });
});

describe('esquema SVG', () => {
  const cuenta = (svg: string, tag: string) => (svg.match(new RegExp(`<${tag}\\b`, 'g')) ?? []).length;

  it('corrediza de 2 hojas: un parante central y dos flechas', () => {
    const svg = esquemaAberturaSVG({ tipo_abertura: 'ventana', tipologia: 'corrediza', ancho_m: 1.5, alto_m: 1.1, hojas: 2 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('1500 mm');
    expect(svg).toContain('1100 mm');
    expect(cuenta(svg, 'path')).toBe(2);
  });

  it('puerta de abrir con travesaño y combinada: dos sectores (ciego y vidrio) y el triángulo', () => {
    const svg = esquemaAberturaSVG(normalizarFicha({
      tipo_abertura: 'puerta', tipologia: 'de_abrir', ancho_m: 0.9, alto_m: 2.05, hojas: 1, sentido: 'izquierda',
      composicion: 'combinado', divisiones: [{ orientacion: 'horizontal', posicion_mm: 1000 }], sectores: ['ciego', 'vidrio'],
    }));
    expect(svg).toContain('#c9ccd1');
    expect(svg).toContain('#cfe8f7');
    expect(svg).toContain('stroke-dasharray="6 3"');
  });

  it('sin medidas dibuja igual (proporción por defecto) y no pone cotas; escapa el texto', () => {
    const svg = esquemaAberturaSVG({ tipo_abertura: 'pano_fijo', tipologia: 'fijo' });
    expect(svg).not.toContain(' mm<');
    expect(svg).not.toMatch(/NaN|undefined/);
  });
});

describe('ficha en el PDF al proveedor', () => {
  it('ficha del configurador con esquema; vieja sin ficha; adjuntos inexistentes o ajenos se ignoran', async () => {
    const { fichaCompraPDF } = await import('../lib/pdf.js');
    const nueva = fichaCompraPDF(normalizarFicha({ esquema_version: 1, tipo_abertura: 'ventana', tipologia: 'corrediza', ancho_m: 1.2, alto_m: 1, hojas: 2 }),
      ['/uploads/no-existe/plano.pdf', '/uploads/../../etc/passwd', 'https://afuera.com/x.png']);
    expect(nueva.ficha?.svg.startsWith('<svg')).toBe(true);
    expect(nueva.ficha?.filas.find(f => f.label === 'Medidas')?.valor).toBe('1200 × 1000 mm (ancho × alto)');
    expect(nueva).toMatchObject({ imagenes: [], anexos: [] });
    expect(fichaCompraPDF({ color: 'Blanco' }, null)).toEqual({ ficha: null, imagenes: [], anexos: [] });
  });
});

describe('resumen de una línea', () => {
  it('muestra las hojas que el configurador guarda como número', async () => {
    const { resumenEspecificaciones } = await import('../lib/compras.js');
    const r = resumenEspecificaciones(normalizarFicha({ esquema_version: 1, tipo_abertura: 'ventana', tipologia: 'corrediza', ancho_m: 1.2, alto_m: 1, hojas: 2 }));
    expect(r).toContain('2 hojas');
    expect(resumenEspecificaciones({ hojas: '2_hojas' })).toBe('2 hojas');
  });
});
