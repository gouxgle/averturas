// Devoluciones: tipos de la API y vista previa del resultado económico.
// La cuenta vive en el servidor (server/src/lib/devoluciones.ts → calcularDevolucion), que SIEMPRE
// recalcula al confirmar; esta copia es solo para mostrar el resultado antes de confirmar y tiene
// su test con los mismos casos. Si se cambia una, hay que cambiar la otra.

export interface LineaDevolvible {
  remito_item_id: string;
  remito_id: string;
  remito_numero: string;
  operacion_item_id: string | null;
  producto_id: string | null;
  producto_codigo: string | null;
  tipo_abertura_nombre: string | null;
  descripcion: string;
  nombre: string;
  tipo_item: string | null;
  entregado: number;
  devuelto: number;
  maximo: number;
  precio_bruto: number | null;
  sin_precio: boolean;
  facturado: boolean;
  bloqueo: string | null;
  aviso: string | null;
}

export interface PreparacionDevolucion {
  cliente_id: string;
  operacion_id: string | null;
  remito_id: string | null;
  operacion: { id: string; numero: string; precio_total: number; cobrado: number; descuentos: number; devuelto_a_saldo: number; saldo: number } | null;
  lineas: LineaDevolvible[];
}

export type DestinoDevolucion = 'stock' | 'no_reingresa';

export interface ResultadoDevolucion {
  valor_total: number;
  aplicado_a_saldo: number;
  /** Plata que el cliente ya había puesto: queda a favor suya (en la etapa de reintegros, o se le devuelve). */
  excedente: number;
  saldo_final: number | null;
}

// Centavos enteros con el mismo redondeo que el servidor (toPrecision limpia 1.005 * 100 = 100.4999…).
const aCent = (n: number) => Math.round(Number((n * 100).toPrecision(15)));

export function calcularResultado(
  op: PreparacionDevolucion['operacion'],
  lineas: { cantidad: number; precio_bruto: number }[],
): ResultadoDevolucion {
  const factor = op && op.precio_total > 0 ? Math.min(Math.max(op.descuentos / op.precio_total, 0), 1) : 0;
  let valorC = 0;
  for (const l of lineas) valorC += aCent(l.precio_bruto * (1 - factor)) * l.cantidad;
  const saldoC = op ? Math.max(aCent(op.saldo), 0) : 0;
  const aplicadoC = Math.min(valorC, saldoC);
  return {
    valor_total: valorC / 100,
    aplicado_a_saldo: aplicadoC / 100,
    excedente: (valorC - aplicadoC) / 100,
    saldo_final: op ? (aCent(op.saldo) - aplicadoC) / 100 : null,
  };
}
