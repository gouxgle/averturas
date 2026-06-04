import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

describe('formatCurrency', () => {
  it('formatea número positivo en ARS', () => {
    const result = formatCurrency(50000);
    expect(result).toContain('50.000');
  });

  it('formatea cero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('formatea número con decimales', () => {
    const result = formatCurrency(1500.5);
    expect(result).toContain('1.500');
  });

  it('retorna string', () => {
    expect(typeof formatCurrency(100)).toBe('string');
  });
});

describe('formatDate', () => {
  it('formatea fecha ISO string', () => {
    // Usar mediodía para evitar problemas de timezone
    const result = formatDate('2026-06-15T12:00:00');
    expect(result).toContain('15');
    expect(result).toContain('06');
    expect(result).toContain('2026');
  });

  it('formatea objeto Date', () => {
    const date = new Date(2026, 5, 15, 12, 0, 0); // 15 jun 2026
    const result = formatDate(date);
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('retorna string', () => {
    expect(typeof formatDate('2026-01-01T12:00:00')).toBe('string');
  });
});

describe('cn', () => {
  it('combina clases simples', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('resuelve conflictos Tailwind', () => {
    // tailwind-merge: p-4 gana sobre p-2
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('ignora valores falsy', () => {
    expect(cn('foo', false && 'bar', undefined, 'baz')).toBe('foo baz');
  });

  it('acepta condicionales', () => {
    const active = true;
    expect(cn('base', active && 'active')).toBe('base active');
  });
});
