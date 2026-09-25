import { useEffect, useMemo, useState } from 'react';
import { Wallet, Check, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, fechaDiaAR } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { MontoInput } from '@/components/MontoInput';
import {
  MEDIO_PAGO_LABEL, ESTADO_LOGISTICA, fmtFecha, fmtMoneda, nombreCliente,
  type MedioPagoProveedor, type OrdenRow, type ControlEconomico,
} from './tipos';
import { ModalShell, Seccion, AdjuntosGrid, DropzoneAdjuntos, inpCls, lblCls, btnPrimario, btnSecundario } from './ui';

interface OrdenAPagar {
  orden: OrdenRow;
  saldo: number;
  facturado: number;
}

/**
 * Registrar un pago al proveedor y repartirlo entre sus órdenes impagas. Lo que no se
 * aplica queda como saldo a favor y se puede usar después en otra orden.
 */
export function ModalPago({ proveedorId, proveedorNombre, pedidoId, onClose, onHecho }: {
  proveedorId: string;
  proveedorNombre: string;
  /** Si viene, la orden arranca preseleccionada con su saldo. */
  pedidoId?: string;
  onClose: () => void;
  onHecho: () => void;
}) {
  const [ordenes, setOrdenes] = useState<OrdenAPagar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fecha, setFecha] = useState(fechaDiaAR(new Date()));
  const [importe, setImporte] = useState('');
  const [medio, setMedio] = useState<MedioPagoProveedor>('transferencia');
  const [nroOperacion, setNroOperacion] = useState('');
  const [comprobantes, setComprobantes] = useState<string[]>([]);
  const [observacion, setObservacion] = useState('');
  const [aplic, setAplic] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const ocs = await api.get<OrdenRow[]>(`/compras/ordenes?estado=todas&proveedor_id=${proveedorId}`);
        const impagas = ocs.filter(o => ['pendiente', 'pago_parcial'].includes(o.estado_finanzas) || o.id === pedidoId);
        const detalles = await Promise.all(impagas.slice(0, 40).map(async o => {
          const ce = await api.get<ControlEconomico>(`/compras/ordenes/${o.id}/control-economico`).catch(() => null);
          return { orden: o, saldo: ce ? Number(ce.saldo) : 0, facturado: ce ? Number(ce.facturado) : 0 };
        }));
        if (!vivo) return;
        const conSaldo = detalles.filter(d => d.saldo > 0.01);
        setOrdenes(conSaldo);
        if (pedidoId) {
          const sel = conSaldo.find(d => d.orden.id === pedidoId);
          if (sel) { setAplic({ [pedidoId]: String(sel.saldo) }); setImporte(String(sel.saldo)); }
        }
      } catch { toast.error('No se pudieron cargar las órdenes'); }
      finally { if (vivo) setCargando(false); }
    })();
    return () => { vivo = false; };
  }, [proveedorId, pedidoId]);

  const totalAplicado = useMemo(() => Object.values(aplic).reduce((a, v) => a + (parseFloat(v) || 0), 0), [aplic]);
  const imp = parseFloat(importe) || 0;
  const sinAplicar = Math.round((imp - totalAplicado) * 100) / 100;
  const excede = totalAplicado - imp > 0.01;
  const valido = imp > 0 && !excede;

  function toggleOrden(o: OrdenAPagar) {
    setAplic(a => {
      if (a[o.orden.id] !== undefined) {
        const resto = { ...a };
        delete resto[o.orden.id];
        return resto;
      }
      // Lo que queda del pago, hasta cubrir el saldo de esa orden
      const disponible = Math.max(0, imp - Object.values(a).reduce((s, v) => s + (parseFloat(v) || 0), 0));
      const monto = imp > 0 ? Math.min(o.saldo, disponible) : o.saldo;
      return { ...a, [o.orden.id]: String(Math.round(monto * 100) / 100) };
    });
  }

  /** Reparte el importe entre las órdenes con saldo, de la más vieja a la más nueva. */
  function repartirTodo() {
    let resto = imp;
    const nuevo: Record<string, string> = {};
    for (const o of ordenes) {
      if (resto <= 0.01) break;
      const monto = Math.min(o.saldo, resto);
      nuevo[o.orden.id] = String(Math.round(monto * 100) / 100);
      resto = Math.round((resto - monto) * 100) / 100;
    }
    setAplic(nuevo);
  }

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    try {
      await api.post('/compras/pagos', {
        proveedor_id: proveedorId, fecha, importe: imp, medio,
        nro_operacion: nroOperacion.trim() || undefined,
        comprobantes, observacion: observacion.trim() || undefined,
        aplicaciones: Object.entries(aplic)
          .map(([pedido_id, v]) => ({ pedido_id, monto: parseFloat(v) || 0 }))
          .filter(a => a.monto > 0),
      });
      toast.success(sinAplicar > 0.01
        ? `Pago registrado · ${fmtMoneda(sinAplicar)} quedan como saldo a favor`
        : 'Pago registrado');
      onHecho();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo registrar el pago' }); }
    finally { setGuardando(false); }
  }

  return (
    <ModalShell
      icon={<Wallet size={20} />} iconCls="bg-emerald-50 text-emerald-700"
      titulo={`Pago a ${proveedorNombre}`}
      subtitulo="Registrá el pago y repartilo entre las órdenes que estás cancelando"
      onClose={onClose} ancho="sm:max-w-2xl"
      pie={
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <p className="text-xs text-gray-600">
            {imp <= 0 ? 'Poné el importe del pago.'
              : excede ? <span className="text-red-600 font-semibold">Estás aplicando {fmtMoneda(totalAplicado)} y el pago es de {fmtMoneda(imp)}.</span>
              : sinAplicar > 0.01 ? <>Aplicás {fmtMoneda(totalAplicado)} · <strong>{fmtMoneda(sinAplicar)}</strong> quedan a favor para otra orden.</>
              : <>Aplicás los {fmtMoneda(imp)} completos.</>}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className={btnSecundario} disabled={guardando}>Cancelar</button>
            <button onClick={guardar} disabled={!valido || guardando} className={cn(btnPrimario, 'bg-emerald-600 hover:bg-emerald-700')}>
              {guardando ? 'Registrando…' : 'Registrar pago'}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div><label className={lblCls}>Importe</label><MontoInput value={importe} onChange={setImporte} className={inpCls} /></div>
        <div><label className={lblCls}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inpCls} /></div>
        <div><label className={lblCls}>Medio</label>
          <select value={medio} onChange={e => setMedio(e.target.value as MedioPagoProveedor)} className={inpCls}>
            {(Object.keys(MEDIO_PAGO_LABEL) as MedioPagoProveedor[]).map(m => <option key={m} value={m}>{MEDIO_PAGO_LABEL[m]}</option>)}
          </select>
        </div>
        <div><label className={lblCls}>N° de operación</label><input value={nroOperacion} onChange={e => setNroOperacion(e.target.value)} className={inpCls} placeholder="Opcional" /></div>
        <div className="sm:col-span-2 lg:col-span-4"><label className={lblCls}>Observación</label><input value={observacion} onChange={e => setObservacion(e.target.value)} className={inpCls} /></div>
      </div>

      <Seccion titulo="Comprobantes">
        <AdjuntosGrid urls={comprobantes} size="sm" onRemove={u => setComprobantes(a => a.filter(x => x !== u))} />
        <div className="mt-2"><DropzoneAdjuntos compacto onAdd={u => setComprobantes(a => [...a, u])} /></div>
        <p className="text-[11px] text-gray-500 mt-1">Se archivan solos en la carpeta de cada orden que pagues.</p>
      </Seccion>

      <Seccion titulo={`Órdenes con saldo (${ordenes.length})`}
        accion={ordenes.length > 1 && imp > 0 && (
          <button onClick={repartirTodo} className="text-[11px] text-lime-700 font-semibold hover:underline">Repartir el importe</button>
        )}>
        {cargando ? <p className="text-sm text-gray-500">Cargando órdenes…</p>
        : ordenes.length === 0 ? (
          <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-xl border border-gray-200">
            Este proveedor no tiene órdenes con saldo. El pago se va a registrar como <strong>saldo a favor</strong>, listo para aplicar cuando cargues una factura.
          </p>
        ) : (
          <div className="space-y-2">
            {ordenes.map(o => {
              const marcado = aplic[o.orden.id] !== undefined;
              const est = ESTADO_LOGISTICA[o.orden.estado_logistica];
              return (
                <div key={o.orden.id} className={cn('border rounded-xl p-3', marcado ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200')}>
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => toggleOrden(o)}
                      className={cn('w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center shrink-0',
                        marcado ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300 bg-white')}>
                      {marcado && <Check size={12} />}
                    </button>
                    <div className="flex-1 min-w-0" onClick={() => toggleOrden(o)} role="button" tabIndex={-1}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-gray-700">{o.orden.numero}</span>
                        <span className="text-sm font-semibold text-gray-900 truncate">{o.orden.proveedor.nombre}</span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', est.cls)}>{est.label}</span>
                      </div>
                      <p className="text-[11px] text-gray-600">
                        {fmtFecha(o.orden.fecha_pedido)} · facturado {fmtMoneda(o.facturado)} · <strong className="text-amber-700">debe {fmtMoneda(o.saldo)}</strong>
                        {o.orden.operacion && ` · ${nombreCliente(o.orden.operacion.cliente)}`}
                      </p>
                    </div>
                    {marcado && (
                      <div className="w-32 shrink-0">
                        <label className={lblCls}>Aplicar</label>
                        <MontoInput value={aplic[o.orden.id]} onChange={v => setAplic(a => ({ ...a, [o.orden.id]: v }))} className={cn(inpCls, 'text-right')} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Seccion>

      {excede && (
        <p className="text-xs text-red-700 flex items-center gap-1.5"><AlertTriangle size={13} /> No podés aplicar más de lo que estás pagando.</p>
      )}
    </ModalShell>
  );
}
