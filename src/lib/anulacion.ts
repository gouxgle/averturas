// Mismas claves que AnularOperacionSchema (server/src/lib/schemas.ts).
export const MOTIVOS_ANULACION: { valor: string; label: string }[] = [
  { valor: 'error_carga',        label: 'Error de carga' },
  { valor: 'cliente_equivocado', label: 'Cliente equivocado' },
  { valor: 'duplicado',          label: 'Presupuesto duplicado' },
  { valor: 'reemplazado',        label: 'Reemplazado por otro presupuesto' },
  { valor: 'cliente_desistio',   label: 'El cliente desistió' },
  { valor: 'otro',               label: 'Otro motivo' },
];
