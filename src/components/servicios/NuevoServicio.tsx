import { useEffect, useState } from 'react';
import { Wrench, Loader2, PackageSearch, PenLine, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { cn, fechaDiaAR } from '@/lib/utils';
import { BuscadorContacto, type Contacto } from '@/components/agenda/BuscadorContacto';
import { AdjuntosGrid, DropzoneAdjuntos } from '@/components/Adjuntos';
import {
  TIPO_SERVICIO, ENDPOINT_ADJUNTOS_SERVICIO, ACCEPT_ADJUNTOS_SERVICIO, fechaCortaServicio, mesesDesde,
  type TipoServicio, type ServicioConIntervenciones,
} from '@/lib/servicios';
import { ModalBase } from './ModalBase';
import { areaCls, btnPrim, btnSec, campoCls, etiquetaCls } from './estilos';

interface Producto {
  remito_item_id: string; descripcion: string; cantidad: number; producto_id: string | null;
  remito_id: string; remito_numero: string; fecha_entrega: string; operacion_id: string | null; operacion_numero: string | null;
  servicios_previos: number;
}
interface Preparado {
  origen: string; postventa_seguimiento_id: string | null; problema: string | null;
  cliente: Contacto; operacion_id: string | null; operacion_numero: string | null; remito_id: string | null;
}

/**
 * Abre (o corrige) la ficha de un servicio técnico. `desde` precarga cliente y pedido: un seguimiento de post venta
 * («Generar servicio»), un remito, un presupuesto o la ficha del cliente.
 */
export function NuevoServicio({ desde, servicio, onClose, onGuardado }: {
  desde?: { postventa_id?: string; remito_id?: string; operacion_id?: string; cliente_id?: string };
  servicio?: ServicioConIntervenciones;
  onClose: () => void;
  onGuardado: (id: string) => void;
}) {
  const editando = !!servicio;
  const [prep, setPrep] = useState<Preparado | null>(null);
  const [cargandoPrep, setCargandoPrep] = useState(!!desde && !editando);
  const [cliente, setCliente] = useState<Contacto | null>(servicio
    ? { id: servicio.cliente_id, nombre: servicio.cliente_nombre ?? '—', detalle: [servicio.cliente_telefono, servicio.cliente_localidad].filter(Boolean).join(' · ') }
    : null);
  const [productos, setProductos] = useState<{ cliente: string; lista: Producto[]; meses: number } | null>(null);
  const [soloPedido, setSoloPedido] = useState(true);
  const [itemId, setItemId] = useState<string | null>(servicio?.remito_item_id ?? null);
  const [manual, setManual] = useState(!!servicio && !servicio.remito_item_id);
  const [descripcion, setDescripcion] = useState(servicio && !servicio.remito_item_id ? (servicio.producto_descripcion ?? '') : '');
  const [tipo, setTipo] = useState<TipoServicio | null>(servicio?.tipo ?? null);
  const [problema, setProblema] = useState(servicio?.problema ?? '');
  const [fecha, setFecha] = useState(servicio?.fecha_reclamo ?? fechaDiaAR(new Date()));
  const [adjuntos, setAdjuntos] = useState<string[]>(servicio?.adjuntos ?? []);
  const [guardando, setGuardando] = useState(false);

  const desdeKey = desde ? new URLSearchParams(Object.entries(desde).filter(([, v]) => v) as [string, string][]).toString() : '';
  useEffect(() => {
    if (!desdeKey || editando) return;
    api.get<Preparado>(`/servicios-tecnicos/preparar?${desdeKey}`)
      .then(p => { setPrep(p); setCliente(p.cliente); if (p.problema) setProblema(x => x || p.problema!); })
      .catch(e => toastApiError(e, { fallback: 'No se pudieron traer los datos' }))
      .finally(() => setCargandoPrep(false));
  }, [desdeKey, editando]);

  const operacionFiltro = soloPedido ? (prep?.operacion_id ?? null) : null;
  const clienteId = cliente?.id ?? null;
  const claveProductos = `${clienteId}|${operacionFiltro ?? ''}`;
  useEffect(() => {
    if (!clienteId) return;
    const q = new URLSearchParams({ cliente_id: clienteId, ...(operacionFiltro ? { operacion_id: operacionFiltro } : {}) });
    let vivo = true;
    api.get<{ productos: Producto[]; garantia_meses: number }>(`/servicios-tecnicos/productos-cliente?${q}`)
      .then(r => { if (vivo) setProductos({ cliente: `${clienteId}|${operacionFiltro ?? ''}`, lista: r.productos, meses: r.garantia_meses }); })
      .catch(() => { if (vivo) setProductos({ cliente: `${clienteId}|${operacionFiltro ?? ''}`, lista: [], meses: 12 }); });
    return () => { vivo = false; };
  }, [clienteId, operacionFiltro]);
  const lista = productos?.cliente === claveProductos ? productos.lista : null;
  const elegido = lista?.find(p => p.remito_item_id === itemId) ?? null;
  const meses = elegido ? mesesDesde(elegido.fecha_entrega) : null;
  const enGarantia = meses !== null && productos ? meses < productos.meses : null;

  function elegir(p: Producto) {
    setItemId(p.remito_item_id); setManual(false);
    // Sugerencia: si está dentro del plazo de garantía y todavía no se eligió el tipo
    const m = mesesDesde(p.fecha_entrega);
    if (!tipo && productos && m !== null) setTipo(m < productos.meses ? 'garantia' : 'reparacion');
  }

  const completo = !!cliente && !!tipo && problema.trim().length >= 3 && !!fecha;

  async function guardar() {
    if (!completo || guardando) return;
    setGuardando(true);
    const body = {
      cliente_id: cliente!.id, tipo, problema: problema.trim(), fecha_reclamo: fecha, adjuntos,
      remito_item_id: manual ? null : itemId,
      producto_descripcion: manual ? (descripcion.trim() || null) : null,
      operacion_id: manual ? (prep?.operacion_id ?? servicio?.operacion_id ?? null) : null,
      remito_id: manual ? (prep?.remito_id ?? null) : null,
      origen: servicio?.origen ?? prep?.origen ?? 'manual',
      postventa_seguimiento_id: servicio?.postventa_seguimiento_id ?? prep?.postventa_seguimiento_id ?? null,
    };
    try {
      if (servicio) {
        await api.put(`/servicios-tecnicos/${servicio.id}`, body);
        toast.success('Ficha actualizada');
        onGuardado(servicio.id);
      } else {
        const r = await api.post<{ id: string; numero: string }>('/servicios-tecnicos', body);
        toast.success(`Servicio ${r.numero} abierto`, { description: 'Ahora podés asignar el responsable y programar la visita.' });
        onGuardado(r.id);
      }
    } catch (e) {
      toastApiError(e, { fallback: 'No se pudo guardar el servicio' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalBase titulo={editando ? `Editar ${servicio!.numero}` : 'Nuevo servicio técnico'} icono={<Wrench size={18} className="text-teal-700" />}
      onClose={onClose} ancho="sm:max-w-2xl" testId="modal-nuevo-servicio"
      pie={<>
        <button onClick={onClose} className={btnSec}>Cancelar</button>
        <button onClick={guardar} disabled={!completo || guardando} className={btnPrim} data-testid="guardar-servicio">
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />} {editando ? 'Guardar cambios' : 'Abrir servicio'}
        </button>
      </>}>
      {cargandoPrep ? (
        <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : (
        <>
          <div>
            <label className={etiquetaCls} htmlFor="st-cli">Cliente</label>
            <div className="mt-1">
              {editando || prep
                ? <div className="min-h-10 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50">
                    <p className="text-sm font-semibold text-gray-900">{cliente?.nombre}</p>
                    {cliente?.detalle && <p className="text-[11px] text-gray-600">{cliente.detalle}</p>}
                  </div>
                : <BuscadorContacto id="st-cli" tipo="cliente" valor={cliente}
                    onChange={c => { setCliente(c); setItemId(null); }} autoFocus />}
            </div>
          </div>

          {cliente && (
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className={etiquetaCls}>Producto</p>
                {prep?.operacion_id && (
                  <button type="button" onClick={() => setSoloPedido(v => !v)} className="text-xs font-semibold text-teal-700 hover:underline">
                    {soloPedido ? 'Ver todo lo entregado al cliente' : `Solo el pedido ${prep.operacion_numero?.replace(/^OP-/, 'PRO-') ?? ''}`}
                  </button>
                )}
              </div>
              <div className="mt-1 rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-64 overflow-y-auto" data-testid="productos-cliente">
                {!lista && <div className="h-16 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-gray-400" /></div>}
                {lista?.length === 0 && (
                  <p className="px-3 py-3 text-xs text-gray-600 flex items-center gap-2"><PackageSearch size={14} /> No hay productos entregados con remito para este cliente.</p>
                )}
                {lista?.map(p => {
                  const m = mesesDesde(p.fecha_entrega);
                  const sel = !manual && itemId === p.remito_item_id;
                  return (
                    <button key={p.remito_item_id} type="button" onClick={() => elegir(p)} aria-pressed={sel}
                      className={cn('w-full text-left px-3 py-2.5 flex gap-3 items-start min-h-11 hover:bg-teal-50/60', sel && 'bg-teal-50 ring-1 ring-inset ring-teal-400')}>
                      <span className={cn('mt-0.5 w-4 h-4 rounded-full border shrink-0', sel ? 'border-teal-600 bg-teal-600 ring-2 ring-white ring-inset' : 'border-gray-400')} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-gray-900">{p.cantidad > 1 ? `${p.cantidad} × ` : ''}{p.descripcion}</span>
                        <span className="block text-[11px] text-gray-600">
                          {p.remito_numero}{p.operacion_numero ? ` · ${p.operacion_numero.replace(/^OP-/, 'PRO-')}` : ''} · entregado {fechaCortaServicio(p.fecha_entrega)}
                          {m !== null && ` (hace ${m < 1 ? 'menos de un mes' : m === 1 ? '1 mes' : `${m} meses`})`}
                          {p.servicios_previos > 0 && <b className="text-orange-700"> · {p.servicios_previos} servicio{p.servicios_previos > 1 ? 's' : ''} anterior{p.servicios_previos > 1 ? 'es' : ''}</b>}
                        </span>
                      </span>
                    </button>
                  );
                })}
                <button type="button" onClick={() => { setManual(true); setItemId(null); }} aria-pressed={manual}
                  className={cn('w-full text-left px-3 py-2.5 flex gap-3 items-center min-h-11 hover:bg-teal-50/60', manual && 'bg-teal-50 ring-1 ring-inset ring-teal-400')}>
                  <PenLine size={15} className="text-gray-500 shrink-0" />
                  <span className="text-sm text-gray-800">Otro producto o no está en la lista</span>
                </button>
              </div>
              {manual && (
                <input value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={500} className={cn(campoCls, 'mt-2')}
                  placeholder="Ej.: Ventana corrediza del living (no la vendimos nosotros)" aria-label="Producto" />
              )}
              {elegido && enGarantia !== null && (
                <p className={cn('mt-1.5 text-xs font-semibold flex items-center gap-1.5', enGarantia ? 'text-emerald-700' : 'text-amber-700')}>
                  <ShieldCheck size={14} /> {enGarantia ? `Dentro de garantía (${productos!.meses} meses)` : `Fuera del plazo de garantía de ${productos!.meses} meses`}
                </p>
              )}
            </div>
          )}

          <div>
            <p className={etiquetaCls}>Tipo de servicio</p>
            <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {(Object.keys(TIPO_SERVICIO) as TipoServicio[]).map(k => (
                <button key={k} type="button" onClick={() => setTipo(k)} aria-pressed={tipo === k} data-testid={`tipo-${k}`}
                  className={cn('h-11 sm:h-10 px-3 rounded-lg border text-sm font-semibold',
                    tipo === k ? 'border-teal-600 bg-teal-50 text-teal-900 ring-1 ring-teal-500' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
                  {TIPO_SERVICIO[k].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={etiquetaCls} htmlFor="st-prob">Problema que informa el cliente</label>
            <textarea id="st-prob" value={problema} onChange={e => setProblema(e.target.value)} rows={4} maxLength={4000}
              placeholder="Ej.: La hoja corrediza se traba y no cierra bien desde la última lluvia" className={cn(areaCls, 'mt-1')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
            <div>
              <label className={etiquetaCls} htmlFor="st-fecha">Fecha del reclamo</label>
              <input id="st-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={cn(campoCls, 'mt-1')} />
            </div>
            <div>
              <p className={etiquetaCls}>Fotos o videos del problema</p>
              <div className="mt-1 space-y-2">
                <AdjuntosGrid urls={adjuntos} size="sm" onRemove={u => setAdjuntos(a => a.filter(x => x !== u))} />
                <DropzoneAdjuntos compacto endpoint={ENDPOINT_ADJUNTOS_SERVICIO} accept={ACCEPT_ADJUNTOS_SERVICIO}
                  textoCompacto="Agregar foto, video (hasta 50 MB) o PDF" onAdd={u => setAdjuntos(a => [...a, u])} />
              </div>
            </div>
          </div>
        </>
      )}
    </ModalBase>
  );
}
