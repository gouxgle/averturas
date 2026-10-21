import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { diasCalendarioAR, fechaDiaAR } from '@/lib/utils';

// Semáforo de antigüedad del precio: un solo cálculo para la tarjeta, el detalle y la renovación.
// Los días salen de la misma configuración que usa la revisión de precios (precios_config).
export interface ConfigValidez { dias_al_dia: number; dias_vencido: number }
export type EstadoValidez = 'al_dia' | 'por_vencer' | 'vencido';

const POR_DEFECTO: ConfigValidez = { dias_al_dia: 7, dias_vencido: 10 };
let cache: ConfigValidez | null = null;
let pendiente: Promise<ConfigValidez> | null = null;

function cargarConfig(): Promise<ConfigValidez> {
  if (cache) return Promise.resolve(cache);
  pendiente ??= api.get<ConfigValidez>('/productos/config-validez')
    .then(c => (cache = { dias_al_dia: Number(c.dias_al_dia) || 7, dias_vencido: Number(c.dias_vencido) || 10 }))
    .catch(() => POR_DEFECTO)
    .finally(() => { pendiente = null; });
  return pendiente;
}

/** Configuración del semáforo (una sola consulta para toda la app). */
export function useConfigValidez(): ConfigValidez {
  const [cfg, setCfg] = useState<ConfigValidez>(cache ?? POR_DEFECTO);
  useEffect(() => {
    let vivo = true;
    cargarConfig().then(c => { if (vivo) setCfg(c); });
    return () => { vivo = false; };
  }, []);
  return cfg;
}

export interface ValidezPrecio {
  estado: EstadoValidez;
  /** Días calendario (Argentina) desde la última actualización; null si nunca se actualizó. */
  dias: number | null;
  /** Fecha (YYYY-MM-DD) hasta la que el precio está "al día". */
  venceEl: string | null;
}

export function validezPrecio(fechaIso: string | null | undefined, cfg: ConfigValidez = POR_DEFECTO): ValidezPrecio {
  if (!fechaIso) return { estado: 'vencido', dias: null, venceEl: null };
  const dias = Math.max(diasCalendarioAR(fechaIso), 0);
  const estado: EstadoValidez = dias <= cfg.dias_al_dia ? 'al_dia' : dias <= cfg.dias_vencido ? 'por_vencer' : 'vencido';
  const d = new Date(fechaDiaAR(fechaIso) + 'T12:00:00');
  d.setDate(d.getDate() + cfg.dias_al_dia);
  return { estado, dias, venceEl: fechaDiaAR(d) };
}

export const COLOR_VALIDEZ: Record<EstadoValidez, string> = {
  al_dia: 'text-emerald-600', por_vencer: 'text-amber-600', vencido: 'text-red-600',
};
