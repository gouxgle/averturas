// CUIT/CUIL: 11 dígitos con dígito verificador módulo 11. Se valida localmente antes de
// llamar a ARCA (evita el ida y vuelta y el rechazo por documento inválido).

export function normalizarCuit(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

export function cuitValido(v: string | null | undefined): boolean {
  const c = normalizarCuit(v);
  if (!/^\d{11}$/.test(c)) return false;
  if (!['20', '23', '24', '25', '26', '27', '30', '33', '34'].includes(c.slice(0, 2))) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(c[i]), 0);
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return dv === Number(c[10]);
}

export function formatearCuit(v: string | null | undefined): string {
  const c = normalizarCuit(v);
  return c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c;
}
