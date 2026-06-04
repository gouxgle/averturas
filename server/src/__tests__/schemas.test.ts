import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  ClienteSchema,
  OperacionSchema,
  ReciboSchema,
  PedidoSchema,
  EstadoOperacionSchema,
  PedidoEstadoSchema,
} from '../lib/schemas.js';

// ── LoginSchema ────────────────────────────────────────────────
describe('LoginSchema', () => {
  it('acepta credenciales válidas', () => {
    const result = LoginSchema.safeParse({ email: 'admin@test.com', password: '123456' });
    expect(result.success).toBe(true);
  });

  it('rechaza email inválido', () => {
    const result = LoginSchema.safeParse({ email: 'no-es-email', password: '123' });
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña vacía', () => {
    const result = LoginSchema.safeParse({ email: 'admin@test.com', password: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza body vacío', () => {
    expect(LoginSchema.safeParse({}).success).toBe(false);
  });
});

// ── ClienteSchema ──────────────────────────────────────────────
describe('ClienteSchema', () => {
  const basePersonaFisica = {
    tipo_persona: 'fisica' as const,
    nombre: 'Juan',
    apellido: 'Pérez',
  };

  it('acepta persona física válida', () => {
    expect(ClienteSchema.safeParse(basePersonaFisica).success).toBe(true);
  });

  it('acepta persona jurídica válida', () => {
    const data = { tipo_persona: 'juridica', razon_social: 'Mi Empresa SRL' };
    expect(ClienteSchema.safeParse(data).success).toBe(true);
  });

  it('rechaza persona física sin nombre ni apellido', () => {
    const result = ClienteSchema.safeParse({ tipo_persona: 'fisica' });
    expect(result.success).toBe(false);
  });

  it('rechaza persona jurídica sin razón social', () => {
    const result = ClienteSchema.safeParse({ tipo_persona: 'juridica' });
    expect(result.success).toBe(false);
  });

  it('rechaza email inválido', () => {
    const result = ClienteSchema.safeParse({ ...basePersonaFisica, email: 'no-email' });
    expect(result.success).toBe(false);
  });

  it('acepta email nulo', () => {
    const result = ClienteSchema.safeParse({ ...basePersonaFisica, email: null });
    expect(result.success).toBe(true);
  });

  it('rechaza tipo_persona inválido', () => {
    const result = ClienteSchema.safeParse({ tipo_persona: 'empresa', nombre: 'X' });
    expect(result.success).toBe(false);
  });
});

// ── OperacionSchema ────────────────────────────────────────────
describe('OperacionSchema', () => {
  const itemValido = {
    descripcion: 'Ventana 1.20x1.00',
    cantidad: 2,
    precio_unitario: 50000,
  };

  const baseOp = {
    tipo: 'a_medida_proveedor' as const,
    cliente_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    items: [itemValido],
  };

  it('acepta operación válida', () => {
    expect(OperacionSchema.safeParse(baseOp).success).toBe(true);
  });

  it('rechaza sin items', () => {
    const result = OperacionSchema.safeParse({ ...baseOp, items: [] });
    expect(result.success).toBe(false);
  });

  it('rechaza cliente_id con formato inválido', () => {
    const result = OperacionSchema.safeParse({ ...baseOp, cliente_id: 'no-es-uuid' });
    expect(result.success).toBe(false);
  });

  it('rechaza cantidad 0 en item', () => {
    const result = OperacionSchema.safeParse({
      ...baseOp,
      items: [{ ...itemValido, cantidad: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza precio negativo en item', () => {
    const result = OperacionSchema.safeParse({
      ...baseOp,
      items: [{ ...itemValido, precio_unitario: -100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza fecha_validez con formato incorrecto', () => {
    const result = OperacionSchema.safeParse({ ...baseOp, fecha_validez: '03/06/2026' });
    expect(result.success).toBe(false);
  });

  it('acepta fecha_validez en formato YYYY-MM-DD', () => {
    const result = OperacionSchema.safeParse({ ...baseOp, fecha_validez: '2026-12-31' });
    expect(result.success).toBe(true);
  });

  it('aplica default tipo a_medida_proveedor', () => {
    const result = OperacionSchema.safeParse({ cliente_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', items: [itemValido] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tipo).toBe('a_medida_proveedor');
  });
});

// ── EstadoOperacionSchema ──────────────────────────────────────
describe('EstadoOperacionSchema', () => {
  const estadosValidos = ['presupuesto','enviado','aprobado','en_produccion','listo','instalado','entregado','cancelado','rechazado'];

  it.each(estadosValidos)('acepta estado "%s"', (estado) => {
    expect(EstadoOperacionSchema.safeParse({ estado }).success).toBe(true);
  });

  it('rechaza estado inválido', () => {
    expect(EstadoOperacionSchema.safeParse({ estado: 'vendido' }).success).toBe(false);
  });

  it('rechaza sin estado', () => {
    expect(EstadoOperacionSchema.safeParse({}).success).toBe(false);
  });
});

// ── ReciboSchema ───────────────────────────────────────────────
describe('ReciboSchema', () => {
  const baseRecibo = {
    cliente_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    monto_total: 150000,
    forma_pago: 'Contado' as const,
  };

  it('acepta recibo válido', () => {
    expect(ReciboSchema.safeParse(baseRecibo).success).toBe(true);
  });

  it('rechaza monto negativo', () => {
    expect(ReciboSchema.safeParse({ ...baseRecibo, monto_total: -1 }).success).toBe(false);
  });

  it('rechaza monto cero', () => {
    expect(ReciboSchema.safeParse({ ...baseRecibo, monto_total: 0 }).success).toBe(false);
  });

  it('rechaza forma_pago inválida', () => {
    const result = ReciboSchema.safeParse({ ...baseRecibo, forma_pago: 'Bitcoin' });
    expect(result.success).toBe(false);
  });

  it('acepta todas las formas de pago válidas', () => {
    const formas = [
      'Contado',
      'Tarjeta de débito/crédito en 1 pago',
      'Transferencia',
      'Tarjeta de crédito 3 cuotas sin interés',
    ];
    formas.forEach(forma_pago => {
      expect(ReciboSchema.safeParse({ ...baseRecibo, forma_pago }).success).toBe(true);
    });
  });

  it('rechaza cliente_id con formato inválido', () => {
    expect(ReciboSchema.safeParse({ ...baseRecibo, cliente_id: 'no-es-uuid' }).success).toBe(false);
  });
});

// ── PedidoSchema ───────────────────────────────────────────────
describe('PedidoSchema', () => {
  const basePedido = {
    proveedor_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    items: [{ descripcion: 'Perfil aluminio', cantidad: 10, costo_unitario: 2500 }],
  };

  it('acepta pedido válido', () => {
    expect(PedidoSchema.safeParse(basePedido).success).toBe(true);
  });

  it('rechaza sin items', () => {
    expect(PedidoSchema.safeParse({ ...basePedido, items: [] }).success).toBe(false);
  });

  it('rechaza cantidad negativa en item', () => {
    const result = PedidoSchema.safeParse({
      ...basePedido,
      items: [{ descripcion: 'X', cantidad: -1, costo_unitario: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza costo unitario negativo', () => {
    const result = PedidoSchema.safeParse({
      ...basePedido,
      items: [{ descripcion: 'X', cantidad: 1, costo_unitario: -50 }],
    });
    expect(result.success).toBe(false);
  });
});

// ── PedidoEstadoSchema ─────────────────────────────────────────
describe('PedidoEstadoSchema', () => {
  it.each(['pendiente','enviado','recibido','cancelado'])('acepta estado "%s"', (estado) => {
    expect(PedidoEstadoSchema.safeParse({ estado }).success).toBe(true);
  });

  it('rechaza estado inválido', () => {
    expect(PedidoEstadoSchema.safeParse({ estado: 'procesando' }).success).toBe(false);
  });
});
