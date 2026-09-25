// Fecha "de hoy" en horario Argentina. `new Date().toISOString()` es UTC: desde las
// 21 h ya devuelve el día siguiente (y el último día del mes, el mes siguiente), así
// que un recibo emitido a las 22 h salía fechado mañana y numerado con el mes que
// viene. Es independiente de la variable TZ del proceso.
const TZ_AR = 'America/Argentina/Buenos_Aires';

/** YYYY-MM-DD del día calendario en Argentina. */
export function hoyAR(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ_AR });
}

/** YYYYMM del mes en Argentina — el que va en los números `XX-YYYYMM-NNNN`. */
export function mesAR(d: Date = new Date()): string {
  return hoyAR(d).slice(0, 7).replace('-', '');
}
