import { describe, it, expect, vi } from 'vitest';
import { toast } from 'sonner';
import { formatearErrorApi, toastApiError, CAMPO_LABELS, type ApiError } from '@/lib/apiError';

function errorConDetalle(detalle: { campo: string; mensaje: string }[]): ApiError {
  const e = new Error('Datos inválidos') as ApiError;
  e.detalle = detalle;
  return e;
}

describe('formatearErrorApi', () => {
  it('sin detalle, cae al mensaje genérico del error', () => {
    const r = formatearErrorApi(new Error('Error de red'));
    expect(r.titulo).toBe('Error de red');
    expect(r.lineas).toEqual([]);
    expect(r.primerItemIdx).toBeNull();
  });

  it('sin mensaje ni detalle, usa el fallback', () => {
    const r = formatearErrorApi({});
    expect(r.titulo).toBe('Error al guardar');
  });

  it('un error de un campo top-level', () => {
    const r = formatearErrorApi(errorConDetalle([{ campo: 'cliente_id', mensaje: 'ID inválido' }]));
    expect(r.lineas).toEqual(['cliente_id: ID inválido']);
    expect(r.primerItemIdx).toBeNull();
  });

  it('traduce el campo con labelCampo', () => {
    const r = formatearErrorApi(
      errorConDetalle([{ campo: 'cliente_id', mensaje: 'ID inválido' }]),
      { labelCampo: c => CAMPO_LABELS[c] ?? c },
    );
    expect(r.lineas).toEqual(['Cliente: ID inválido']);
  });

  it('reconoce el patrón items.N.campo y extrae el índice', () => {
    const r = formatearErrorApi(
      errorConDetalle([{ campo: 'items.2.descripcion', mensaje: 'Descripción requerida' }]),
    );
    expect(r.primerItemIdx).toBe(2);
    expect(r.lineas).toEqual(['Ítem 3 — descripcion: Descripción requerida']);
  });

  it('usa labelItem y labelCampo juntos para items.N.campo', () => {
    const r = formatearErrorApi(
      errorConDetalle([{ campo: 'items.0.precio_unitario', mensaje: 'Requerido' }]),
      {
        labelCampo: c => CAMPO_LABELS[c] ?? c,
        labelItem: idx => `Ítem ${idx + 1} (Ventana Módena)`,
      },
    );
    expect(r.lineas).toEqual(['Ítem 1 (Ventana Módena) — Precio unitario: Requerido']);
  });

  it('el primer error con índice de ítem gana, aunque no sea el primero de la lista', () => {
    const r = formatearErrorApi(errorConDetalle([
      { campo: 'forma_pago', mensaje: 'Requerido' },
      { campo: 'items.4.cantidad', mensaje: 'Debe ser > 0' },
    ]));
    expect(r.primerItemIdx).toBe(4);
    expect(r.lineas).toHaveLength(2);
  });

  it('varios errores en distintos ítems: primerItemIdx es el del primero encontrado', () => {
    const r = formatearErrorApi(errorConDetalle([
      { campo: 'items.1.descripcion', mensaje: 'Descripción requerida' },
      { campo: 'items.3.cantidad', mensaje: 'Debe ser > 0' },
    ]));
    expect(r.primerItemIdx).toBe(1);
    expect(r.lineas).toHaveLength(2);
  });

  it('no confunde un campo top-level que empieza con "items" pero no matchea el patrón', () => {
    // path como ['items'] solo (sin índice) — ej. array vacío con .min(1)
    const r = formatearErrorApi(errorConDetalle([{ campo: 'items', mensaje: 'Se requiere al menos 1 ítem' }]));
    expect(r.primerItemIdx).toBeNull();
    expect(r.lineas).toEqual(['items: Se requiere al menos 1 ítem']);
  });

  it('usa el fallback del llamador cuando no hay detalle ni message', () => {
    const r = formatearErrorApi({}, { fallback: 'Error al enviar WhatsApp' });
    expect(r.titulo).toBe('Error al enviar WhatsApp');
  });
});

describe('toastApiError', () => {
  it('sin detalle, llama a toast.error con un solo argumento (comportamiento de siempre)', () => {
    const spy = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
    toastApiError(new Error('Error de red'));
    expect(spy).toHaveBeenCalledWith('Error de red');
    spy.mockRestore();
  });

  it('sin detalle ni message, usa el fallback', () => {
    const spy = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
    toastApiError({}, { fallback: 'No se pudo enviar' });
    expect(spy).toHaveBeenCalledWith('No se pudo enviar');
    spy.mockRestore();
  });

  it('con detalle, llama a toast.error con título + description con todas las líneas', () => {
    const spy = vi.spyOn(toast, 'error').mockImplementation(() => '' as any);
    toastApiError(
      errorConDetalle([
        { campo: 'nombre', mensaje: 'Nombre requerido' },
        { campo: 'email', mensaje: 'Email inválido' },
      ]),
      { labelCampo: c => CAMPO_LABELS[c] ?? c },
    );
    expect(spy).toHaveBeenCalledWith('Revisá estos datos', {
      description: 'Nombre: Nombre requerido\nEmail: Email inválido',
      duration: 10000,
    });
    spy.mockRestore();
  });
});
