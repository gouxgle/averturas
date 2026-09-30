import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { X, Send, Trash2, RefreshCw, FileMinus, ExternalLink, ChevronDown, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toastApiError } from '@/lib/apiError';
import { LetraBadge, EstadoBadge } from './TabComprobantes';
import {
  CBTE_NOMBRE, COND_IVA_NOMBRE, numeroCbte, fmt$, fechaCorta, documentoTexto, type EstadoCbte, type TipoDoc,
} from './tipos';

interface Detalle {
  id: string; estado: EstadoCbte; tipo_doc: TipoDoc; clase: 'A' | 'B'; cbte_tipo: number; punto_venta: number;
  numero: string | null; fecha: string; concepto: 1 | 2 | 3; fch_serv_desde: string | null; fch_serv_hasta: string | null;
  fch_vto_pago: string | null; receptor_doc_tipo: number; receptor_doc_nro: string; receptor_nombre: string;
  receptor_domicilio: string | null; receptor_condicion_iva_id: number; origen: string; operacion_id: string | null;
  recibo_id: string | null; comprobante_asociado_id: string | null; asociado_clase: string | null;
  asociado_cbte_tipo: number | null; asociado_punto_venta: number | null; asociado_numero: string | null;
  imp_neto: string; imp_iva: string; imp_op_ex: string; imp_total: string; cae: string | null; cae_vto: string | null;
  qr_url: string | null; errores: { code: string; msg: string }[] | null; observaciones: { code: string; msg: string }[] | null;
  ambiente: string; creado_por: string | null; created_at: string; emitido_at: string | null; notas: string | null;
  items: { id: string; descripcion: string; cantidad: string; precio_unitario: string; bonificacion: string; alicuota: string; exento: boolean; es_servicio: boolean; total: string }[];
  iva: { alicuota_id: number; alicuota: string; base_imp: string; importe: string }[];
  eventos: { id: number; metodo: string | null; ok: boolean | null; duracion_ms: number | null; error_mensaje: string | null; created_at: string }[];
}

const CONCEPTO: Record<number, string> = { 1: 'Productos', 2: 'Servicios', 3: 'Productos y servicios' };

export function DetalleComprobante({ id, onClose, onChanged, puedeEmitir }: {
  id: string; onClose: () => void; onChanged: () => void; puedeEmitir: boolean;
}) {
  const navigate = useNavigate();
  const [d, setD] = useState<Detalle | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [verRegistro, setVerRegistro] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    api.get<Detalle>(`/facturacion/comprobantes/${id}`).then(setD).catch(e => { toastApiError(e); onClose(); });
  }, [id, recarga, onClose]);

  const actualizar = () => { setRecarga(r => r + 1); onChanged(); };

  async function emitir() {
    setTrabajando(true);
    try {
      const r = await api.post<{ estado: string; numero: number | null; mensajes: string[] }>(`/facturacion/comprobantes/${id}/emitir`, {});
      if (r.estado === 'autorizado') toast.success(`Autorizado por ARCA: N° ${r.numero}`, { description: r.mensajes.join('\n') || undefined });
      else if (r.estado === 'incierto') toast.warning('ARCA no confirmó todavía', { description: r.mensajes.join('\n'), duration: 12000 });
      else toast.error(r.estado === 'rechazado' ? 'ARCA rechazó el comprobante' : 'No se pudo emitir', { description: r.mensajes.join('\n'), duration: 12000 });
      actualizar();
    } catch (e) { toastApiError(e, { duration: 12000 }); } finally { setTrabajando(false); }
  }

  async function conciliar() {
    setTrabajando(true);
    try {
      const r = await api.post<{ resultado: string }>(`/facturacion/comprobantes/${id}/conciliar`, {});
      const msg: Record<string, string> = {
        autorizado: 'ARCA confirmó el comprobante', no_emitido: 'ARCA no lo recibió: se puede volver a emitir',
        pendiente: 'ARCA todavía no confirma; el sistema vuelve a probar solo', numero_ajeno: 'El número quedó usado por otro comprobante: se puede volver a emitir',
      };
      toast.info(msg[r.resultado] ?? r.resultado);
      actualizar();
    } catch (e) { toastApiError(e); } finally { setTrabajando(false); }
  }

  async function borrar() {
    setTrabajando(true);
    try {
      await api.delete(`/facturacion/comprobantes/${id}`);
      toast.success('Borrador eliminado');
      onChanged();
      onClose();
    } catch (e) { toastApiError(e); setTrabajando(false); }
  }

  const esNC = d?.tipo_doc === 'nota_credito';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onMouseDown={onClose}>
      <div className="w-full sm:max-w-3xl max-h-[92dvh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl" onMouseDown={e => e.stopPropagation()}>
        {!d ? <p className="p-6 text-sm text-gray-600">Cargando…</p> : confirmarBorrar ? (
          <div className="p-6 bg-red-50 space-y-4">
            <p className="text-base font-bold text-red-800">¿Borrar este borrador?</p>
            <p className="text-sm text-red-700">No llegó a ARCA, así que no hay nada que anular. Se pierde lo cargado.</p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button onClick={() => setConfirmarBorrar(false)} className="h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold">Cancelar</button>
              <button onClick={borrar} disabled={trabajando} className="h-11 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">Sí, borrar</button>
            </div>
          </div>
        ) : (
          <>
            {/* Encabezado */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-5 py-3 flex items-center gap-3">
              <LetraBadge clase={d.clase} nc={esNC} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{CBTE_NOMBRE[d.cbte_tipo]}</p>
                <p className="font-mono text-xs text-gray-600">{numeroCbte(d.punto_venta, d.numero)}</p>
              </div>
              <EstadoBadge estado={d.estado} />
              <button onClick={onClose} className="h-9 w-9 flex items-center justify-center text-gray-500 hover:text-gray-900" aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {d.ambiente === 'homologacion' && d.estado === 'autorizado' && (
                <p className="text-xs rounded-lg bg-sky-50 border border-sky-200 text-sky-800 px-3 py-2">Emitido en el ambiente de <b>pruebas</b> de ARCA: no tiene validez fiscal.</p>
              )}
              {d.estado === 'incierto' && (
                <Aviso tono="amber" icon={AlertTriangle}>
                  ARCA no respondió a tiempo. El sistema está verificando si lo recibió; <b>no lo vuelvas a emitir</b>.
                </Aviso>
              )}
              {d.errores && d.errores.length > 0 && d.estado !== 'autorizado' && (
                <Aviso tono="red" icon={XCircle}>
                  <b>{d.estado === 'rechazado' ? 'ARCA lo rechazó:' : 'Último intento:'}</b>
                  <ul className="mt-1 list-disc pl-4">{d.errores.map((e, i) => <li key={i}>{e.msg}{e.code && !/^\D/.test(e.code) ? ` (${e.code})` : ''}</li>)}</ul>
                </Aviso>
              )}
              {d.observaciones && d.observaciones.length > 0 && d.estado === 'autorizado' && (
                <Aviso tono="amber" icon={AlertTriangle}>
                  Autorizado con observaciones de ARCA: {d.observaciones.map(o => `${o.msg} (${o.code})`).join(' · ')}
                </Aviso>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Caja titulo="Cliente">
                  <p className="font-semibold text-gray-900">{d.receptor_nombre}</p>
                  <p>{documentoTexto(d.receptor_doc_tipo, d.receptor_doc_nro)}</p>
                  <p>{COND_IVA_NOMBRE[d.receptor_condicion_iva_id] ?? `Condición ${d.receptor_condicion_iva_id}`}</p>
                  {d.receptor_domicilio && <p className="text-gray-600">{d.receptor_domicilio}</p>}
                </Caja>
                <Caja titulo="Comprobante">
                  <p>Fecha: <b>{fechaCorta(d.fecha)}</b> · {CONCEPTO[d.concepto]}</p>
                  {d.concepto !== 1 && <p>Servicio del {fechaCorta(d.fch_serv_desde)} al {fechaCorta(d.fch_serv_hasta)} · vence {fechaCorta(d.fch_vto_pago)}</p>}
                  {d.cae && <p>CAE <span className="font-mono">{d.cae}</span> · vence {fechaCorta(d.cae_vto)}</p>}
                  {d.comprobante_asociado_id && d.asociado_cbte_tipo && (
                    <p>Corrige: <button onClick={() => navigate(`/facturacion?cbte=${d.comprobante_asociado_id}`)} className="underline text-fuchsia-800">
                      {CBTE_NOMBRE[d.asociado_cbte_tipo]} {numeroCbte(d.asociado_punto_venta ?? 0, d.asociado_numero)}</button></p>
                  )}
                  {d.recibo_id && <p>Origen: <Link to={`/recibos?id=${d.recibo_id}`} className="underline text-fuchsia-800">recibo</Link></p>}
                  {!d.recibo_id && d.operacion_id && <p>Origen: <Link to={`/presupuestos?id=${d.operacion_id}`} className="underline text-fuchsia-800">presupuesto</Link></p>}
                </Caja>
              </div>

              {/* Ítems */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <ul className="divide-y divide-gray-100">
                  {d.items.map(it => (
                    <li key={it.id} className="px-3 py-2 flex gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 break-words">{it.descripcion}</p>
                        <p className="text-xs text-gray-500">
                          {Number(it.cantidad)} × {fmt$(it.precio_unitario)}
                          {Number(it.bonificacion) > 0 && <> · bonif. {fmt$(it.bonificacion)}</>}
                          {it.exento ? ' · exento' : ` · IVA ${Number(it.alicuota)}%`}{it.es_servicio && ' · servicio'}
                        </p>
                      </div>
                      <p className="font-semibold tabular-nums whitespace-nowrap">{fmt$(it.total)}</p>
                    </li>
                  ))}
                </ul>
                <div className="bg-gray-50 px-3 py-2 text-sm space-y-0.5">
                  {d.clase === 'A' ? (
                    <>
                      <Fila label="Neto gravado" valor={fmt$(d.imp_neto)} />
                      {d.iva.map(a => <Fila key={a.alicuota_id} label={`IVA ${Number(a.alicuota)}%`} valor={fmt$(a.importe)} />)}
                      {Number(d.imp_op_ex) > 0 && <Fila label="Exento" valor={fmt$(d.imp_op_ex)} />}
                    </>
                  ) : (
                    <p className="text-xs text-gray-600">Régimen de Transparencia Fiscal al Consumidor (Ley 27.743): IVA contenido {fmt$(d.imp_iva)}</p>
                  )}
                  <Fila label="Total" valor={`${esNC ? '−' : ''}${fmt$(d.imp_total)}`} fuerte />
                </div>
              </div>

              {/* Registro con ARCA */}
              {d.eventos.length > 0 && (
                <div className="rounded-xl border border-gray-200">
                  <button onClick={() => setVerRegistro(v => !v)} className="w-full h-10 px-3 flex items-center justify-between text-xs font-bold text-gray-700">
                    Registro con ARCA ({d.eventos.length}) <ChevronDown size={14} className={cn('transition-transform', verRegistro && 'rotate-180')} />
                  </button>
                  {verRegistro && (
                    <ul className="border-t border-gray-200 divide-y divide-gray-100 text-xs">
                      {d.eventos.map(ev => (
                        <li key={ev.id} className="px-3 py-1.5 flex gap-2">
                          {ev.ok === false ? <XCircle size={13} className="text-red-600 mt-0.5 shrink-0" /> : <CheckCircle2 size={13} className="text-emerald-600 mt-0.5 shrink-0" />}
                          <span className="text-gray-800"><b>{ev.metodo}</b>{ev.duracion_ms != null && ` · ${ev.duracion_ms} ms`}{ev.error_mensaje && ` · ${ev.error_mensaje}`}</span>
                          <span className="ml-auto text-gray-500 whitespace-nowrap">{new Date(ev.created_at).toLocaleTimeString('es-AR')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="text-[11px] text-gray-500">Creado {new Date(d.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}{d.creado_por && ` por ${d.creado_por}`}</p>
            </div>

            {/* Acciones */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2">
              {d.qr_url && (
                <a href={d.qr_url} target="_blank" rel="noreferrer" className="h-11 sm:h-10 px-3 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  <ExternalLink size={15} /> Verificar en ARCA
                </a>
              )}
              {puedeEmitir && ['borrador', 'rechazado'].includes(d.estado) && (
                <>
                  <button onClick={() => setConfirmarBorrar(true)} className="h-11 sm:h-10 px-3 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    <Trash2 size={15} /> Borrar
                  </button>
                  <button onClick={emitir} disabled={trabajando} className="h-11 sm:h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-fuchsia-700 text-white text-sm font-semibold hover:bg-fuchsia-800 disabled:opacity-50">
                    <Send size={15} /> {trabajando ? 'Enviando a ARCA…' : 'Emitir con ARCA'}
                  </button>
                </>
              )}
              {puedeEmitir && ['incierto', 'emitiendo'].includes(d.estado) && (
                <button onClick={conciliar} disabled={trabajando} className="h-11 sm:h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">
                  <RefreshCw size={15} className={trabajando ? 'animate-spin' : ''} /> Verificar con ARCA
                </button>
              )}
              {puedeEmitir && d.estado === 'autorizado' && d.tipo_doc === 'factura' && (
                <button onClick={() => navigate(`/facturacion/nueva?factura_id=${d.id}`)} className="h-11 sm:h-10 px-3 inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400 bg-amber-50 text-sm font-semibold text-amber-800 hover:bg-amber-100">
                  <FileMinus size={15} /> Nota de crédito
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Caja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 text-sm text-gray-700 space-y-0.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">{titulo}</p>
      {children}
    </div>
  );
}

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3', fuerte && 'text-base font-extrabold text-gray-900 pt-1')}>
      <span>{label}</span><span className="tabular-nums">{valor}</span>
    </div>
  );
}

function Aviso({ tono, icon: Icon, children }: { tono: 'amber' | 'red'; icon: typeof AlertTriangle; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-sm flex gap-2',
      tono === 'red' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900')}>
      <Icon size={16} className="shrink-0 mt-0.5" /><div className="min-w-0">{children}</div>
    </div>
  );
}
