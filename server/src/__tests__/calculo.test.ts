import { describe, it, expect } from 'vitest';
import {
  calcularImportes, repartirCentavos, aCent, claseSegunReceptor, tipoComprobante, validarComprobante, numeroFormateado,
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

describe('decimales, redondeos y consistencia (revisión 2026-10-01)', () => {
  const c = (n: number) => Math.round(n * 100);

  it('redondea bien los casos donde el flotante de JS pierde un centavo', () => {
    expect(aCent(1.005)).toBe(101);
    expect(calcularImportes([{ descripcion: 'x', cantidad: 1, precio_unitario: 1.005 }]).imp_total).toBe(1.01);
    expect(calcularImportes([{ descripcion: 'x', cantidad: 1.5, precio_unitario: 2.33 }]).imp_total).toBe(3.5);
    expect(calcularImportes([{ descripcion: 'x', cantidad: 7, precio_unitario: 1.15 }]).imp_total).toBe(8.05);
    expect(calcularImportes([{ descripcion: 'x', cantidad: 3, precio_unitario: 0.1 }]).imp_total).toBe(0.3);
  });

  it('precio a 2 decimales y cantidad a 3, igual que la base: lo calculado es lo que se guarda', () => {
    const r = calcularImportes([{ descripcion: 'x', cantidad: 1.2345, precio_unitario: 33.335 }]);
    expect(r.items[0]).toMatchObject({ cantidad: 1.235, precio_unitario: 33.34 });
    expect(r.items[0].total).toBe(Math.round(1.235 * 3334) / 100);
  });

  it('con muchas líneas el IVA de cada alícuota sigue siendo su base × el porcentaje', () => {
    const r = calcularImportes(Array.from({ length: 60 }, (_, i) => ({ descripcion: `Tornillo ${i}`, cantidad: 1, precio_unitario: 1.07 })));
    const a = r.alicuotas[0];
    expect(r.imp_total).toBe(64.2);
    expect(Math.abs(c(a.importe) - a.base_imp * 21)).toBeLessThanOrEqual(0.5);
    // la suma de los netos de las líneas es exactamente la base informada
    expect(r.items.reduce((s, i) => s + c(i.neto), 0)).toBe(c(a.base_imp));
  });

  it('reparto de centavos: suma exacta y proporcional', () => {
    expect(repartirCentavos(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(repartirCentavos(0, [5, 5])).toEqual([0, 0]);
    expect(repartirCentavos(7, [0, 0])).toEqual([0, 0]);
    const p = repartirCentavos(123_457, [10, 20, 30, 40]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(123_457);
  });

  it('miles de facturas al azar: todos los totales cierran al centavo y recalcular da lo mismo', () => {
    let semilla = 20261001;
    const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2 ** 31; return semilla / 2 ** 31; };
    const ALIC = [21, 21, 21, 10.5, 27, 5, 2.5, 0];
    for (let n = 0; n < 3000; n++) {
      const items = Array.from({ length: 1 + Math.floor(azar() * 25) }, (_, i) => {
        const cantidad = azar() < 0.8 ? 1 + Math.floor(azar() * 12) : Math.round(azar() * 10_000) / 1000 + 0.001;
        const precio = Math.round((azar() < 0.5 ? azar() * 50 : azar() * 2_000_000) * 1000) / 1000 + 0.01;
        const bruto = Math.round(cantidad * precio * 100) / 100;
        return {
          descripcion: `i${i}`, cantidad, precio_unitario: precio,
          bonificacion: azar() < 0.2 ? Math.round(bruto * azar() * 0.3 * 100) / 100 : 0,
          exento: azar() < 0.1, alicuota: ALIC[Math.floor(azar() * ALIC.length)], es_servicio: azar() < 0.2,
        };
      });
      const r = calcularImportes(items);
      // Total = neto + IVA + exento, y = suma de las líneas
      expect(c(r.imp_total)).toBe(c(r.imp_neto) + c(r.imp_iva) + c(r.imp_op_ex));
      expect(c(r.imp_total)).toBe(r.items.reduce((s, i) => s + c(i.total), 0));
      // Lo que va a ARCA: ImpNeto = Σ BaseImp, ImpIVA = Σ Importe
      expect(c(r.imp_neto)).toBe(r.alicuotas.reduce((s, a) => s + c(a.base_imp), 0));
      expect(c(r.imp_iva)).toBe(r.alicuotas.reduce((s, a) => s + c(a.importe), 0));
      for (const a of r.alicuotas) {
        // IVA de cada alícuota = base × % (con medio centavo de tolerancia por el redondeo del neto)
        expect(Math.abs(c(a.importe) - c(a.base_imp) * a.alicuota / 100)).toBeLessThanOrEqual(a.alicuota / 200 + 0.5);
        const lineas = r.items.filter(i => i.alicuota_id === a.alicuota_id);
        expect(lineas.reduce((s, i) => s + c(i.neto), 0)).toBe(c(a.base_imp));
        expect(lineas.reduce((s, i) => s + c(i.iva), 0)).toBe(c(a.importe));
      }
      for (const i of r.items) {
        expect(c(i.neto) + c(i.iva)).toBe(c(i.total));
        if (i.total > 0) expect(i.iva).toBeGreaterThanOrEqual(0);
        if (i.exento) expect(i.iva).toBe(0);
      }
      // Reconstruir desde lo guardado (nota de crédito total, PDF) da exactamente lo mismo
      const r2 = calcularImportes(r.items);
      expect([r2.imp_neto, r2.imp_iva, r2.imp_op_ex, r2.imp_total]).toEqual([r.imp_neto, r.imp_iva, r.imp_op_ex, r.imp_total]);
      expect(r2.alicuotas).toEqual(r.alicuotas);
    }
  });
});
