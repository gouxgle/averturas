import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, Check, AlertTriangle, XCircle, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, fechaDiaAR } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { MontoInput } from '@/components/MontoInput';
import {
  fmtCantidad, fmtMoneda, nombreCliente, TIPO_INCIDENCIA_LABEL,
  type OrdenDetalle, type OrdenItem, type TipoIncidencia,
} from './tipos';
import { ModalShell, Seccion, FichaTecnica, AdjuntosGrid, DropzoneAdjuntos, inpCls, lblCls, btnPrimario, btnSecundario } from './ui';

interface Transportista { id: string; nombre: string }

type Marca = 'nada' | 'conforme' | 'problema' | 'no_vino';

interface Fila {
  item: OrdenItem;
  pendiente: number;
  marca: Marca;
  recibida: string;
  conforme: string;
  problema: string;
  observaciones: string;
  incidencia_tipo: TipoIncidencia;
  incidencia_descripcion: string;
  incidencia_adjuntos: string[];
}

export interface ResultadoRecepcion {
  recepcion_id: string;
  numero_secuencia: number;
  estado_logistica: string;
  incidencias: { id: string; numero: string; pedido_item_id: string }[];
  orden: OrdenDetalle;
}

const n = (s: string) => parseFloat(s) || 0;

/**
 * Recepción ítem por ítem: el usuario marca cada línea con un botón (llegó bien /
 * llegó con problema / no vino) y las cantidades se completan solas; se pueden
 * ajustar a mano para entregas parciales. Lo que se marca con problema abre el
 * reclamo en el acto — nunca hay que ir a buscar "crear reclamo" después.
 */
export function ModalRecepcion({ orden, onClose, onHecho }: {
  orden: OrdenDetalle;
  onClose: () => void;
  onHecho: (r: ResultadoRecepcion) => void;
}) {
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [fecha, setFecha] = useState(fechaDiaAR(new Date()));
  const [remito, setRemito] = useState('');
  const [transportistaId, setTransportistaId] = useState(orden.transportista_id ?? '');
  const [costoReal, setCostoReal] = useState('');
  const [adjuntos, setAdjuntos] = useState<string[]>([]);
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [filas, setFilas] = useState<Fila[]>(() => orden.items
    .filter(i => i.estado_item !== 'cancelado')
    .map(i => {
      const pendiente = Math.max(0, Number(i.cantidad) - Number(i.cantidad_recibida));
      return {
        item: i, pendiente, marca: 'nada' as Marca,
        recibida: '', conforme: '', problema: '', observaciones: '',
        incidencia_tipo: 'otro' as TipoIncidencia, incidencia_descripcion: '', incidencia_adjuntos: [],
      };
    }));

  useEffect(() => {
    api.get<Transportista[]>('/transportistas').then(setTransportistas).catch(() => {});
  }, []);

  const up = (id: string, patch: Partial<Fila>) => setFilas(fs => fs.map(f => f.item.id === id ? { ...f, ...patch } : f));

  function marcar(f: Fila, marca: Marca) {
    if (f.marca === marca) return up(f.item.id, { marca: 'nada', recibida: '', conforme: '', problema: '' });
    if (marca === 'conforme') up(f.item.id, { marca, recibida: String(f.pendiente), conforme: String(f.pendiente), problema: '0' });
    else if (marca === 'problema') up(f.item.id, { marca, recibida: String(f.pendiente), conforme: '0', problema: String(f.pendiente) });
    else up(f.item.id, { marca, recibida: '0', conforme: '0', problema: '0' });
  }

  // Al tocar cantidades a mano, conforme + problema tiene que dar recibida
  function editarRecibida(f: Fila, v: string) {
    const rec = n(v);
    const prob = Math.min(n(f.problema), rec);
    up(f.item.id, { recibida: v, problema: String(prob), conforme: String(Math.max(0, rec - prob)), marca: rec > 0 ? (prob > 0 ? 'problema' : 'conforme') : 'nada' });
  }
  function editarProblema(f: Fila, v: string) {
    const rec = n(f.recibida);
    const prob = Math.min(n(v), rec);
    up(f.item.id, { problema: v, conforme: String(Math.max(0, rec - prob)), marca: prob > 0 ? 'problema' : (rec > 0 ? 'conforme' : 'nada') });
  }

  const resumen = useMemo(() => {
    let recibidos = 0, conProblema = 0, noVino = 0, lineas = 0;
    for (const f of filas) {
      if (f.marca === 'nada') continue;
      lineas++;
      recibidos += n(f.conforme);
      conProblema += n(f.problema);
      if (f.marca === 'no_vino') noVino++;
    }
    return { recibidos, conProblema, noVino, lineas };
  }, [filas]);

  const errores = filas.flatMap(f => {
    if (f.marca === 'nada') return [];
    const rec = n(f.recibida), conf = n(f.conforme), prob = n(f.problema);
    const errs: string[] = [];
    if (rec > f.pendiente + 0.001) errs.push(`${f.item.descripcion}: solo quedan ${fmtCantidad(f.pendiente, f.item.unidad)} por recibir`);
    if (Math.abs(conf + prob - rec) > 0.001) errs.push(`${f.item.descripcion}: conforme + con problema tiene que dar lo recibido`);
    if (f.item.producto_id && !Number.isInteger(conf)) errs.push(`${f.item.descripcion}: es producto de catálogo, la cantidad conforme tiene que ser entera`);
    return errs;
  });
  const valido = resumen.lineas > 0 && errores.length === 0;

  async function confirmar() {
    if (!valido) return;
    setGuardando(true);
    try {
      const r = await api.post<ResultadoRecepcion>(`/compras/ordenes/${orden.id}/recepciones`, {
        fecha, remito_proveedor_nro: remito.trim() || undefined,
        transportista_id: transportistaId || null,
        costo_envio_real: costoReal ? n(costoReal) : null,
        adjuntos, notas: notas.trim() || undefined,
        items: filas.filter(f => f.marca !== 'nada').map(f => ({
          pedido_item_id: f.item.id,
          cantidad_recibida: n(f.recibida), cantidad_conforme: n(f.conforme), cantidad_problema: n(f.problema),
          no_recibido: f.marca === 'no_vino',
          observaciones: f.observaciones.trim() || undefined,
          ...(n(f.problema) > 0 ? {
            incidencia_tipo: f.incidencia_tipo,
            incidencia_descripcion: f.incidencia_descripcion.trim() || undefined,
            incidencia_adjuntos: f.incidencia_adjuntos,
          } : {}),
        })),
      });
      toast.success(r.incidencias.length
        ? `Recepción registrada · ${r.incidencias.length} reclamo${r.incidencias.length === 1 ? '' : 's'} abierto${r.incidencias.length === 1 ? '' : 's'}`
        : 'Recepción registrada — el stock ya ingresó');
      onHecho(r);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo registrar la recepción' }); }
    finally { setGuardando(false); }
  }

  const botonMarca = (f: Fila, marca: Marca, Icono: typeof Check, label: string, activo: string) => (
    <button type="button" onClick={() => marcar(f, marca)} title={label}
      className={cn('flex items-center justify-center gap-1 h-11 sm:h-9 px-2 rounded-lg border text-[11px] font-semibold transition-colors flex-1 sm:flex-none sm:w-9',
        f.marca === marca ? activo : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400')}>
      <Icono size={14} /><span className="sm:hidden">{label}</span>
    </button>
  );

  return (
    <ModalShell
      icon={<PackageCheck size={20} />} iconCls="bg-emerald-50 text-emerald-700"
      titulo={`Recibir mercadería · ${orden.numero}`}
      subtitulo={<>{orden.proveedor.nombre}{orden.operacion ? ` · ${nombreCliente(orden.operacion.cliente)}` : ''} — marcá cómo llegó cada ítem</>}
      onClose={onClose} ancho="sm:max-w-4xl"
      pie={
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <p className="text-xs text-gray-600">
            {resumen.lineas === 0 ? 'Todavía no marcaste ningún ítem.' : <>
              {resumen.recibidos > 0 && <>Ingresan a stock <strong>{fmtCantidad(resumen.recibidos)}</strong>. </>}
              {resumen.conProblema > 0 && <span className="text-amber-700">{fmtCantidad(resumen.conProblema)} con problema → se abre reclamo. </span>}
              {resumen.noVino > 0 && <span className="text-gray-600">{resumen.noVino} sin llegar.</span>}
            </>}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className={btnSecundario} disabled={guardando}>Cancelar</button>
            <button onClick={confirmar} disabled={!valido || guardando} className={cn(btnPrimario, 'bg-emerald-600 hover:bg-emerald-700')}>
              {guardando ? 'Registrando…' : 'Confirmar recepción'}
            </button>
          </div>
        </div>
      }
    >
      <Seccion titulo={`Ítems (${filas.length})`}
        accion={
          <button onClick={() => setFilas(fs => fs.map(f => f.pendiente > 0
            ? { ...f, marca: 'conforme', recibida: String(f.pendiente), conforme: String(f.pendiente), problema: '0' } : f))}
            className="text-[11px] text-emerald-700 font-semibold hover:underline">Llegó todo bien</button>
        }>
        <div className="space-y-2">
          {filas.map(f => {
            const rec = n(f.recibida), conf = n(f.conforme), prob = n(f.problema);
            const restante = Math.max(0, f.pendiente - rec);
            const yaRecibido = f.pendiente === 0;
            return (
              <div key={f.item.id} className={cn('border rounded-xl p-3',
                yaRecibido ? 'border-gray-200 bg-gray-50 opacity-70'
                : f.marca === 'conforme' ? 'border-emerald-300 bg-emerald-50/40'
                : f.marca === 'problema' ? 'border-amber-300 bg-amber-50/40'
                : f.marca === 'no_vino' ? 'border-gray-300 bg-gray-50' : 'border-gray-200')}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{f.item.descripcion}</p>
                      {f.item.es_reposicion_reclamo && <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 rounded-full px-1.5 py-0.5">Reposición</span>}
                    </div>
                    <FichaTecnica e={f.item.especificaciones} />
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      Pedido: <strong>{fmtCantidad(f.item.cantidad, f.item.unidad)}</strong>
                      {Number(f.item.cantidad_recibida) > 0 && <> · ya recibido {fmtCantidad(f.item.cantidad_recibida, f.item.unidad)}</>}
                      {!yaRecibido && <> · pendiente <strong>{fmtCantidad(f.pendiente, f.item.unidad)}</strong></>}
                      {yaRecibido && <span className="text-emerald-700 font-semibold"> · completo</span>}
                    </p>
                  </div>
                  {!yaRecibido && (
                    <div className="flex gap-1.5 sm:shrink-0">
                      {botonMarca(f, 'conforme', Check, 'Llegó bien', 'bg-emerald-600 border-emerald-600 text-white')}
                      {botonMarca(f, 'problema', AlertTriangle, 'Con problema', 'bg-amber-500 border-amber-500 text-white')}
                      {botonMarca(f, 'no_vino', XCircle, 'No vino', 'bg-gray-600 border-gray-600 text-white')}
                    </div>
                  )}
                </div>

                {f.marca !== 'nada' && f.marca !== 'no_vino' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    <div><label className={lblCls}>Recibido</label>
                      <input type="number" step="0.01" min="0" max={f.pendiente} value={f.recibida} onChange={e => editarRecibida(f, e.target.value)} className={inpCls} />
                    </div>
                    <div><label className={lblCls}>Con problema</label>
                      <input type="number" step="0.01" min="0" max={rec} value={f.problema} onChange={e => editarProblema(f, e.target.value)} className={inpCls} />
                    </div>
                    <div><label className={lblCls}>Conforme</label>
                      <input value={conf} readOnly className={cn(inpCls, 'bg-gray-50 font-semibold text-emerald-700')} />
                    </div>
                    <div><label className={lblCls}>Queda pendiente</label>
                      <input value={restante} readOnly className={cn(inpCls, 'bg-gray-50', restante > 0 && 'text-amber-700 font-semibold')} />
                    </div>
                  </div>
                )}

                {f.marca !== 'nada' && (
                  <input value={f.observaciones} onChange={e => up(f.item.id, { observaciones: e.target.value })}
                    placeholder="Observación de esta línea (opcional)" className={cn(inpCls, 'mt-2')} />
                )}

                {/* Reclamo en el acto: aparece solo cuando hay cantidad con problema */}
                {prob > 0 && (
                  <div className="mt-3 p-3 rounded-xl border border-amber-300 bg-amber-50 space-y-2">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Reclamo por {fmtCantidad(prob, f.item.unidad)} — se abre al confirmar
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div><label className={lblCls}>¿Qué pasó?</label>
                        <select value={f.incidencia_tipo} onChange={e => up(f.item.id, { incidencia_tipo: e.target.value as TipoIncidencia })} className={inpCls}>
                          {(Object.keys(TIPO_INCIDENCIA_LABEL) as TipoIncidencia[]).map(t => <option key={t} value={t}>{TIPO_INCIDENCIA_LABEL[t]}</option>)}
                        </select>
                      </div>
                      <div><label className={lblCls}>Detalle para el proveedor</label>
                        <input value={f.incidencia_descripcion} onChange={e => up(f.item.id, { incidencia_descripcion: e.target.value })}
                          placeholder="Ej: llegó con el vidrio rajado" className={inpCls} />
                      </div>
                    </div>
                    <div>
                      <label className={lblCls}>Fotos del problema</label>
                      <AdjuntosGrid urls={f.incidencia_adjuntos} size="sm" onRemove={u => up(f.item.id, { incidencia_adjuntos: f.incidencia_adjuntos.filter(x => x !== u) })} />
                      <div className="mt-1"><DropzoneAdjuntos compacto onAdd={u => up(f.item.id, { incidencia_adjuntos: [...f.incidencia_adjuntos, u] })} /></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Seccion>

      <Seccion titulo="Datos de la entrega">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className={lblCls}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inpCls} /></div>
          <div><label className={lblCls}>Remito del proveedor</label><input value={remito} onChange={e => setRemito(e.target.value)} placeholder="N°" className={inpCls} /></div>
          <div><label className={lblCls}>Transportista</label>
            <select value={transportistaId} onChange={e => setTransportistaId(e.target.value)} className={inpCls}>
              <option value="">Sin especificar</option>
              {transportistas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div><label className={lblCls}>Flete real</label>
            <MontoInput value={costoReal} onChange={setCostoReal} className={inpCls} placeholder={String(Number(orden.costo_envio))} />
            <p className="text-[10px] text-gray-500 mt-0.5">Estimado: {fmtMoneda(orden.costo_envio)}</p>
          </div>
          <div className="sm:col-span-2 lg:col-span-4"><label className={lblCls}>Notas de la entrega</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} className={inpCls} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className={lblCls}>Remito / fotos de la entrega</label>
            <AdjuntosGrid urls={adjuntos} size="sm" onRemove={u => setAdjuntos(a => a.filter(x => x !== u))} />
            <div className="mt-2"><DropzoneAdjuntos compacto onAdd={u => setAdjuntos(a => [...a, u])} /></div>
          </div>
        </div>
      </Seccion>

      {errores.length > 0 && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 space-y-1">
          {errores.map(e => <p key={e} className="text-xs text-red-700">{e}</p>)}
        </div>
      )}
      {orden.transportista_nombre && !transportistaId && (
        <p className="text-[11px] text-gray-500 flex items-center gap-1"><Truck size={11} /> La orden tenía a {orden.transportista_nombre} como transportista.</p>
      )}
    </ModalShell>
  );
}
