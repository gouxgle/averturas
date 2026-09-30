// CUIT/CUIL: 11 dígitos con dígito verificador módulo 11 (espejo de server/src/lib/fiscal/cuit.ts).
export function cuitValido(v: string | null | undefined): boolean {
  const c = String(v ?? '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(c) || !['20', '23', '24', '25', '26', '27', '30', '33', '34'].includes(c.slice(0, 2))) return false;
  const suma = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((a, p, i) => a + p * Number(c[i]), 0);
  const r = 11 - (suma % 11);
  return (r === 11 ? 0 : r === 10 ? 9 : r) === Number(c[10]);
}
