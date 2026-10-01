import { cuitValido, normalizarCuit } from './cuit.js';

// Reglas fiscales de la facturación (funciones puras, sin base ni ARCA: se prueban solas).
// Emisor: Responsable Inscripto. Precios cargados en el sistema: FINALES con IVA incluido.
// Todo el cálculo se hace en centavos enteros para que los totales cierren exacto (error
// 10048 de ARCA: ImpTotal distinto de la suma de sus partes).

// ── Códigos de ARCA ──────────────────────────────────────────────────────────
export const COND_IVA = {
  RESPONSABLE_INSCRIPTO: 1,
  EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
  NO_CATEGORIZADO: 7,
  PROVEEDOR_EXTERIOR: 8,
  CLIENTE_EXTERIOR: 9,
  LIBERADO: 10,
  MONOTRIBUTO_SOCIAL: 13,
  NO_ALCANZADO: 15,
  MONOTRIBUTO_TRABAJADOR_PROMOVIDO: 16,
} as const;

export const COND_IVA_DESC: Record<number, string> = {
  1: 'IVA Responsable Inscripto', 4: 'IVA Sujeto Exento', 5: 'Consumidor Final', 6: 'Responsable Monotributo',
  7: 'Sujeto No Categorizado', 8: 'Proveedor del Exterior', 9: 'Cliente del Exterior', 10: 'IVA Liberado – Ley N° 19.640',
  13: 'Monotributista Social', 15: 'IVA No Alcanzado', 16: 'Monotributo Trabajador Independiente Promovido',
};

export const DOC_TIPO = { CUIT: 80, CUIL: 86, DNI: 96, SIN_IDENTIFICAR: 99 } as const;

export type Clase = 'A' | 'B';
export type TipoDoc = 'factura' | 'nota_debito' | 'nota_credito';

const CBTE_TIPO: Record<Clase, Record<TipoDoc, number>> = {
  A: { factura: 1, nota_debito: 2, nota_credito: 3 },
  B: { factura: 6, nota_debito: 7, nota_credito: 8 },
};
export const CBTE_DESC: Record<number, string> = {
  1: 'Factura A', 2: 'Nota de Débito A', 3: 'Nota de Crédito A',
  6: 'Factura B', 7: 'Nota de Débito B', 8: 'Nota de Crédito B',
};

/** Alícuotas de IVA admitidas y su Id en ARCA. */
export const ALICUOTA_ID: Record<string, number> = { '0': 3, '10.5': 4, '21': 5, '27': 6, '5': 8, '2.5': 9 };

/** Tope de RG 5700/2025: desde este total el consumidor final tiene que estar identificado. */
export const TOPE_CF_IDENTIFICADO = 10_000_000;

/**
 * Letra del comprobante emitido por un RI. A para RI y monotributistas (RG 5003: el RI
 * factura A al monotributista); B para consumidor final, exentos y demás.
 */
export function claseSegunReceptor(condIvaReceptor: number): Clase {
  return condIvaReceptor === COND_IVA.RESPONSABLE_INSCRIPTO
    || condIvaReceptor === COND_IVA.MONOTRIBUTO
    || condIvaReceptor === COND_IVA.MONOTRIBUTO_SOCIAL
    || condIvaReceptor === COND_IVA.MONOTRIBUTO_TRABAJADOR_PROMOVIDO
    ? 'A' : 'B';
}

export const tipoComprobante = (clase: Clase, tipo: TipoDoc) => CBTE_TIPO[clase][tipo];

export function tipoDocDeCbte(cbteTipo: number): TipoDoc {
  if ([3, 8].includes(cbteTipo)) return 'nota_credito';
  if ([2, 7].includes(cbteTipo)) return 'nota_debito';
  return 'factura';
}

// ── Importes ─────────────────────────────────────────────────────────────────
export interface ItemEntrada {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;      // FINAL, con IVA incluido
  bonificacion?: number;        // importe final descontado a la línea
  alicuota?: number;            // % de IVA (default 21)
  exento?: boolean;             // operación exenta: sin IVA, va a ImpOpEx
  es_servicio?: boolean;        // instalación, mano de obra (define el concepto)
  unidad?: string;
  producto_id?: string | null;
  operacion_item_id?: string | null;
}

export interface ItemCalculado extends Required<Pick<ItemEntrada, 'descripcion' | 'cantidad' | 'precio_unitario'>> {
  bonificacion: number; alicuota: number; alicuota_id: number | null; exento: boolean; es_servicio: boolean;
  unidad: string; producto_id: string | null; operacion_item_id: string | null;
  neto: number; iva: number; total: number;
}

export interface AlicuotaCalculada { alicuota_id: number; alicuota: number; base_imp: number; importe: number }

export interface Importes {
  items: ItemCalculado[];
  alicuotas: AlicuotaCalculada[];
  imp_neto: number;      // neto gravado (incluye lo gravado al 0 %)
  imp_iva: number;
  imp_op_ex: number;     // exento
  imp_tot_conc: number;  // no gravado (no se usa hoy)
  imp_trib: number;      // otros tributos (no se usa hoy)
  imp_total: number;
  concepto: 1 | 2 | 3;   // 1 productos, 2 servicios, 3 ambos
}

// Redondeo sin el error de los flotantes: en JS 1.005 * 100 = 100.49999… y 3 × 1,255 da
// 3.7649999…; redondeados "a mano" pierden un centavo. toPrecision(15) limpia ese ruido.
const redondear = (x: number) => Math.round(Number(x.toPrecision(15)));
/** Centavos enteros de un importe en pesos. */
export const aCent = (n: number) => redondear(n * 100);
const dePesos = (c: number) => c / 100;
/** Importe a 2 decimales y cantidad a 3: lo mismo que guarda la base, para que lo calculado y lo guardado coincidan. */
const a2 = (n: number) => dePesos(aCent(n));
const a3 = (n: number) => redondear(n * 1000) / 1000;

/**
 * Reparte `total` centavos entre las partes en proporción a `pesos`, sin perder ni sobrar
 * un centavo (método del mayor resto: cada parte recibe su piso y los centavos que faltan
 * van a las de mayor fracción).
 */
export function repartirCentavos(total: number, pesos: number[]): number[] {
  const suma = pesos.reduce((a, p) => a + p, 0);
  if (!suma) return pesos.map(() => 0);
  const ideal = pesos.map(p => (total * p) / suma);
  const partes = ideal.map(Math.floor);
  let faltan = total - partes.reduce((a, p) => a + p, 0);
  const orden = ideal.map((v, i) => ({ i, resto: v - Math.floor(v) })).sort((x, y) => y.resto - x.resto || x.i - y.i);
  for (let k = 0; faltan > 0 && k < orden.length; k++, faltan--) partes[orden[k].i]++;
  return partes;
}

/**
 * Importes del comprobante desde precios FINALES (IVA incluido).
 *
 * El IVA se calcula sobre el total de CADA ALÍCUOTA (no línea por línea): así el IVA de cada
 * alícuota es siempre su base × el porcentaje (± medio centavo). Calculado por línea, cada
 * una arrastra hasta 0,6 centavos de diferencia y con muchas líneas el desvío se acumula
 * (60 líneas de $ 1,07 daban 31 centavos de IVA de más sobre la base). Después el neto de la
 * alícuota se reparte entre sus líneas, al centavo, para que la suma de las líneas sea
 * exactamente el neto informado.
 */
export function calcularImportes(entrada: ItemEntrada[]): Importes {
  const filas = entrada.map(it => {
    const alicuota = it.exento ? 0 : (it.alicuota ?? 21);
    const alicuotaId = it.exento ? null : ALICUOTA_ID[String(alicuota)];
    if (!it.exento && alicuotaId === undefined) throw new Error(`Alícuota de IVA no admitida: ${alicuota}%`);
    const cantidad = a3(it.cantidad);
    const precio = a2(it.precio_unitario);
    const bonificacion = a2(it.bonificacion ?? 0);
    const totalC = redondear(cantidad * aCent(precio)) - aCent(bonificacion);
    return { it, alicuota, alicuotaId: alicuotaId ?? null, cantidad, precio, bonificacion, totalC, netoC: totalC, ivaC: 0 };
  });

  // IVA por alícuota sobre su total, y reparto del neto entre las líneas
  const grupos = new Map<number, typeof filas>();
  for (const f of filas) if (f.alicuotaId !== null) grupos.set(f.alicuotaId, [...(grupos.get(f.alicuotaId) ?? []), f]);
  const alicuotas: AlicuotaCalculada[] = [];
  for (const [id, fs] of [...grupos.entries()].sort(([a], [b]) => a - b)) {
    const totalG = fs.reduce((a, f) => a + f.totalC, 0);
    const baseG = Math.round(totalG / (1 + fs[0].alicuota / 100));
    const netos = repartirCentavos(baseG, fs.map(f => Math.max(f.totalC, 0)));
    fs.forEach((f, i) => { f.netoC = netos[i]; f.ivaC = f.totalC - netos[i]; });
    alicuotas.push({ alicuota_id: id, alicuota: fs[0].alicuota, base_imp: dePesos(baseG), importe: dePesos(totalG - baseG) });
  }

  let netoC = 0, ivaC = 0, exentoC = 0;
  const items = filas.map<ItemCalculado>(f => {
    if (f.alicuotaId === null) exentoC += f.totalC;
    else { netoC += f.netoC; ivaC += f.ivaC; }
    const it = f.it;
    return {
      descripcion: it.descripcion.trim(), cantidad: f.cantidad, precio_unitario: f.precio,
      bonificacion: f.bonificacion, alicuota: f.alicuota, alicuota_id: f.alicuotaId, exento: !!it.exento,
      es_servicio: !!it.es_servicio, unidad: it.unidad ?? 'u', producto_id: it.producto_id ?? null,
      operacion_item_id: it.operacion_item_id ?? null,
      neto: dePesos(f.netoC), iva: dePesos(f.ivaC), total: dePesos(f.totalC),
    };
  });

  const hayServicio = items.some(i => i.es_servicio);
  const hayProducto = items.some(i => !i.es_servicio);
  return {
    items,
    alicuotas,
    imp_neto: dePesos(netoC), imp_iva: dePesos(ivaC), imp_op_ex: dePesos(exentoC),
    imp_tot_conc: 0, imp_trib: 0,
    imp_total: dePesos(netoC + ivaC + exentoC),
    concepto: hayServicio && hayProducto ? 3 : hayServicio ? 2 : 1,
  };
}

// ── Validaciones previas a ARCA ──────────────────────────────────────────────
export interface Receptor {
  doc_tipo: number;
  doc_nro: string;            // '0' si no está identificado
  nombre: string;
  domicilio?: string | null;
  condicion_iva_id: number;
}

export interface DatosValidacion {
  tipo: TipoDoc;
  clase: Clase;
  receptor: Receptor;
  importes: Importes;
  fecha: string;              // AAAA-MM-DD
  hoy: string;                // AAAA-MM-DD (horario AR)
  cuit_emisor: string;
  fch_serv_desde?: string | null;
  fch_serv_hasta?: string | null;
  fch_vto_pago?: string | null;
  asociado?: { cbte_tipo: number; numero: number | null; clase: Clase } | null;
}

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400_000);

/** Lista de problemas en castellano (vacía = se puede enviar a ARCA). */
export function validarComprobante(d: DatosValidacion): string[] {
  const p: string[] = [];
  const { receptor: r, importes: im } = d;

  if (!im.items.length) p.push('El comprobante no tiene ítems');
  if (im.items.some(i => !i.descripcion)) p.push('Hay ítems sin descripción');
  if (im.items.some(i => !(i.cantidad > 0))) p.push('Hay ítems con cantidad cero o negativa');
  if (im.items.some(i => i.total <= 0)) p.push('Hay ítems con importe cero o negativo');
  if (im.imp_total <= 0) p.push('El total tiene que ser mayor a cero');

  if (!COND_IVA_DESC[r.condicion_iva_id]) p.push('Falta la condición frente al IVA del cliente (obligatoria por RG 5616)');
  if (d.clase !== claseSegunReceptor(r.condicion_iva_id) && d.tipo === 'factura') {
    p.push(`Para un cliente "${COND_IVA_DESC[r.condicion_iva_id] ?? '?'}" corresponde factura ${claseSegunReceptor(r.condicion_iva_id)}`);
  }
  if (d.clase === 'A' && r.doc_tipo !== DOC_TIPO.CUIT) p.push('La factura A exige el CUIT del cliente');
  if (r.doc_tipo === DOC_TIPO.CUIT && !cuitValido(r.doc_nro)) p.push('El CUIT del cliente no es válido');
  if (r.doc_tipo === DOC_TIPO.DNI && !/^\d{6,8}$/.test(r.doc_nro)) p.push('El DNI del cliente no es válido');
  if (r.doc_tipo === DOC_TIPO.SIN_IDENTIFICAR) {
    if (r.condicion_iva_id !== COND_IVA.CONSUMIDOR_FINAL) p.push('Solo un consumidor final puede quedar sin identificar');
    if (im.imp_total >= TOPE_CF_IDENTIFICADO) {
      p.push(`Desde $ ${TOPE_CF_IDENTIFICADO.toLocaleString('es-AR')} hay que identificar al consumidor final con DNI o CUIT (RG 5700)`);
    }
  }
  if (r.doc_tipo !== DOC_TIPO.SIN_IDENTIFICAR && normalizarCuit(r.doc_nro) === normalizarCuit(d.cuit_emisor)) {
    p.push('No se puede facturar al propio CUIT del emisor');
  }
  if (!r.nombre?.trim()) p.push('Falta el nombre o razón social del cliente');

  // Fecha: ARCA admite hasta 5 días antes/después para productos y 10 para servicios.
  const margen = im.concepto === 1 ? 5 : 10;
  const dif = diasEntre(d.hoy, d.fecha);
  if (Math.abs(dif) > margen) p.push(`La fecha del comprobante puede estar hasta ${margen} días antes o después de hoy`);

  if (im.concepto !== 1) {
    if (!d.fch_serv_desde || !d.fch_serv_hasta || !d.fch_vto_pago) {
      p.push('Con servicios (instalación) hay que indicar período del servicio y vencimiento del pago');
    } else {
      if (d.fch_serv_desde > d.fch_serv_hasta) p.push('El período del servicio termina antes de empezar');
      if (d.fch_vto_pago < d.fecha) p.push('El vencimiento del pago no puede ser anterior a la fecha del comprobante');
    }
  }

  if (d.tipo !== 'factura') {
    if (!d.asociado) p.push('Las notas de crédito y débito tienen que asociarse a la factura que corrigen');
    else if (!d.asociado.numero) p.push('La factura asociada todavía no está autorizada por ARCA');
    else if (d.asociado.clase !== d.clase) p.push('La nota tiene que ser de la misma letra que la factura asociada');
  }
  return p;
}

/** "0003-00000123" */
export function numeroFormateado(puntoVenta: number, numero: number | null): string {
  return `${String(puntoVenta).padStart(5, '0')}-${numero ? String(numero).padStart(8, '0') : '________'}`;
}
