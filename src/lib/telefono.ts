// Teléfonos: los de Argentina se cargan como "código de área + número" ("3704 322616") y los del
// exterior con su código de país y un "+" adelante ("+595 972454770"). El "+" es lo que distingue un
// número extranjero: sin él, todo se trata como argentino (se le agrega 549 para WhatsApp).
// Misma regla que normalizarNumeroAR() en server/src/lib/whatsapp.ts (si cambia una, cambiar la otra).

export interface PaisTel { codigo: string; pais: string; ejemplo: string }

/** Países de la zona, los más comunes primero. "Otro" permite escribir cualquier código. */
export const PAISES_TEL: PaisTel[] = [
  { codigo: '595', pais: 'Paraguay', ejemplo: '972454770' },
  { codigo: '55', pais: 'Brasil', ejemplo: '11987654321' },
  { codigo: '598', pais: 'Uruguay', ejemplo: '94123456' },
  { codigo: '591', pais: 'Bolivia', ejemplo: '71234567' },
  { codigo: '56', pais: 'Chile', ejemplo: '912345678' },
  { codigo: '1', pais: 'EE. UU. / Canadá', ejemplo: '3055551234' },
  { codigo: '34', pais: 'España', ejemplo: '612345678' },
];

const digitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

/** ¿Es un número del exterior? Empieza con "+" (o "00") y el código de país no es el 54 de Argentina. */
export function esTelefonoExterior(tel: string | null | undefined): boolean {
  const t = (tel ?? '').trim();
  if (!t.startsWith('+') && !t.startsWith('00')) return false;
  const d = digitos(t).replace(/^00/, '');
  return d.length > 0 && !d.startsWith('54');
}

/** "+595 972454770" → { codigo: '595', numero: '972454770' }. Sin espacio, reconoce los códigos de la lista. */
export function partirExterior(tel: string | null | undefined): { codigo: string; numero: string } {
  const t = (tel ?? '').trim().replace(/^00/, '+');
  const m = t.match(/^\+\s*(\d{1,3})[\s\-.)]+(.*)$/);
  if (m) return { codigo: m[1], numero: digitos(m[2]) };
  const d = digitos(t);
  const conocido = [...PAISES_TEL].sort((a, b) => b.codigo.length - a.codigo.length).find(p => d.startsWith(p.codigo));
  const largo = conocido ? conocido.codigo.length : 3;
  return { codigo: d.slice(0, largo), numero: d.slice(largo) };
}

/** Cómo se guarda un número del exterior: "+595 972454770". */
export function armarExterior(codigo: string, numero: string): string {
  const c = digitos(codigo), n = digitos(numero);
  return c || n ? `+${c}${n ? ` ${n}` : ''}` : '';
}

/** Valida un número del exterior; devuelve el problema o null si está bien. */
export function validarExterior(codigo: string, numero: string): string | null {
  const c = digitos(codigo), n = digitos(numero);
  if (!c) return 'Falta el código de país';
  if (c.length > 3) return 'El código de país tiene hasta 3 dígitos';
  if (c === '54') return 'El 54 es Argentina: destildá "Número del exterior" y cargalo con el código de área';
  if (n.length < 6) return 'El número es muy corto';
  if (c.length + n.length > 15) return 'El número es demasiado largo (máximo 15 dígitos con el código de país)';
  return null;
}

/** Número para WhatsApp (wa.me / Evolution): el del exterior tal cual, el argentino con 549 adelante. */
export function numeroWhatsapp(tel: string | null | undefined): string {
  if (esTelefonoExterior(tel)) return digitos(tel).replace(/^00/, '');
  const d = digitos(tel);
  if (!d) return '';
  if (d.startsWith('549') && d.length >= 13) return d;
  if (d.startsWith('54') && d.length >= 12) return `549${d.slice(2)}`;
  if (d.startsWith('0') && d.length >= 11) return `549${d.slice(1)}`;
  return `549${d}`;
}

/** Para mostrar: "+595 972 454 770" (de a 3) en el exterior; el argentino queda como se cargó. */
export function mostrarTelefono(tel: string | null | undefined): string {
  if (!esTelefonoExterior(tel)) return tel ?? '';
  const { codigo, numero } = partirExterior(tel);
  return `+${codigo} ${numero.replace(/(\d{3})(?=\d)/g, '$1 ')}`.trim();
}
