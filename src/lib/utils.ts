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
  }).format(new Date(date));
}

// Disponibilidad con proveedor: confirmación manual (por WhatsApp) que vence a los
// N días para que no quede "confirmada para siempre" sin volver a chequear.
export const DISPONIBILIDAD_VIGENCIA_DIAS = 10;

export function disponibilidadVigente(fechaIso: string | null | undefined): boolean {
  if (!fechaIso) return false;
  const dias = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86400000);
  return dias <= DISPONIBILIDAD_VIGENCIA_DIAS;
}
