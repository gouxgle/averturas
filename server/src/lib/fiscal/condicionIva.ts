import { COND_IVA } from './calculo.js';

// Condición frente al IVA del cliente: en `clientes.condicion_iva` se guarda una clave de
// texto (la que usa el formulario desde antes); acá se traduce al código de ARCA que pide
// la RG 5616. Vacío = consumidor final.

export const CONDICIONES_IVA = [
  { clave: 'consumidor_final',      id: COND_IVA.CONSUMIDOR_FINAL,      etiqueta: 'Consumidor final' },
  { clave: 'responsable_inscripto', id: COND_IVA.RESPONSABLE_INSCRIPTO, etiqueta: 'Responsable inscripto' },
  { clave: 'monotributista',        id: COND_IVA.MONOTRIBUTO,           etiqueta: 'Monotributista' },
  { clave: 'exento',                id: COND_IVA.EXENTO,                etiqueta: 'Exento' },
  { clave: 'no_alcanzado',          id: COND_IVA.NO_ALCANZADO,          etiqueta: 'IVA no alcanzado' },
  { clave: 'monotributo_social',    id: COND_IVA.MONOTRIBUTO_SOCIAL,    etiqueta: 'Monotributista social' },
] as const;

export type ClaveCondicionIva = (typeof CONDICIONES_IVA)[number]['clave'];

// "no_responsable" existía en el formulario viejo; esa categoría ya no existe en ARCA y
// para un emisor RI se factura igual que a un no alcanzado (B).
const ALIAS: Record<string, number> = { no_responsable: COND_IVA.NO_ALCANZADO };

export function condicionIvaId(clave: string | null | undefined): number {
  const c = (clave ?? '').trim();
  if (!c) return COND_IVA.CONSUMIDOR_FINAL;
  return CONDICIONES_IVA.find(x => x.clave === c)?.id ?? ALIAS[c] ?? COND_IVA.CONSUMIDOR_FINAL;
}

export function claveCondicionIva(id: number): ClaveCondicionIva {
  return CONDICIONES_IVA.find(x => x.id === id)?.clave ?? 'consumidor_final';
}
