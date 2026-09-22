import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  ClienteSchema,
  OperacionSchema,
  ReciboSchema,
  PedidoSchema,
  EstadoOperacionSchema,
  PedidoEstadoSchema,
  ProveedorSchema,
  SolicitudCompraSchema,
  CotizacionCrearSchema,
  CotizacionRespuestaSchema,
  OrdenDirectaSchema,
  OrdenConsolidarSchema,
  EnviarCompraSchema,
  ORIGENES_COMPRA,
  TIPOS_PRODUCTO_COMPRA,
  RecepcionSchema,
  SeguimientoSchema,
  EstadoLogisticaSchema,
  ConfirmacionOrdenSchema,
  IncidenciaRespuestaSchema,
  IncidenciaReclamarSchema,
  TIPOS_INCIDENCIA,
  SOLUCIONES_INCIDENCIA,
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

  it('rechaza forma_pago vacía', () => {
    // forma_pago es texto libre (no enum) — la única regla es que no sea vacío.
    expect(ReciboSchema.safeParse({ ...baseRecibo, forma_pago: '' }).success).toBe(false);
  });

  it('acepta forma_pago de texto libre', () => {
    expect(ReciboSchema.safeParse({ ...baseRecibo, forma_pago: 'Cheque a 30 días' }).success).toBe(true);
  });

  it('acepta las formas de pago habituales', () => {
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

  // Pago combinado — la suma contra monto_total se valida en la ruta (necesita el
  // total); acá solo la forma de cada entrada.
  it('acepta un desglose de medios de pago', () => {
    const r = ReciboSchema.safeParse({
      ...baseRecibo,
      pagos: [
        { forma_pago: 'Transferencia', monto: 60000, referencia: 'TR-1' },
        { forma_pago: 'Contado', monto: 40000 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('acepta un recibo sin desglose (modo por defecto)', () => {
    const r = ReciboSchema.safeParse(baseRecibo);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.pagos).toBeUndefined();
  });

  it('rechaza un medio de pago con monto cero o negativo', () => {
    expect(ReciboSchema.safeParse({
      ...baseRecibo, pagos: [{ forma_pago: 'Contado', monto: 0 }],
    }).success).toBe(false);
    expect(ReciboSchema.safeParse({
      ...baseRecibo, pagos: [{ forma_pago: 'Contado', monto: -100 }],
    }).success).toBe(false);
  });

  it('rechaza un medio de pago sin forma_pago', () => {
    expect(ReciboSchema.safeParse({
      ...baseRecibo, pagos: [{ forma_pago: '', monto: 1000 }],
    }).success).toBe(false);
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

// ── Compras: SolicitudCompraSchema ─────────────────────────────
const UUID_A = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const UUID_B = '9b2e7c1a-2f3d-4e5f-8a6b-7c8d9e0f1a2b';
const UUID_C = '0f1e2d3c-4b5a-4978-8765-4321fedcba98';

describe('SolicitudCompraSchema', () => {
  const base = {
    origen: 'venta',
    operacion_id: UUID_A,
    tipo_producto: 'abertura_medida',
    items: [{ descripcion: 'Ventana corrediza', cantidad: 2, especificaciones: { ancho_m: 1.2, alto_m: 1.5, color: 'Blanco' } }],
  };

  it('acepta solicitud válida y aplica defaults', () => {
    const r = SolicitudCompraSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.items[0].unidad).toBe('u');
      expect(r.data.adjuntos).toEqual([]);
    }
  });

  it.each(ORIGENES_COMPRA)('acepta origen "%s"', (origen) => {
    expect(SolicitudCompraSchema.safeParse({ ...base, origen }).success).toBe(true);
  });

  it.each(TIPOS_PRODUCTO_COMPRA)('acepta tipo_producto "%s"', (tipo_producto) => {
    expect(SolicitudCompraSchema.safeParse({ ...base, tipo_producto }).success).toBe(true);
  });

  it('rechaza origen inválido', () => {
    expect(SolicitudCompraSchema.safeParse({ ...base, origen: 'capricho' }).success).toBe(false);
  });

  it('rechaza sin ítems', () => {
    expect(SolicitudCompraSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });

  it('rechaza cantidad 0', () => {
    expect(SolicitudCompraSchema.safeParse({ ...base, items: [{ descripcion: 'X', cantidad: 0 }] }).success).toBe(false);
  });

  it('acepta cantidad decimal (perfiles en metros)', () => {
    const r = SolicitudCompraSchema.safeParse({ ...base, tipo_producto: 'perfil',
      items: [{ descripcion: 'Perfil 6 m', cantidad: 2.5, unidad: 'm', especificaciones: { largo_mm: 6000 } }] });
    expect(r.success).toBe(true);
  });

  it('rechaza unidad inválida', () => {
    expect(SolicitudCompraSchema.safeParse({ ...base, items: [{ descripcion: 'X', cantidad: 1, unidad: 'cajas' }] }).success).toBe(false);
  });

  it('rechaza medida no numérica en la ficha de una abertura', () => {
    const r = SolicitudCompraSchema.safeParse({ ...base, items: [{ descripcion: 'X', cantidad: 1, especificaciones: { ancho_m: 'uno veinte' } }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['items', 0, 'especificaciones', 'ancho_m']);
  });

  it('rechaza espesor negativo en un vidrio', () => {
    const r = SolicitudCompraSchema.safeParse({ ...base, tipo_producto: 'vidrio', items: [{ descripcion: 'DVH', cantidad: 1, especificaciones: { espesor_mm: -4 } }] });
    expect(r.success).toBe(false);
  });

  it('ignora claves de ficha que no aplican al tipo (no valida ancho_m en un herraje)', () => {
    const r = SolicitudCompraSchema.safeParse({ ...base, tipo_producto: 'herraje_accesorio', items: [{ descripcion: 'Cerradura', cantidad: 1, especificaciones: { ancho_m: 'n/a', marca: 'X' } }] });
    expect(r.success).toBe(true);
  });
});

// ── Compras: CotizacionCrearSchema ─────────────────────────────
describe('CotizacionCrearSchema', () => {
  const base = { solicitud_id: UUID_A, item_ids: [UUID_B], proveedor_ids: [UUID_C] };

  it('acepta cotización válida', () => {
    expect(CotizacionCrearSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza sin proveedores', () => {
    expect(CotizacionCrearSchema.safeParse({ ...base, proveedor_ids: [] }).success).toBe(false);
  });

  it('rechaza sin ítems', () => {
    expect(CotizacionCrearSchema.safeParse({ ...base, item_ids: [] }).success).toBe(false);
  });

  it('rechaza fecha límite mal formada', () => {
    expect(CotizacionCrearSchema.safeParse({ ...base, fecha_limite: '25/09/2026' }).success).toBe(false);
  });
});

// ── Compras: CotizacionRespuestaSchema ─────────────────────────
describe('CotizacionRespuestaSchema', () => {
  it('acepta respuesta con solo total de cabecera', () => {
    const r = CotizacionRespuestaSchema.safeParse({ subtotal_neto: 100000, iva_pct: 21, flete: 5000, plazo_dias: 15 });
    expect(r.success).toBe(true);
  });

  it('acepta respuesta con precios por ítem y sin cabecera', () => {
    const r = CotizacionRespuestaSchema.safeParse({ items: [{ solicitud_item_id: UUID_B, precio_unitario_neto: 45000 }] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.items?.[0].iva_pct).toBe(21);
      expect(r.data.items?.[0].descuento_pct).toBe(0);
    }
  });

  it('rechaza respuesta vacía (ni total ni ítems)', () => {
    expect(CotizacionRespuestaSchema.safeParse({ plazo_dias: 10 }).success).toBe(false);
  });

  it('acepta "sin respuesta" sin montos', () => {
    expect(CotizacionRespuestaSchema.safeParse({ sin_respuesta: true }).success).toBe(true);
  });

  it.each([0, 10.5, 21, 27])('acepta IVA %s%%', (iva_pct) => {
    expect(CotizacionRespuestaSchema.safeParse({ subtotal_neto: 1000, iva_pct }).success).toBe(true);
  });

  it.each([5, 19, 100])('rechaza IVA %s%%', (iva_pct) => {
    expect(CotizacionRespuestaSchema.safeParse({ subtotal_neto: 1000, iva_pct }).success).toBe(false);
  });

  it('rechaza neto negativo', () => {
    expect(CotizacionRespuestaSchema.safeParse({ subtotal_neto: -1 }).success).toBe(false);
  });

  it('rechaza descuento por ítem mayor a 100%', () => {
    expect(CotizacionRespuestaSchema.safeParse({ items: [{ solicitud_item_id: UUID_B, precio_unitario_neto: 100, descuento_pct: 120 }] }).success).toBe(false);
  });

  it('rechaza disponibilidad inválida', () => {
    expect(CotizacionRespuestaSchema.safeParse({ subtotal_neto: 100, disponibilidad: 'quizas' }).success).toBe(false);
  });
});

// ── Compras: órdenes ───────────────────────────────────────────
describe('OrdenDirectaSchema / OrdenConsolidarSchema', () => {
  const items = [{ solicitud_item_id: UUID_B, precio_unitario_neto: 1000, iva_pct: 21 }];

  it('acepta orden directa válida', () => {
    const r = OrdenDirectaSchema.safeParse({ solicitud_id: UUID_A, proveedor_id: UUID_C, items });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.costo_envio).toBe(0);
  });

  it('rechaza orden directa sin solicitud', () => {
    expect(OrdenDirectaSchema.safeParse({ proveedor_id: UUID_C, items }).success).toBe(false);
  });

  it('acepta consolidada sin solicitud (varias SC)', () => {
    expect(OrdenConsolidarSchema.safeParse({ proveedor_id: UUID_C, items }).success).toBe(true);
  });

  it('rechaza sin ítems', () => {
    expect(OrdenConsolidarSchema.safeParse({ proveedor_id: UUID_C, items: [] }).success).toBe(false);
  });

  it('rechaza flete negativo', () => {
    expect(OrdenConsolidarSchema.safeParse({ proveedor_id: UUID_C, items, costo_envio: -10 }).success).toBe(false);
  });
});

describe('EnviarCompraSchema', () => {
  it.each(['whatsapp', 'email', 'manual'])('acepta medio "%s"', (medio) => {
    expect(EnviarCompraSchema.safeParse({ medio }).success).toBe(true);
  });

  it('rechaza medio inválido', () => {
    expect(EnviarCompraSchema.safeParse({ medio: 'paloma' }).success).toBe(false);
  });
});

// ── Compras etapa 2: recepción ─────────────────────────────────
describe('RecepcionSchema', () => {
  const item = { pedido_item_id: UUID_B, cantidad_recibida: 2, cantidad_conforme: 2 };

  it('acepta una recepción completa', () => {
    const r = RecepcionSchema.safeParse({ items: [item] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.items[0].cantidad_problema).toBe(0);
      expect(r.data.items[0].no_recibido).toBe(false);
    }
  });

  it('acepta una recepción parcial con problema y reclamo', () => {
    const r = RecepcionSchema.safeParse({
      fecha: '2026-09-22', remito_proveedor_nro: 'R-1',
      items: [{ pedido_item_id: UUID_B, cantidad_recibida: 3, cantidad_conforme: 2, cantidad_problema: 1,
        incidencia_tipo: 'vidrio_roto', incidencia_descripcion: 'rajado', incidencia_adjuntos: ['/uploads/compras/a.webp'] }],
    });
    expect(r.success).toBe(true);
  });

  it('acepta marcar un ítem como no recibido', () => {
    expect(RecepcionSchema.safeParse({ items: [{ pedido_item_id: UUID_B, no_recibido: true }] }).success).toBe(true);
  });

  it('rechaza una recepción sin nada marcado', () => {
    const r = RecepcionSchema.safeParse({ items: [{ pedido_item_id: UUID_B, cantidad_recibida: 0 }] });
    expect(r.success).toBe(false);
  });

  it('rechaza sin ítems', () => {
    expect(RecepcionSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('rechaza cantidades negativas', () => {
    expect(RecepcionSchema.safeParse({ items: [{ ...item, cantidad_conforme: -1 }] }).success).toBe(false);
  });

  it('rechaza un tipo de problema inventado', () => {
    expect(RecepcionSchema.safeParse({ items: [{ ...item, incidencia_tipo: 'se_perdio' }] }).success).toBe(false);
  });

  it('acepta cantidades decimales (perfiles en metros)', () => {
    expect(RecepcionSchema.safeParse({ items: [{ pedido_item_id: UUID_B, cantidad_recibida: 2.5, cantidad_conforme: 2.5 }] }).success).toBe(true);
  });
});

// ── Compras etapa 2: logística y seguimiento ───────────────────
describe('EstadoLogisticaSchema', () => {
  it.each(['enviada', 'confirmada', 'en_fabricacion', 'en_transito', 'demorado', 'cancelada'])('acepta "%s"', (estado_logistica) => {
    expect(EstadoLogisticaSchema.safeParse({ estado_logistica }).success).toBe(true);
  });

  it('rechaza un estado inventado', () => {
    expect(EstadoLogisticaSchema.safeParse({ estado_logistica: 'en_camino' }).success).toBe(false);
  });
});

describe('SeguimientoSchema', () => {
  it('acepta una respuesta del proveedor', () => {
    const r = SeguimientoSchema.safeParse({ respuesta_proveedor: 'Sale el jueves' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBe('seguimiento');
  });

  it('acepta solo una fecha nueva', () => {
    expect(SeguimientoSchema.safeParse({ nueva_fecha_prometida: '2026-10-12' }).success).toBe(true);
  });

  it('rechaza un seguimiento vacío', () => {
    expect(SeguimientoSchema.safeParse({}).success).toBe(false);
  });

  it('rechaza fecha mal formada', () => {
    expect(SeguimientoSchema.safeParse({ nueva_fecha_prometida: '12/10/2026' }).success).toBe(false);
  });
});

describe('ConfirmacionOrdenSchema', () => {
  it('acepta la confirmación con defaults', () => {
    const r = ConfirmacionOrdenSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.confirmacion_recepcion).toBe(true);
  });

  it('acepta fecha prometida', () => {
    expect(ConfirmacionOrdenSchema.safeParse({ fecha_prometida: '2026-10-05', contacto: 'Juan' }).success).toBe(true);
  });
});

// ── Compras etapa 2: reclamos ──────────────────────────────────
describe('IncidenciaRespuestaSchema', () => {
  it.each(SOLUCIONES_INCIDENCIA.filter(s => s !== 'descuento' && s !== 'nota_credito'))('acepta solución "%s" sin monto', (solucion) => {
    expect(IncidenciaRespuestaSchema.safeParse({ solucion }).success).toBe(true);
  });

  it('exige monto en un descuento', () => {
    const r = IncidenciaRespuestaSchema.safeParse({ solucion: 'descuento' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['monto_descuento']);
  });

  it('exige monto en una nota de crédito', () => {
    expect(IncidenciaRespuestaSchema.safeParse({ solucion: 'nota_credito' }).success).toBe(false);
    expect(IncidenciaRespuestaSchema.safeParse({ solucion: 'nota_credito', monto_descuento: 5000 }).success).toBe(true);
  });

  it('rechaza una solución inventada', () => {
    expect(IncidenciaRespuestaSchema.safeParse({ solucion: 'lo_regalan' }).success).toBe(false);
  });

  it('rechaza sin solución', () => {
    expect(IncidenciaRespuestaSchema.safeParse({ respuesta_proveedor: 'ya te aviso' }).success).toBe(false);
  });
});

describe('IncidenciaReclamarSchema', () => {
  it.each(['whatsapp', 'email', 'manual'])('acepta medio "%s"', (medio) => {
    expect(IncidenciaReclamarSchema.safeParse({ medio }).success).toBe(true);
  });

  it('rechaza sin medio', () => {
    expect(IncidenciaReclamarSchema.safeParse({}).success).toBe(false);
  });

  it('tiene los 12 tipos de problema esperados', () => {
    expect(TIPOS_INCIDENCIA).toHaveLength(12);
    expect(TIPOS_INCIDENCIA).toContain('vidrio_roto');
  });
});

// ── ProveedorSchema ────────────────────────────────────────────
describe('ProveedorSchema', () => {
  it('acepta números en costo_flete / deuda_actual / margen_venta', () => {
    const result = ProveedorSchema.safeParse({
      nombre: 'Aluminios del Norte', costo_flete: 10, deuda_actual: 25000, margen_venta: 40,
    });
    expect(result.success).toBe(true);
  });

  it('coacciona strings de columnas NUMERIC (como las devuelve el driver pg)', () => {
    // El form de edición reenvía el valor tal cual vino del backend cuando el
    // usuario no toca el campo → llega "10.00" en vez de 10.
    const result = ProveedorSchema.safeParse({
      nombre: 'Aluminios del Norte', costo_flete: '10.00', deuda_actual: '25000.00', margen_venta: '40.00',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.costo_flete).toBe(10);
      expect(result.data.deuda_actual).toBe(25000);
      expect(result.data.margen_venta).toBe(40);
    }
  });

  it('aplica default 0 cuando el campo viene null', () => {
    const result = ProveedorSchema.safeParse({
      nombre: 'Sin datos', costo_flete: null, deuda_actual: null, margen_venta: null,
    });
    expect(result.success).toBe(true);
  });
});
