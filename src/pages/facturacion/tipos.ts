// Tipos y utilidades compartidas del módulo Facturación (frontend).

export type EstadoCbte = 'borrador' | 'emitiendo' | 'autorizado' | 'rechazado' | 'incierto' | 'contingencia';
export type TipoDoc = 'factura' | 'nota_debito' | 'nota_credito';

export interface ItemCbte {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  bonificacion?: number;
  alicuota?: number;
  exento?: boolean;
  es_servicio?: boolean;
  unidad?: string;
  producto_id?: string | null;
  operacion_item_id?: string | null;
}

export interface Receptor {
  doc_tipo: 80 | 86 | 96 | 99;
  doc_nro: string;
  nombre: string;
  domicilio?: string | null;
  condicion_iva_id: number;
}

export interface NuevoComprobante {
  tipo_doc: TipoDoc;
  receptor: Receptor;
  items: ItemCbte[];
  cliente_id?: string | null;
  fecha?: string | null;
  fch_serv_desde?: string | null;
  fch_serv_hasta?: string | null;
  fch_vto_pago?: string | null;
  origen?: 'manual' | 'operacion' | 'recibo';
  operacion_id?: string | null;
  recibo_id?: string | null;
  comprobante_asociado_id?: string | null;
  notas?: string | null;
  confirmar_exceso?: boolean;
}

export interface Propuesta {
  comprobante: NuevoComprobante;
  referencia: string;
  total_origen: number;
  facturado: number;
  saldo: number;
  avisos: string[];
}

export interface Analisis {
  clase: 'A' | 'B';
  cbte_tipo: number;
  punto_venta: number;
  fecha: string;
  importes: {
    items: (ItemCbte & { neto: number; iva: number; total: number })[];
    alicuotas: { alicuota_id: number; alicuota: number; base_imp: number; importe: number }[];
    imp_neto: number; imp_iva: number; imp_op_ex: number; imp_total: number; concepto: 1 | 2 | 3;
  };
  problemas: string[];
  exceso: { exceso: number; referencia: string } | null;
}

export interface ComprobanteLista {
  id: string; estado: EstadoCbte; tipo_doc: TipoDoc; clase: 'A' | 'B'; cbte_tipo: number;
  punto_venta: number; numero: string | null; fecha: string; receptor_nombre: string;
  receptor_doc_tipo: number; receptor_doc_nro: string; imp_total: string; cae: string | null;
  cae_vto: string | null; origen: string; operacion_id: string | null; recibo_id: string | null;
  cliente_id: string | null; ambiente: string; errores: { code: string; msg: string }[] | null; created_at: string;
}

export interface Tablero {
  facturado_mes: number; facturas_a_mes: number; facturas_b_mes: number; notas_credito_mes: number;
  pendientes: number; sin_confirmar: number; en_contingencia: number; habilitada: boolean; ambiente: 'homologacion' | 'produccion';
}

export const CBTE_NOMBRE: Record<number, string> = {
  1: 'Factura A', 2: 'Nota de Débito A', 3: 'Nota de Crédito A',
  6: 'Factura B', 7: 'Nota de Débito B', 8: 'Nota de Crédito B',
};

export const COND_IVA_NOMBRE: Record<number, string> = {
  1: 'IVA Responsable Inscripto', 4: 'IVA Sujeto Exento', 5: 'Consumidor Final', 6: 'Responsable Monotributo',
  13: 'Monotributista Social', 15: 'IVA No Alcanzado', 16: 'Monotributo Trabajador Independiente Promovido',
};

export const DOC_NOMBRE: Record<number, string> = { 80: 'CUIT', 86: 'CUIL', 96: 'DNI', 99: 'Sin identificar' };

/** Estado para mostrar: etiqueta + sólido (nivel 1, igual que Presupuestos). */
export const ESTADO_CBTE: Record<EstadoCbte, { label: string; cls: string }> = {
  borrador:   { label: 'Borrador',          cls: 'bg-gray-500 text-white' },
  emitiendo:  { label: 'Enviando a ARCA',   cls: 'bg-sky-600 text-white' },
  autorizado: { label: 'Autorizado',        cls: 'bg-emerald-600 text-white' },
  rechazado:  { label: 'Rechazado',         cls: 'bg-red-600 text-white' },
  incierto:   { label: 'Sin confirmar',     cls: 'bg-amber-500 text-white' },
  contingencia: { label: 'CAEA sin informar', cls: 'bg-sky-700 text-white' },
};

export function numeroCbte(pv: number, numero: string | number | null): string {
  return `${String(pv).padStart(5, '0')}-${numero ? String(numero).padStart(8, '0') : '________'}`;
}

export const fmt$ = (n: number | string) =>
  `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** DATE que llega como "AAAA-MM-DDT03:00:00.000Z" → "dd/mm/aaaa" sin correrse de día. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function documentoTexto(tipo: number, nro: string): string {
  if (tipo === 99) return 'Consumidor final sin identificar';
  return `${DOC_NOMBRE[tipo] ?? 'Doc.'} ${nro}`;
}
