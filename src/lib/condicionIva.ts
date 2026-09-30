// Condición frente al IVA del cliente (clave de texto de clientes.condicion_iva). Espejo de
// server/src/lib/fiscal/condicionIva.ts, que la traduce al código de ARCA. Vacío = consumidor final.

export const CONDICIONES_IVA = [
  { clave: 'consumidor_final',      etiqueta: 'Consumidor final' },
  { clave: 'responsable_inscripto', etiqueta: 'Responsable inscripto' },
  { clave: 'monotributista',        etiqueta: 'Monotributista' },
  { clave: 'exento',                etiqueta: 'Exento' },
  { clave: 'no_alcanzado',          etiqueta: 'IVA no alcanzado' },
  { clave: 'monotributo_social',    etiqueta: 'Monotributista social' },
] as const;

export const CONDICION_IVA_LABEL: Record<string, string> = {
  '': 'Consumidor final',
  ...Object.fromEntries(CONDICIONES_IVA.map(c => [c.clave, c.etiqueta])),
  no_responsable: 'No responsable (categoría vieja)',
};
