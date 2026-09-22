import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { MontoInput } from '@/components/MontoInput';
import { fmtCantidad, fmtMoneda, nombreCliente, calcularTotalesForm, IVA_OPCIONES, type ProveedorMin, type ClienteMin, type Especificaciones } from './tipos';
import { inpCls, lblCls, btnPrimario, btnSecundario, SelectorProveedores, FichaTecnica } from './ui';

export interface ItemParaOrden {
  id: string;                       // solicitud_item_id
  descripcion: string;
  cantidad: number | string;
  unidad: string;
  costo_referencia: number | string | null;
  proveedor_sku?: string | null;
  especificaciones?: Especificaciones | null;
  cliente?: ClienteMin | null;
  solicitud_numero?: string | null;
}

export interface OrdenPayload {
  proveedor_id: string;
  costo_envio: number;
  forma_pago?: string;
  contacto_proveedor?: string;
  fecha_prometida?: string | null;
  notas?: string;
  items: { solicitud_item_id: string; cantidad: number; precio_unitario_neto: number; descuento_pct: number; iva_pct: number; proveedor_sku?: string }[];
}

interface LineaForm { id: string; cantidad: string; precio: string; desc: string; iva: number }

/**
 * Armado de una OC a partir de ítems de solicitud: proveedor + precio neto / desc / IVA por
 * línea + flete + condiciones. Totales en vivo con la misma fórmula del backend.
 */
export function FormOrden({ items, sugeridoId, proveedorFijoId, onSubmit, onCancel, enviando, labelSubmit = 'Crear orden de compra', mostrarCliente }: {
  items: ItemParaOrden[];
  sugeridoId?: string | null;
  /** Si viene, no se muestra el selector (p. ej. consolidar ya eligió proveedor). */
  proveedorFijoId?: string | null;
  onSubmit: (p: OrdenPayload) => void;
  onCancel?: () => void;
  enviando?: boolean;
  labelSubmit?: string;
  mostrarCliente?: boolean;
}) {
  const [proveedores, setProveedores] = useState<ProveedorMin[]>([]);
  const [proveedorId, setProveedorId] = useState<string>(proveedorFijoId ?? sugeridoId ?? '');
  const [lineas, setLineas] = useState<LineaForm[]>(() => items.map(i => ({
    id: i.id, cantidad: String(Number(i.cantidad)), precio: i.costo_referencia ? String(Number(i.costo_referencia)) : '', desc: '0', iva: 21,
  })));
  const [flete, setFlete] = useState('0');
  const [formaPago, setFormaPago] = useState('');
  const [contacto, setContacto] = useState('');
  const [fechaProm, setFechaProm] = useState('');
  const [notas, setNotas] = useState('');
  const [ivaGlobal, setIvaGlobal] = useState<number>(21);

  useEffect(() => {
    let vivo = true;
    api.get<ProveedorMin[]>('/catalogo/proveedores').then(ps => {
      if (!vivo) return;
      setProveedores(ps);
      // Contacto por defecto del proveedor preseleccionado (sugerido / fijo)
      const prov = ps.find(p => p.id === proveedorId);
      if (prov?.contacto) setContacto(c => c || prov.contacto!);
    }).catch(() => { if (vivo) setProveedores([]); });
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function elegirProveedor(id: string) {
    setProveedorId(id);
    const prov = proveedores.find(p => p.id === id);
    if (prov?.contacto) setContacto(c => c || prov.contacto!);
  }

  const up = (id: string, patch: Partial<LineaForm>) => setLineas(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));

  const tot = useMemo(() => calcularTotalesForm(lineas.map(l => ({
    cantidad: parseFloat(l.cantidad) || 0, precio: parseFloat(l.precio) || 0, desc: parseFloat(l.desc) || 0, iva: l.iva,
  })), parseFloat(flete) || 0), [lineas, flete]);

  const porItem = new Map(items.map(i => [i.id, i]));
  const valido = !!proveedorId && lineas.every(l => (parseFloat(l.cantidad) || 0) > 0);

  function enviar() {
    if (!valido) return;
    onSubmit({
      proveedor_id: proveedorId,
      costo_envio: parseFloat(flete) || 0,
      forma_pago: formaPago.trim() || undefined,
      contacto_proveedor: contacto.trim() || undefined,
      fecha_prometida: fechaProm || null,
      notas: notas.trim() || undefined,
      items: lineas.map(l => ({
        solicitud_item_id: l.id, cantidad: parseFloat(l.cantidad) || 1,
        precio_unitario_neto: parseFloat(l.precio) || 0, descuento_pct: parseFloat(l.desc) || 0, iva_pct: l.iva,
        proveedor_sku: porItem.get(l.id)?.proveedor_sku ?? undefined,
      })),
    });
  }

  return (
    <div className="space-y-4">
      {!proveedorFijoId && (
        <div>
          <label className={lblCls}>Proveedor</label>
          <SelectorProveedores proveedores={proveedores} seleccionados={proveedorId ? [proveedorId] : []} onChange={ids => elegirProveedor(ids[0] ?? '')} multiple={false} sugeridoId={sugeridoId} />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
          <label className={lblCls}>Precios (neto, sin IVA)</label>
          <div className="flex items-center gap-1 text-[11px] text-gray-600">
            IVA para todos:
            {IVA_OPCIONES.map(v => (
              <button key={v} type="button" onClick={() => { setIvaGlobal(v); setLineas(ls => ls.map(l => ({ ...l, iva: v }))); }}
                className={cn('px-2 h-7 rounded-md border text-[11px] font-semibold', ivaGlobal === v ? 'bg-lime-600 text-white border-lime-600' : 'bg-white border-gray-300 text-gray-700')}>
                {v}%
              </button>
            ))}
          </div>
        </div>
        {/* Mobile: tarjetas · Desktop: tabla — mismo componente */}
        <div className="space-y-2 sm:hidden">
          {lineas.map(l => {
            const it = porItem.get(l.id)!;
            return (
              <div key={l.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-900">{it.descripcion}</p>
                <FichaTecnica e={it.especificaciones} />
                {mostrarCliente && it.cliente && <p className="text-[11px] text-violet-700">{nombreCliente(it.cliente)} · {it.solicitud_numero}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lblCls}>Cantidad</label><input type="number" step="0.01" min="0.01" value={l.cantidad} onChange={e => up(l.id, { cantidad: e.target.value })} className={inpCls} /></div>
                  <div><label className={lblCls}>Precio neto</label><MontoInput value={l.precio} onChange={v => up(l.id, { precio: v })} className={inpCls} /></div>
                  <div><label className={lblCls}>Desc. %</label><input type="number" step="0.5" min="0" max="100" value={l.desc} onChange={e => up(l.id, { desc: e.target.value })} className={inpCls} /></div>
                  <div><label className={lblCls}>IVA</label>
                    <select value={l.iva} onChange={e => up(l.id, { iva: Number(e.target.value) })} className={inpCls}>{IVA_OPCIONES.map(v => <option key={v} value={v}>{v}%</option>)}</select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden sm:block overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Ítem</th>
                <th className="text-right px-2 py-2 w-24">Cant.</th>
                <th className="text-right px-2 py-2 w-36">P. unit. neto</th>
                <th className="text-right px-2 py-2 w-20">Desc. %</th>
                <th className="text-right px-2 py-2 w-24">IVA</th>
                <th className="text-right px-3 py-2 w-32">Neto línea</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineas.map(l => {
                const it = porItem.get(l.id)!;
                const cant = parseFloat(l.cantidad) || 0, precio = parseFloat(l.precio) || 0, d = parseFloat(l.desc) || 0;
                return (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{it.descripcion}</p>
                      <FichaTecnica e={it.especificaciones} />
                      {mostrarCliente && it.cliente && <p className="text-[11px] text-violet-700">{nombreCliente(it.cliente)} · {it.solicitud_numero}</p>}
                      {it.costo_referencia && <p className="text-[10px] text-gray-500">Ref.: {fmtMoneda(it.costo_referencia)}</p>}
                    </td>
                    <td className="px-2 py-2"><input type="number" step="0.01" min="0.01" value={l.cantidad} onChange={e => up(l.id, { cantidad: e.target.value })} className={cn(inpCls, 'text-right')} /></td>
                    <td className="px-2 py-2"><MontoInput value={l.precio} onChange={v => up(l.id, { precio: v })} className={cn(inpCls, 'text-right')} /></td>
                    <td className="px-2 py-2"><input type="number" step="0.5" min="0" max="100" value={l.desc} onChange={e => up(l.id, { desc: e.target.value })} className={cn(inpCls, 'text-right')} /></td>
                    <td className="px-2 py-2">
                      <select value={l.iva} onChange={e => up(l.id, { iva: Number(e.target.value) })} className={inpCls}>{IVA_OPCIONES.map(v => <option key={v} value={v}>{v}%</option>)}</select>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-800">{fmtMoneda(cant * precio * (1 - d / 100))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div><label className={lblCls}>Flete (sin IVA)</label><MontoInput value={flete} onChange={setFlete} className={inpCls} /></div>
        <div><label className={lblCls}>Entrega prometida</label><input type="date" value={fechaProm} onChange={e => setFechaProm(e.target.value)} className={inpCls} /></div>
        <div><label className={lblCls}>Forma de pago</label><input value={formaPago} onChange={e => setFormaPago(e.target.value)} placeholder="Ej: 50% anticipo, saldo contra entrega" className={inpCls} /></div>
        <div><label className={lblCls}>Contacto en el proveedor</label><input value={contacto} onChange={e => setContacto(e.target.value)} placeholder="Nombre" className={inpCls} /></div>
      </div>
      <div><label className={lblCls}>Observaciones para el proveedor</label><textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className={inpCls} /></div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2 border-t border-gray-200">
        <div className="text-sm text-gray-700 space-y-0.5">
          <div className="flex justify-between gap-8"><span>Subtotal neto</span><span className="tabular-nums">{fmtMoneda(tot.neto)}</span></div>
          {tot.desc > 0 && <div className="flex justify-between gap-8 text-amber-700"><span>Descuento</span><span className="tabular-nums">− {fmtMoneda(tot.desc)}</span></div>}
          <div className="flex justify-between gap-8"><span>IVA</span><span className="tabular-nums">{fmtMoneda(tot.iva)}</span></div>
          {tot.flete > 0 && <div className="flex justify-between gap-8"><span>Flete</span><span className="tabular-nums">{fmtMoneda(tot.flete)}</span></div>}
          <div className="flex justify-between gap-8 font-bold text-gray-900 text-base border-t border-gray-200 pt-1"><span>Total</span><span className="tabular-nums">{fmtMoneda(tot.total)}</span></div>
        </div>
        <div className="flex gap-2">
          {onCancel && <button type="button" onClick={onCancel} className={btnSecundario} disabled={enviando}>Volver</button>}
          <button type="button" onClick={enviar} disabled={!valido || enviando} className={btnPrimario}>{enviando ? 'Creando…' : labelSubmit}</button>
        </div>
      </div>
      {items.length > 0 && <p className="text-[11px] text-gray-500">{items.length} ítem{items.length === 1 ? '' : 's'} · {fmtCantidad(lineas.reduce((a, l) => a + (parseFloat(l.cantidad) || 0), 0))} unidades en total. La orden se crea en borrador: después la revisás y la enviás.</p>}
    </div>
  );
}
