import { describe, it, expect } from 'vitest';
import { disponibilidadProducto, ningunProveedorConPlazo } from '../disponibilidad';
import type { Producto } from '@/types';

function prod(over: Partial<Producto>): Producto {
  return { id: 'x', nombre: 'P', stock_actual: 0, ...over } as unknown as Producto;
}
const hoyIso = new Date().toISOString();
const hace30 = new Date(Date.now() - 30 * 86400000).toISOString();

describe('disponibilidadProducto — las 4 ramas', () => {
  it('con stock ⇒ inmediata, 0 días', () => {
    const d = disponibilidadProducto(prod({ stock_actual: 3 }));
    expect(d.estado).toBe('inmediata');
    expect(d.dias).toBe(0);
    expect(d.rank).toBe(0);
  });

  it('el stock gana sobre el plazo del proveedor', () => {
    const d = disponibilidadProducto(prod({
      stock_actual: 1,
      proveedor: { id: 'p', nombre: 'X', plazo_entrega_dias: 30 },
    } as unknown as Partial<Producto>));
    expect(d.estado).toBe('inmediata');
  });

  it('sin stock pero con disponibilidad confirmada vigente ⇒ confirmada', () => {
    const d = disponibilidadProducto(prod({ disponibilidad_confirmada_at: hoyIso } as unknown as Partial<Producto>));
    expect(d.estado).toBe('confirmada');
  });

  it('una confirmación vencida no cuenta — cae al plazo declarado', () => {
    const d = disponibilidadProducto(prod({
      disponibilidad_confirmada_at: hace30,
      proveedor: { id: 'p', nombre: 'X', plazo_entrega_dias: 12 },
    } as unknown as Partial<Producto>));
    expect(d.estado).toBe('estimada');
    expect(d.dias).toBe(12);
  });

  it('solo plazo declarado ⇒ estimada, con ≈ en el label', () => {
    const d = disponibilidadProducto(prod({
      proveedor: { id: 'p', nombre: 'Alumar', plazo_entrega_dias: 7 },
    } as unknown as Partial<Producto>));
    expect(d.estado).toBe('estimada');
    expect(d.label).toBe('≈ 7 días');
    expect(d.detalle).toContain('Alumar');
  });

  it('sin nada ⇒ desconocida, sin días y con el rank más alto posible', () => {
    const d = disponibilidadProducto(prod({}));
    expect(d.estado).toBe('desconocida');
    expect(d.dias).toBeNull();
    expect(d.rank).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('un producto sin proveedor no rompe', () => {
    expect(() => disponibilidadProducto(prod({ proveedor: null } as unknown as Partial<Producto>))).not.toThrow();
  });
});

describe('honestidad del dato', () => {
  it('el detalle de un plazo estimado aclara que es del proveedor y no del producto', () => {
    const d = disponibilidadProducto(prod({
      proveedor: { id: 'p', nombre: 'Monpat', plazo_entrega_dias: 15 },
    } as unknown as Partial<Producto>));
    expect(d.detalle).toContain('no confirmado para este producto');
  });

  it('ningún label promete una fecha de calendario', () => {
    const casos = [
      prod({ stock_actual: 2 }),
      prod({ disponibilidad_confirmada_at: hoyIso } as unknown as Partial<Producto>),
      prod({ proveedor: { id: 'p', nombre: 'X', plazo_entrega_dias: 9 } } as unknown as Partial<Producto>),
      prod({}),
    ];
    for (const c of casos) {
      const { label } = disponibilidadProducto(c);
      expect(label).not.toMatch(/llega|entrega el|garantizad/i);
    }
  });
});

describe('ningunProveedorConPlazo', () => {
  it('true cuando ningún producto trae plazo', () => {
    expect(ningunProveedorConPlazo([
      prod({}),
      prod({ proveedor: { id: 'p', nombre: 'X', plazo_entrega_dias: null } } as unknown as Partial<Producto>),
    ])).toBe(true);
  });
  it('false apenas uno lo tiene', () => {
    expect(ningunProveedorConPlazo([
      prod({}),
      prod({ proveedor: { id: 'p', nombre: 'X', plazo_entrega_dias: 4 } } as unknown as Partial<Producto>),
    ])).toBe(false);
  });
});
