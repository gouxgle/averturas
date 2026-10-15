// Formas de pago disponibles al emitir un recibo.
// Compartido por NuevoRecibo (cobro de presupuestos) y VisitaTecnica (cobro de la visita).
/** Nombre reservado: paga con el saldo a favor del cliente (devoluciones). No es dinero que entra a caja. */
export const FORMA_PAGO_SALDO_FAVOR = 'Saldo a favor';

export const FORMAS_PAGO = [
  'Contado',
  'Tarjeta de débito/crédito en 1 pago',
  'Transferencia',
  'Tarjeta de crédito 3 cuotas sin interés',
];
