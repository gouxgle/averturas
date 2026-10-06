// Fórmula de precio de los productos estándar (copia de server/src/lib/precios.ts, para
// calcular en pantalla mientras se editan los números, sin guardar):
//   precio = (costo ÷ divisor × (1 + recargo)) + costo × adicional
//   → redondeo hacia arriba a un número terminado en `terminación` (203.666,67 → 203.900).

export interface Formula {
  id: string; nombre: string; divisor: number; recargo_pct: number; adicional_costo_pct: number;
  redondeo_paso: number; redondeo_terminacion: number;
  tipo_abertura_id: string | null; proveedor_id: string | null; activa: boolean;
}
export type ParametrosFormula = Pick<Formula, 'divisor' | 'recargo_pct' | 'adicional_costo_pct' | 'redondeo_paso' | 'redondeo_terminacion'>;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function redondearTerminacion(x: number, paso: number, terminacion: number): number {
  if (!(paso > 0)) return r2(x);
  return Math.ceil((r2(x) - terminacion) / paso - 1e-9) * paso + terminacion;
}

export interface PasoFormula { texto: string; valor: number }

export function precioPorFormula(costo: number, f: ParametrosFormula): { precio: number; pasos: PasoFormula[] } {
  const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const reserva = r2(costo * f.adicional_costo_pct / 100);
  const dividido = r2(costo / f.divisor);
  const conRecargo = r2(dividido * (1 + f.recargo_pct / 100));
  const suma = r2(conRecargo + reserva);
  const precio = redondearTerminacion(suma, f.redondeo_paso, f.redondeo_terminacion);
  return {
    precio,
    pasos: [
      { texto: `${num(f.adicional_costo_pct)} % del costo (se reserva)`, valor: reserva },
      { texto: `Costo ÷ ${num(f.divisor)}`, valor: dividido },
      { texto: `+ ${num(f.recargo_pct)} %`, valor: conRecargo },
      { texto: `+ el ${num(f.adicional_costo_pct)} % reservado`, valor: suma },
      { texto: f.redondeo_paso > 0 ? `Redondeo hacia arriba terminado en ${f.redondeo_terminacion}` : 'Sin redondeo', valor: precio },
    ],
  };
}

/** La más específica: familia + proveedor > familia > proveedor > general. Solo productos estándar. */
export function elegirFormula(formulas: Formula[], p: { tipo?: string | null; tipo_abertura_id: string | null; proveedor_id: string | null }): Formula | null {
  if (p.tipo !== 'estandar') return null;
  let mejor: Formula | null = null;
  let max = -1;
  for (const f of formulas) {
    if (!f.activa || (f.tipo_abertura_id && f.tipo_abertura_id !== p.tipo_abertura_id) || (f.proveedor_id && f.proveedor_id !== p.proveedor_id)) continue;
    const s = (f.tipo_abertura_id ? 2 : 0) + (f.proveedor_id ? 1 : 0);
    if (s > max) { max = s; mejor = f; }
  }
  return mejor;
}

export function posibleErrorCarga(costo: number, precio: number): boolean {
  if (!(costo > 0) || !(precio > 0)) return false;
  if (costo <= 10) return true;
  const m = precio / costo;
  return m < 1.2 || m > 4;
}

export type GrupoFormula = 'debajo' | 'en' | 'encima' | 'error' | 'excluido';

/** En qué grupo cae un producto al compararlo con la fórmula (umbral en %). */
export function clasificarContraFormula(p: { precio: number; costo: number; precio_manual: boolean; formula: boolean },
  precioFormula: number | null, umbral: number): GrupoFormula {
  if (!p.formula || p.precio_manual) return 'excluido';
  if (!(p.costo > 0) || !(p.precio > 0) || posibleErrorCarga(p.costo, p.precio) || precioFormula === null) return 'error';
  const desvio = (p.precio / precioFormula - 1) * 100;
  if (desvio <= -umbral) return 'debajo';
  if (desvio >= umbral) return 'encima';
  return 'en';
}
