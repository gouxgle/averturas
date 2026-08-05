import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ_AR,
  }).format(new Date(date));
}

// ── Hora/fecha centralizada en horario Argentina ────────────────────────────
// El local (única sede física, Formosa) siempre debe leerse en esta zona,
// sin depender de cómo esté configurado el reloj/idioma del navegador de
// quien esté usando la app. Todo cálculo de "hoy/ayer/hace N días" en el
// frontend debe pasar por acá — no comparar timestamps "a mano".
export const TZ_AR = 'America/Argentina/Buenos_Aires';

// Fecha calendario (YYYY-MM-DD) de un instante, en horario Argentina.
export function fechaDiaAR(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-CA', { timeZone: TZ_AR });
}

// Diferencia en DÍAS CALENDARIO (no en bloques de 24hs) entre un timestamp y
// ahora, contada en horario Argentina. 0 = hoy, 1 = ayer, -1 = mañana, etc.
// Con esto, algo creado ayer a las 18:00 vuelve a dar 1 ("ayer") aunque se
// mire hoy a las 08:00 (menos de 24hs reales transcurridas) — antes,
// Math.floor(ms transcurridos / 86400000) daba 0 ("hoy") en ese caso.
export function diasCalendarioAR(iso: string | Date): number {
  const hoy = fechaDiaAR(new Date());
  const dia = fechaDiaAR(iso);
  const msHoy = new Date(hoy + 'T12:00:00').getTime();
  const msDia = new Date(dia + 'T12:00:00').getTime();
  return Math.round((msHoy - msDia) / 86400000);
}

// Disponibilidad con proveedor: confirmación manual (por WhatsApp) que vence a los
// N días para que no quede "confirmada para siempre" sin volver a chequear.
export const DISPONIBILIDAD_VIGENCIA_DIAS = 10;

export function disponibilidadVigente(fechaIso: string | null | undefined): boolean {
  if (!fechaIso) return false;
  return diasCalendarioAR(fechaIso) <= DISPONIBILIDAD_VIGENCIA_DIAS;
}
