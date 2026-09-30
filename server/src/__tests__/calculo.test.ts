import { describe, it, expect } from 'vitest';
import {
  calcularImportes, claseSegunReceptor, tipoComprobante, validarComprobante, numeroFormateado,
  COND_IVA, DOC_TIPO, type DatosValidacion,
} from '../lib/fiscal/calculo.js';

describe('letra del comprobante (emisor RI)', () => {
  it('A para RI y monotributo (RG 5003), B para consumidor final y exento', () => {
    expect(claseSegunReceptor(COND_IVA.RESPONSABLE_INSCRIPTO)).toBe('A');
    expect(claseSegunReceptor(COND_IVA.MONOTRIBUTO)).toBe('A');
    expect(claseSegunReceptor(COND_IVA.CONSUMIDOR_FINAL)).toBe('B');
    expect(claseSegunReceptor(COND_IVA.EXENTO)).toBe('B');
    expect(tipoComprobante('A', 'factura')).toBe(1);
    expect(tipoComprobante('B', 'nota_credito')).toBe(8);
  });
});

describe('importes desde precio final con IVA incluido', () => {
  it('separa neto e IVA 21 % y los totales cierran exacto', () => {
    const r = calcularImportes([{ descripcion: 'Ventana', cantidad: 1, precio_unitario: 121_000 }]);
    expect(r.imp_neto).toBe(100_000);
    expect(r.imp_iva).toBe(21_000);
    expect(r.imp_total).toBe(121_000);
    expect(r.alicuotas).toEqual([{ alicuota_id: 5, alicuota: 21, base_imp: 100_000, importe: 21_000 }]);
    expect(r.concepto).toBe(1);
  });

  it('con montos que no dividen exacto, neto + IVA = total en cada línea y en el total', () => {
    const r = calcularImportes([
      { descripcion: 'Puerta', cantidad: 3, precio_unitario: 33_333.33 },
      { descripcion: 'Mosquitero', cantidad: 7, precio_unitario: 1_234.57, bonificacion: 0.99 },
      { descripcion: 'Burlete', cantidad: 2.5, precio_unitario: 999.99 },
    ]);
    for (const it of r.items) expect(Math.round((it.neto + it.iva) * 100)).toBe(Math.round(it.total * 100));
    const suma = r.items.reduce((a, i) => a + Math.round(i.total * 100), 0);
    expect(Math.round(r.imp_total * 100)).toBe(suma);
    expect(Math.round((r.imp_neto + r.imp_iva + r.imp_op_ex) * 100)).toBe(Math.round(r.imp_total * 100));
    const base = r.alicuotas.reduce((a, x) => a + Math.round(x.base_imp * 100), 0);
    expect(base).toBe(Math.round(r.imp_neto * 100));
  });

  it('agrupa por alícuota (21 y 10,5) y deja lo exento fuera del IVA', () => {
    const r = calcularImportes([
      { descripcion: 'Ventana', cantidad: 1, precio_unitario: 121 },
      { descripcion: 'Bien al 10,5', cantidad: 1, precio_unitario: 110.5, alicuota: 10.5 },
      { descripcion: 'Exento', cantidad: 1, precio_unitario: 50, exento: true },
    ]);
    expect(r.alicuotas.map(a => [a.alicuota_id, a.base_imp, a.importe])).toEqual([[4, 100, 10.5], [5, 100, 21]]);
    expect(r.imp_op_ex).toBe(50);
    expect(r.imp_total).toBe(281.5);
  });

  it('concepto 3 si hay productos e instalación, 2 si solo servicios', () => {
    expect(calcularImportes([
      { descripcion: 'Ventana', cantidad: 1, precio_unitario: 100 },
      { descripcion: 'Instalación', cantidad: 1, precio_unitario: 50, es_servicio: true },
    ]).concepto).toBe(3);
    expect(calcularImportes([{ descripcion: 'Instalación', cantidad: 1, precio_unitario: 50, es_servicio: true }]).concepto).toBe(2);
  });

  it('rechaza alícuotas que ARCA no admite', () => {
    expect(() => calcularImportes([{ descripcion: 'x', cantidad: 1, precio_unitario: 1, alicuota: 19 }])).toThrow(/Alícuota/);
  });
});

describe('validaciones previas', () => {
  const base = (over: Partial<DatosValidacion> = {}): DatosValidacion => ({
    tipo: 'factura', clase: 'B',
    receptor: { doc_tipo: DOC_TIPO.SIN_IDENTIFICAR, doc_nro: '0', nombre: 'Consumidor Final', condicion_iva_id: COND_IVA.CONSUMIDOR_FINAL },
    importes: calcularImportes([{ descripcion: 'Ventana', cantidad: 1, precio_unitario: 121_000 }]),
    fecha: '2026-10-01', hoy: '2026-10-01', cuit_emisor: '23258897609',
    ...over,
  });

  it('una factura B a consumidor final sin identificar es válida', () => {
    expect(validarComprobante(base())).toEqual([]);
  });

  it('exige identificar al consumidor final desde $10 M (RG 5700)', () => {
    const p = validarComprobante(base({ importes: calcularImportes([{ descripcion: 'Obra', cantidad: 1, precio_unitario: 10_000_000 }]) }));
    expect(p.join()).toMatch(/RG 5700/);
  });

  it('factura A exige CUIT válido y la letra tiene que corresponder al receptor', () => {
    const ri = { doc_tipo: DOC_TIPO.DNI, doc_nro: '25889760', nombre: 'Empresa', condicion_iva_id: COND_IVA.RESPONSABLE_INSCRIPTO };
    expect(validarComprobante(base({ clase: 'A', receptor: ri })).join()).toMatch(/exige el CUIT/);
    expect(validarComprobante(base({ clase: 'B', receptor: { ...ri, doc_tipo: DOC_TIPO.CUIT, doc_nro: '20111111112' } })).join())
      .toMatch(/corresponde factura A/);
    expect(validarComprobante(base({ clase: 'A', receptor: { ...ri, doc_tipo: DOC_TIPO.CUIT, doc_nro: '20111111113' } })).join())
      .toMatch(/CUIT del cliente no es válido/);
  });

  it('no permite facturarse a sí mismo ni sin condición de IVA', () => {
    const r = { doc_tipo: DOC_TIPO.CUIT, doc_nro: '23-25889760-9', nombre: 'Yo', condicion_iva_id: COND_IVA.RESPONSABLE_INSCRIPTO };
    expect(validarComprobante(base({ clase: 'A', receptor: r })).join()).toMatch(/propio CUIT/);
    expect(validarComprobante(base({ receptor: { ...base().receptor, condicion_iva_id: 0 } })).join()).toMatch(/RG 5616/);
  });

  it('controla la fecha (±5 días productos, ±10 servicios) y las fechas de servicio', () => {
    expect(validarComprobante(base({ fecha: '2026-10-07' })).join()).toMatch(/5 días/);
    const conServicio = calcularImportes([{ descripcion: 'Instalación', cantidad: 1, precio_unitario: 100, es_servicio: true }]);
    expect(validarComprobante(base({ importes: conServicio, fecha: '2026-10-07' })).join()).toMatch(/período del servicio/);
    expect(validarComprobante(base({
      importes: conServicio, fecha: '2026-10-07', fch_serv_desde: '2026-10-01', fch_serv_hasta: '2026-10-05', fch_vto_pago: '2026-10-10',
    }))).toEqual([]);
  });

  it('las notas de crédito necesitan una factura asociada autorizada y de la misma letra', () => {
    expect(validarComprobante(base({ tipo: 'nota_credito' })).join()).toMatch(/asociarse/);
    expect(validarComprobante(base({ tipo: 'nota_credito', asociado: { cbte_tipo: 1, numero: 5, clase: 'A' } })).join())
      .toMatch(/misma letra/);
    expect(validarComprobante(base({ tipo: 'nota_credito', asociado: { cbte_tipo: 6, numero: 5, clase: 'B' } }))).toEqual([]);
  });

  it('formatea el número como en el papel', () => {
    expect(numeroFormateado(3, 123)).toBe('00003-00000123');
  });
});
