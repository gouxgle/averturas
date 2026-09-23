import { useCallback, useEffect, useState } from 'react';
import {
  Wallet, FolderOpen, Receipt, Plus, FileText, Trash2, AlertTriangle, Check, Lock, ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { MontoInput } from '@/components/MontoInput';
import {
  TIPO_DOC_LABEL, DOCS_REQUERIDOS, MOTIVO_DIFERENCIA_LABEL, MEDIO_PAGO_LABEL, ESTADO_FINANZAS,
  fmtFecha, fmtMoneda, esPdf,
  type OrdenDetalle, type ControlEconomico, type ChecklistCierre, type DocumentoCompra,
  type MotivoDiferencia, type TipoDocumento,
} from './tipos';
import { Seccion, AdjuntosGrid, DropzoneAdjuntos, Badge, inpCls, lblCls, btnPrimario, btnSecundario } from './ui';
import { ModalPago } from './ModalPago';

/**
 * Control económico, carpeta de documentos y cierre de una OC. Vive en el detalle de la
 * orden: es la parte "plata y papeles" de la compra (etapa 3 del módulo).
 */
export function PanelEconomico({ oc, onChanged }: { oc: OrdenDetalle; onChanged: () => void }) {
  const [ce, setCe] = useState<ControlEconomico | null>(null);
  const [docs, setDocs] = useState<DocumentoCompra[]>([]);
  const [chk, setChk] = useState<ChecklistCierre | null>(null);
  const [panel, setPanel] = useState<null | 'factura' | 'nota' | 'documento'>(null);
  const [pagando, setPagando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // factura
  const [fNumero, setFNumero] = useState('');
  const [fFecha, setFFecha] = useState(new Date().toISOString().slice(0, 10));
  const [fNeto, setFNeto] = useState('');
  const [fIva, setFIva] = useState('');
  const [fTotal, setFTotal] = useState('');
  const [fUrl, setFUrl] = useState<string | null>(null);
  const [fMotivo, setFMotivo] = useState<MotivoDiferencia | ''>('');
  const [fObs, setFObs] = useState('');
  // nota
  const [nTipo, setNTipo] = useState<'credito' | 'debito'>('credito');
  const [nNumero, setNNumero] = useState('');
  const [nMonto, setNMonto] = useState('');
  const [nConcepto, setNConcepto] = useState('');
  const [nUrl, setNUrl] = useState<string | null>(null);
  // documento suelto
  const [dTipo, setDTipo] = useState<TipoDocumento>('otro');
  const [dUrl, setDUrl] = useState<string | null>(null);
  const [dNombre, setDNombre] = useState('');

  const cargar = useCallback(async () => {
    const [c, d, k] = await Promise.all([
      api.get<ControlEconomico>(`/compras/ordenes/${oc.id}/control-economico`).catch(() => null),
      api.get<DocumentoCompra[]>(`/compras/ordenes/${oc.id}/documentos`).catch(() => []),
      api.get<ChecklistCierre>(`/compras/ordenes/${oc.id}/cierre`).catch(() => null),
    ]);
    setCe(c); setDocs(d); setChk(k);
  }, [oc.id]);

  useEffect(() => { cargar(); }, [cargar]);

  // El total de la factura se calcula solo mientras no lo toquen a mano
  useEffect(() => {
    const neto = parseFloat(fNeto) || 0, iva = parseFloat(fIva) || 0;
    if (neto > 0) setFTotal(String(Math.round((neto + iva) * 100) / 100));
  }, [fNeto, fIva]);

  if (!ce) return null;

  const diferencia = Math.round(((parseFloat(fTotal) || 0) + ce.facturado - ce.orden) * 100) / 100;
  const necesitaMotivo = Math.abs(diferencia) > 0.01;
  const estF = ESTADO_FINANZAS[ce.estado_finanzas];

  async function guardarFactura() {
    setOcupado(true);
    try {
      await api.post('/compras/facturas', {
        proveedor_id: oc.proveedor.id, pedido_id: oc.id, numero: fNumero.trim(), fecha: fFecha,
        subtotal_neto: parseFloat(fNeto) || 0, iva_monto: parseFloat(fIva) || 0, total: parseFloat(fTotal) || 0,
        url: fUrl ?? undefined, diferencia_motivo: fMotivo || undefined, diferencia_obs: fObs.trim() || undefined,
      });
      toast.success('Factura cargada');
      setPanel(null); setFNumero(''); setFNeto(''); setFIva(''); setFTotal(''); setFUrl(null); setFMotivo(''); setFObs('');
      onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo cargar la factura' }); }
    finally { setOcupado(false); }
  }

  async function borrarFactura(id: string, numero: string) {
    setOcupado(true);
    try {
      await api.delete(`/compras/facturas/${id}`);
      toast.success(`Factura ${numero} eliminada`);
      onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo eliminar' }); }
    finally { setOcupado(false); }
  }

  async function guardarNota() {
    setOcupado(true);
    try {
      await api.post('/compras/notas', {
        proveedor_id: oc.proveedor.id, pedido_id: oc.id, tipo: nTipo,
        numero: nNumero.trim() || undefined, monto: parseFloat(nMonto) || 0,
        concepto: nConcepto.trim() || undefined, url: nUrl ?? undefined,
      });
      toast.success(nTipo === 'credito' ? 'Nota de crédito registrada' : 'Nota de débito registrada');
      setPanel(null); setNNumero(''); setNMonto(''); setNConcepto(''); setNUrl(null);
      onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo registrar la nota' }); }
    finally { setOcupado(false); }
  }

  async function guardarDocumento() {
    if (!dUrl) return;
    setOcupado(true);
    try {
      await api.post(`/compras/ordenes/${oc.id}/documentos`, { tipo: dTipo, url: dUrl, nombre: dNombre.trim() || undefined });
      toast.success('Documento agregado');
      setPanel(null); setDUrl(null); setDNombre(''); setDTipo('otro');
      onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo agregar' }); }
    finally { setOcupado(false); }
  }

  async function borrarDocumento(id: string) {
    setOcupado(true);
    try {
      await api.delete(`/compras/ordenes/${oc.id}/documentos/${id}`);
      onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo eliminar' }); }
    finally { setOcupado(false); }
  }

  async function cerrar() {
    setOcupado(true);
    try {
      await api.post(`/compras/ordenes/${oc.id}/cerrar`, { control_realizado: true });
      toast.success('Compra cerrada');
      onChanged(); await cargar();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo cerrar' }); }
    finally { setOcupado(false); }
  }

  const col = (label: string, valor: number, cls?: string) => (
    <div className="flex-1 min-w-[110px] p-2.5 rounded-xl border border-gray-200 bg-gray-50">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-600">{label}</p>
      <p className={cn('text-base font-black tabular-nums text-gray-900', cls)}>{fmtMoneda(valor)}</p>
    </div>
  );

  return (
    <>
      {/* Control económico */}
      <Seccion titulo="Control económico"
        accion={<Badge label={estF.label} cls={estF.cls} />}>
        <div className="flex flex-wrap gap-2">
          {ce.cotizado > 0 && col('Cotizado', ce.cotizado)}
          {col('Orden', ce.orden)}
          {col('Facturado', ce.facturado, ce.facturado > 0 && Math.abs(ce.facturado - ce.orden) > 0.01 ? 'text-amber-700' : undefined)}
          {ce.pagado > 0 && col('Pagado', ce.pagado, 'text-emerald-700')}
          {ce.creditos > 0 && col('Créditos', ce.creditos, 'text-emerald-700')}
          {col(ce.saldo < -0.01 ? 'A favor' : 'Saldo', Math.abs(ce.saldo),
            ce.saldo < -0.01 ? 'text-sky-700' : ce.saldo > 0.01 ? 'text-amber-700' : 'text-emerald-700')}
        </div>

        {ce.facturado > 0 && Math.abs(ce.facturado - ce.orden) > 0.01 && (
          <div className="mt-2 p-2.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
            <strong>Facturó {ce.facturado > ce.orden ? 'de más' : 'de menos'}: {fmtMoneda(Math.abs(ce.facturado - ce.orden))}.</strong>{' '}
            {ce.facturas.filter(f => f.diferencia_motivo).map(f => (
              <span key={f.id}>{MOTIVO_DIFERENCIA_LABEL[f.diferencia_motivo!]}{f.diferencia_obs ? ` — ${f.diferencia_obs}` : ''}. </span>
            ))}
          </div>
        )}

        {/* Facturas */}
        {ce.facturas.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {ce.facturas.map(f => (
              <div key={f.id} className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-xl">
                <Receipt size={14} className="text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">Factura {f.numero}</p>
                  <p className="text-[11px] text-gray-600">
                    {fmtFecha(f.fecha)} · neto {fmtMoneda(f.subtotal_neto)} + IVA {fmtMoneda(f.iva_monto)}
                    {Math.abs(Number(f.diferencia_vs_oc)) > 0.01 && (
                      <span className="text-amber-700"> · diferencia {fmtMoneda(Number(f.diferencia_vs_oc))}</span>
                    )}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-gray-800 shrink-0">{fmtMoneda(f.total)}</span>
                {f.url && (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 shrink-0" title="Ver factura">
                    <ExternalLink size={13} />
                  </a>
                )}
                <button onClick={() => borrarFactura(f.id, f.numero)} disabled={ocupado}
                  className="w-9 h-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0" title="Eliminar factura">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pagos aplicados */}
        {ce.pagos.length > 0 && (
          <div className="mt-2 space-y-1">
            {ce.pagos.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-[11px] text-gray-700">
                <Wallet size={11} className="text-emerald-600 shrink-0" />
                <span>{fmtFecha(p.fecha)} · {MEDIO_PAGO_LABEL[p.medio]}{p.nro_operacion ? ` ${p.nro_operacion}` : ''}</span>
                <span className="ml-auto font-semibold tabular-nums text-emerald-700">{fmtMoneda(p.monto_aplicado ?? p.importe)}</span>
              </div>
            ))}
            {ce.notas.map(n => (
              <div key={n.id} className="flex items-center gap-2 text-[11px] text-gray-700">
                <Receipt size={11} className={n.tipo === 'credito' ? 'text-emerald-600 shrink-0' : 'text-amber-600 shrink-0'} />
                <span>{fmtFecha(n.fecha)} · {n.tipo === 'credito' ? 'Nota de crédito' : 'Nota de débito'}{n.numero ? ` ${n.numero}` : ''}{n.concepto ? ` — ${n.concepto}` : ''}</span>
                <span className={cn('ml-auto font-semibold tabular-nums', n.tipo === 'credito' ? 'text-emerald-700' : 'text-amber-700')}>{fmtMoneda(n.monto)}</span>
              </div>
            ))}
          </div>
        )}

        {panel === null && oc.estado_logistica !== 'cancelada' && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => { setPanel('factura'); setFTotal(String(Math.max(0, ce.orden - ce.facturado))); setFNeto(''); setFIva(''); }} className={btnSecundario}>
              <Plus size={14} /> Cargar factura
            </button>
            {ce.saldo > 0.01 && (
              <button onClick={() => setPagando(true)} className={cn(btnPrimario, 'bg-emerald-600 hover:bg-emerald-700')}>
                <Wallet size={14} /> Pagar {fmtMoneda(ce.saldo)}
              </button>
            )}
            <button onClick={() => setPanel('nota')} className={btnSecundario}>Nota de crédito / débito</button>
          </div>
        )}
      </Seccion>

      {panel === 'factura' && (
        <div className="p-4 rounded-xl border border-gray-300 bg-gray-50 space-y-3">
          <p className="text-sm font-bold text-gray-900">Cargar factura del proveedor</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2"><label className={lblCls}>Número</label><input value={fNumero} onChange={e => setFNumero(e.target.value)} className={inpCls} placeholder="A-0001-00001234" autoFocus /></div>
            <div><label className={lblCls}>Fecha</label><input type="date" value={fFecha} onChange={e => setFFecha(e.target.value)} className={inpCls} /></div>
            <div><label className={lblCls}>Neto</label><MontoInput value={fNeto} onChange={setFNeto} className={inpCls} /></div>
            <div><label className={lblCls}>IVA</label><MontoInput value={fIva} onChange={setFIva} className={inpCls} /></div>
            <div><label className={lblCls}>Total</label><MontoInput value={fTotal} onChange={setFTotal} className={cn(inpCls, 'font-semibold')} /></div>
          </div>
          {necesitaMotivo && (
            <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 space-y-2">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle size={13} /> No coincide con la orden ({diferencia > 0 ? '+' : ''}{fmtMoneda(diferencia)}) — decí por qué
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><label className={lblCls}>Motivo</label>
                  <select value={fMotivo} onChange={e => setFMotivo(e.target.value as MotivoDiferencia)} className={inpCls}>
                    <option value="">Elegir…</option>
                    {(Object.keys(MOTIVO_DIFERENCIA_LABEL) as MotivoDiferencia[]).map(m => <option key={m} value={m}>{MOTIVO_DIFERENCIA_LABEL[m]}</option>)}
                  </select>
                </div>
                <div><label className={lblCls}>Detalle</label><input value={fObs} onChange={e => setFObs(e.target.value)} className={inpCls} /></div>
              </div>
            </div>
          )}
          <div>
            <label className={lblCls}>PDF o foto de la factura</label>
            <AdjuntosGrid urls={fUrl ? [fUrl] : []} size="sm" onRemove={() => setFUrl(null)} />
            {!fUrl && <div className="mt-1"><DropzoneAdjuntos compacto onAdd={setFUrl} /></div>}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setPanel(null)} className={btnSecundario} disabled={ocupado}>Volver</button>
            <button onClick={guardarFactura} disabled={ocupado || !fNumero.trim() || !(parseFloat(fTotal) > 0) || (necesitaMotivo && !fMotivo)} className={btnPrimario}>
              {ocupado ? 'Guardando…' : 'Guardar factura'}
            </button>
          </div>
        </div>
      )}

      {panel === 'nota' && (
        <div className="p-4 rounded-xl border border-gray-300 bg-gray-50 space-y-3">
          <p className="text-sm font-bold text-gray-900">Nota de crédito / débito</p>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button onClick={() => setNTipo('credito')} className={cn('px-3 h-9 rounded-md text-xs font-semibold', nTipo === 'credito' ? 'bg-white shadow text-emerald-700' : 'text-gray-600')}>Crédito (nos descuenta)</button>
            <button onClick={() => setNTipo('debito')} className={cn('px-3 h-9 rounded-md text-xs font-semibold', nTipo === 'debito' ? 'bg-white shadow text-amber-700' : 'text-gray-600')}>Débito (nos cobra más)</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className={lblCls}>Número</label><input value={nNumero} onChange={e => setNNumero(e.target.value)} className={inpCls} /></div>
            <div><label className={lblCls}>Monto</label><MontoInput value={nMonto} onChange={setNMonto} className={inpCls} /></div>
            <div className="col-span-2"><label className={lblCls}>Concepto</label><input value={nConcepto} onChange={e => setNConcepto(e.target.value)} className={inpCls} placeholder="Ej: bonificación por el vidrio roto" /></div>
          </div>
          <div>
            <label className={lblCls}>Archivo</label>
            <AdjuntosGrid urls={nUrl ? [nUrl] : []} size="sm" onRemove={() => setNUrl(null)} />
            {!nUrl && <div className="mt-1"><DropzoneAdjuntos compacto onAdd={setNUrl} /></div>}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setPanel(null)} className={btnSecundario} disabled={ocupado}>Volver</button>
            <button onClick={guardarNota} disabled={ocupado || !(parseFloat(nMonto) > 0)} className={btnPrimario}>{ocupado ? 'Guardando…' : 'Registrar'}</button>
          </div>
        </div>
      )}

      {/* Carpeta de documentos */}
      <Seccion titulo={`Documentos (${docs.length})`}
        accion={panel === null && (
          <button onClick={() => setPanel('documento')} className="text-[11px] text-lime-700 font-semibold hover:underline">Agregar</button>
        )}>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {DOCS_REQUERIDOS.map(t => {
            const tiene = docs.some(d => d.tipo === t);
            // El remito solo hace falta si hubo alguna entrega
            if (t === 'remito' && !['recibida', 'recibida_parcial', 'cerrada'].includes(oc.estado_logistica) && !tiene) return null;
            return (
              <span key={t} className={cn('inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-1 border',
                tiene ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200 border-dashed')}>
                {tiene ? <Check size={10} /> : <span className="w-2.5 h-2.5 rounded-full border border-current inline-block" />}
                {TIPO_DOC_LABEL[t]}
              </span>
            );
          })}
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay documentos. Se archivan solos al enviar la orden, recibir la mercadería y cargar la factura.</p>
        ) : (
          <div className="space-y-1.5">
            {docs.map(d => (
              <div key={d.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded-xl">
                <span className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                  {esPdf(d.url) ? <FileText size={14} className="text-red-600" /> : <img src={d.url} alt="" className="w-full h-full object-cover" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{d.nombre ?? TIPO_DOC_LABEL[d.tipo]}</p>
                  <p className="text-[10px] text-gray-600">{TIPO_DOC_LABEL[d.tipo]}{d.fecha ? ` · ${fmtFecha(d.fecha)}` : ''}{d.monto ? ` · ${fmtMoneda(d.monto)}` : ''}</p>
                </div>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 shrink-0"><ExternalLink size={13} /></a>
                <button onClick={() => borrarDocumento(d.id)} disabled={ocupado}
                  className="w-9 h-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      {panel === 'documento' && (
        <div className="p-4 rounded-xl border border-gray-300 bg-gray-50 space-y-3">
          <p className="text-sm font-bold text-gray-900">Agregar documento a la carpeta</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lblCls}>Tipo</label>
              <select value={dTipo} onChange={e => setDTipo(e.target.value as TipoDocumento)} className={inpCls}>
                {(Object.keys(TIPO_DOC_LABEL) as TipoDocumento[]).map(t => <option key={t} value={t}>{TIPO_DOC_LABEL[t]}</option>)}
              </select>
            </div>
            <div><label className={lblCls}>Nombre</label><input value={dNombre} onChange={e => setDNombre(e.target.value)} className={inpCls} placeholder="Opcional" /></div>
          </div>
          <AdjuntosGrid urls={dUrl ? [dUrl] : []} size="sm" onRemove={() => setDUrl(null)} />
          {!dUrl && <DropzoneAdjuntos compacto onAdd={setDUrl} />}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setPanel(null)} className={btnSecundario} disabled={ocupado}>Volver</button>
            <button onClick={guardarDocumento} disabled={ocupado || !dUrl} className={btnPrimario}>Agregar</button>
          </div>
        </div>
      )}

      {/* Cierre */}
      {chk && oc.estado_logistica !== 'cancelada' && (
        <Seccion titulo="Cierre de la compra">
          <div className="space-y-1.5">
            {chk.items.map(i => (
              <div key={i.clave} className="flex items-center gap-2 text-xs">
                {i.ok ? <Check size={13} className="text-emerald-600 shrink-0" />
                  : <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" />}
                <span className={i.ok ? 'text-gray-700' : 'text-gray-500'}>{i.label}</span>
                {i.detalle && <span className="text-amber-700">— {i.detalle}</span>}
              </div>
            ))}
          </div>
          {oc.cerrada_totalmente_at ? (
            <div className="mt-3 p-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 flex items-center gap-3">
              <Lock size={18} className="text-emerald-700 shrink-0" />
              <div>
                <p className="text-sm font-black text-emerald-800 uppercase tracking-wide">Cerrada totalmente</p>
                <p className="text-[11px] text-emerald-700">Mercadería, reclamos, factura, pago y papeles: todo en orden desde el {fmtFecha(oc.cerrada_totalmente_at)}.</p>
              </div>
            </div>
          ) : oc.estado_logistica !== 'cerrada' && (
            <button onClick={cerrar} disabled={ocupado || !chk.puede_cerrar}
              className={cn(btnSecundario, 'mt-3 w-full')} title={chk.puede_cerrar ? '' : 'Todavía falta algo'}>
              <FolderOpen size={14} /> {chk.puede_cerrar ? 'Cerrar la compra' : 'No se puede cerrar todavía'}
            </button>
          )}
        </Seccion>
      )}

      {pagando && (
        <ModalPago proveedorId={oc.proveedor.id} proveedorNombre={oc.proveedor.nombre} pedidoId={oc.id}
          onClose={() => setPagando(false)}
          onHecho={() => { setPagando(false); onChanged(); cargar(); }} />
      )}
    </>
  );
}
