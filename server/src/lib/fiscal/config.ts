import { db } from '../../db.js';
import type { Ambiente } from '../arca/endpoints.js';

export interface FiscalConfig {
  habilitada: boolean;
  ambiente: Ambiente;
  cuit: string | null;
  razon_social: string | null;
  condicion_iva: string;
  iibb: string | null;
  inicio_actividades: string | null;
  domicilio_fiscal: string | null;
  leyenda_pie: string | null;
  cert_estado: 'sin_clave' | 'csr_generado' | 'activo';
  cert_ambiente: Ambiente | null;
  cert_subject: string | null;
  cert_vencimiento: string | null;
  cert_huella: string | null;
  csr_generado_at: string | null;
  ultima_prueba_at: string | null;
  ultima_prueba_ok: boolean | null;
  ultima_prueba_json: unknown;
}

export interface PuntoVenta { id: string; numero: number; modo: 'CAE' | 'CAEA'; domicilio: string | null; activo: boolean }

export async function leerConfig(): Promise<FiscalConfig> {
  const { rows: [c] } = await db.query(`SELECT * FROM fiscal_config WHERE id = 1`);
  return c as FiscalConfig;
}

export async function leerPuntosVenta(): Promise<PuntoVenta[]> {
  const { rows } = await db.query(`SELECT * FROM fiscal_puntos_venta ORDER BY modo, numero`);
  return rows as PuntoVenta[];
}
