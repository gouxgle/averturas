import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, FileText, Factory, Loader2, Receipt, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { cn, formatCurrency } from '@/lib/utils';
import { TIPO_INCIDENCIA_LABEL } from '@/pages/compras/tipos';
import type { ServicioConIntervenciones } from '@/lib/servicios';
import { ModalBase } from './ModalBase';
import { areaCls, btnPrim, btnSec, campoCls, etiquetaCls } from './estilos';

function Seccion({ titulo, icono, children }: { titulo: string; icono: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">{icono}<h2 className="text-xs font-extrabold uppercase tracking-wide text-gray-700">{titulo}</h2></div>
      {children}
    </section>
  );
}

// Cobro de un servicio con cargo: recibo directo (trabajo simple) o presupuesto precargado (repuestos, precio a pasar).
// La facturación sigue desde el recibo como siempre.
export function PanelCobro({ s, puede, onCambio }: { s: ServicioConIntervenciones; puede: boolean; onCambio: () => void }) {
  const navigate = useNavigate();
  const [cobrando, setCobrando] = useState(false);
  const conCargo = s.tipo !== 'garantia' || s.intervenciones.some(i => i.con_cargo);

  function armarPresupuesto() {
    navigate('/presupuestos/nuevo', { state: {
      clienteId: s.cliente_id, servicioTecnicoId: s.id,
      itemsPrecargados: [{ tipo_item: 'servicio', descripcion: `Servicio técnico ${s.numero}${s.producto_descripcion ? ` — ${s.producto_descripcion}` : ''}`, medida_ancho: '', medida_alto: '' }],
    } });
  }

  return (
    <Seccion titulo="Cobro" icono={<Wallet size={16} className="text-teal-700" />}>
      {!conCargo && s.recibos.length === 0 && s.presupuestos.length === 0 && (
        <p className="text-sm text-gray-600">Garantía: sin cargo para el cliente.</p>
      )}
      {(s.recibos.length > 0 || s.presupuestos.length > 0) && (
        <ul className="space-y-1 mb-2">
          {s.presupuestos.map(p => (
            <li key={p.id} className="text-sm flex items-center gap-2"><FileText size={14} className="text-violet-700" />
              <Link to={`/presupuestos?id=${p.id}`} className="font-semibold text-teal-800 hover:underline">{p.numero.replace(/^OP-/, 'PRO-')}</Link>
              <span className="text-gray-600">{formatCurrency(Number(p.precio_total))} · {p.estado}</span>
            </li>
          ))}
          {s.recibos.map(r => (
            <li key={r.id} className="text-sm flex items-center gap-2"><Receipt size={14} className="text-emerald-700" />
              <Link to={`/recibos?id=${r.id}`} className="font-semibold text-teal-800 hover:underline">{r.numero}</Link>
              <span className={cn('text-gray-600', r.estado === 'anulado' && 'line-through')}>{formatCurrency(Number(r.monto_total))} · {r.forma_pago}</span>
            </li>
          ))}
        </ul>
      )}
      {puede && s.estado !== 'cancelado' && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCobrando(true)} className={cn(conCargo ? btnPrim : btnSec, 'h-10 sm:h-9 px-3 text-xs')} data-testid="cobrar-servicio"><Receipt size={14} /> Cobrar</button>
          <button onClick={armarPresupuesto} className={cn(btnSec, 'h-10 sm:h-9 px-3 text-xs')} data-testid="presupuesto-servicio"><FileText size={14} /> Armar presupuesto</button>
        </div>
      )}
      {puede && conCargo && <p className="mt-1.5 text-[11px] text-gray-600">Trabajo simple: cobrar directo. Con repuestos o si hay que pasar precio antes: presupuesto.</p>}
      {cobrando && <ModalCobrar s={s} onClose={() => setCobrando(false)} onHecho={() => { setCobrando(false); onCambio(); }} />}
    </Seccion>
  );
}

function ModalCobrar({ s, onClose, onHecho }: { s: ServicioConIntervenciones; onClose: () => void; onHecho: () => void }) {
  const [formas, setFormas] = useState<string[]>([]);
  const [monto, setMonto] = useState('');
  const [forma, setForma] = useState('');
  const [ref, setRef] = useState('');
  const [concepto, setConcepto] = useState(`Servicio técnico ${s.numero}${s.producto_descripcion ? ` — ${s.producto_descripcion}` : ''}`);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    api.get<{ nombre: string }[]>('/catalogo/formas-pago')
      .then(fs => setFormas(fs.map(f => f.nombre).filter(n => n !== 'Saldo a favor')))
      .catch(() => setFormas(['Efectivo', 'Transferencia']));
  }, []);
  const ok = Number(monto) > 0 && !!forma && concepto.trim().length > 0;

  async function cobrar() {
    if (!ok || guardando) return;
    setGuardando(true);
    try {
      const r = await api.post<{ numero: string }>(`/servicios-tecnicos/${s.id}/cobrar`, {
        monto: Number(monto), forma_pago: forma, referencia_pago: ref.trim() || null, concepto: concepto.trim(),
      });
      toast.success(`Recibo ${r.numero} emitido`);
      onHecho();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo cobrar' }); }
    finally { setGuardando(false); }
  }

  return (
    <ModalBase titulo={`Cobrar ${s.numero}`} icono={<Receipt size={18} className="text-emerald-700" />} onClose={onClose} testId="modal-cobrar"
      pie={<>
        <button onClick={onClose} className={btnSec}>Cancelar</button>
        <button onClick={cobrar} disabled={!ok || guardando} className={btnPrim} data-testid="confirmar-cobro">
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />} Emitir recibo
        </button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={etiquetaCls} htmlFor="cb-monto">Importe</label>
          <input id="cb-monto" type="number" min="0" step="0.01" inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} className={cn(campoCls, 'mt-1')} autoFocus />
        </div>
        <div>
          <label className={etiquetaCls} htmlFor="cb-forma">Forma de pago</label>
          <select id="cb-forma" value={forma} onChange={e => setForma(e.target.value)} className={cn(campoCls, 'mt-1')}>
            <option value="">Elegí…</option>
            {formas.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={etiquetaCls} htmlFor="cb-ref">Referencia del pago <span className="font-normal text-gray-500">(opcional)</span></label>
        <input id="cb-ref" value={ref} onChange={e => setRef(e.target.value)} maxLength={200} placeholder="N.º de transferencia, cupón…" className={cn(campoCls, 'mt-1')} />
      </div>
      <div>
        <label className={etiquetaCls} htmlFor="cb-conc">Concepto</label>
        <input id="cb-conc" value={concepto} onChange={e => setConcepto(e.target.value)} maxLength={300} className={cn(campoCls, 'mt-1')} />
      </div>
      <p className="text-xs text-gray-600">El recibo queda en la cuenta del cliente y vinculado a este servicio. Se factura desde Recibos, como siempre.</p>
    </ModalBase>
  );
}

const ESTADO_RECLAMO: Record<string, string> = {
  abierta: 'Abierto', reclamada: 'Reclamado', respondida: 'Respondido', en_reposicion: 'En reposición', resuelta: 'Resuelto', rechazada: 'Rechazado',
  en_cotizacion: 'En cotización', con_oc: 'Con orden de compra', cerrada: 'Cerrada', cancelada: 'Cancelada',
};

// Reclamo al proveedor cuando la falla necesita una pieza o un producto suyo. Si el producto vino de una orden de
// compra, el reclamo se abre sobre esa línea (circuito de Reclamos de Compras); si no, se pide el repuesto con una
// solicitud de compra de garantía.
export function PanelProveedor({ s, puede, onCambio }: { s: ServicioConIntervenciones; puede: boolean; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const cerrado = s.estado === 'finalizado' || s.estado === 'cancelado';
  if (!s.reclamos.length && (!puede || cerrado)) return null;
  return (
    <Seccion titulo="Proveedor" icono={<Factory size={16} className="text-teal-700" />}>
      {s.reclamos.length === 0 && <p className="text-sm text-gray-600">Si hace falta una pieza o un producto del proveedor, reclamalo desde acá.</p>}
      <ul className="space-y-2 mb-2">
        {s.reclamos.map(r => (
          <li key={r.id} className="rounded-lg border border-gray-200 p-2 text-sm">
            <Link to={r.clase === 'incidencia' ? `/compras?tab=reclamos&rec=${r.id}` : `/compras?tab=solicitudes&sc=${r.id}`}
              className="font-semibold text-teal-800 hover:underline">
              {r.clase === 'incidencia' ? 'Reclamo' : 'Solicitud de repuesto'} {r.numero}
            </Link>
            <span className="ml-2 text-xs font-semibold text-gray-700">{ESTADO_RECLAMO[r.estado] ?? r.estado}</span>
            <p className="text-xs text-gray-600">
              {[r.proveedor, r.pedido_numero, r.tipo ? TIPO_INCIDENCIA_LABEL[r.tipo as keyof typeof TIPO_INCIDENCIA_LABEL] : null].filter(Boolean).join(' · ')}
            </p>
            {r.respuesta_proveedor && <p className="text-xs text-gray-800 mt-0.5">Respuesta: {r.respuesta_proveedor}</p>}
          </li>
        ))}
      </ul>
      {puede && !cerrado && (
        <button onClick={() => setAbierto(true)} className={cn(btnSec, 'h-10 sm:h-9 px-3 text-xs')} data-testid="reclamar-proveedor"><AlertTriangle size={14} /> Reclamar al proveedor</button>
      )}
      {abierto && <ModalReclamo s={s} onClose={() => setAbierto(false)} onHecho={() => { setAbierto(false); onCambio(); }} />}
    </Seccion>
  );
}

function ModalReclamo({ s, onClose, onHecho }: { s: ServicioConIntervenciones; onClose: () => void; onHecho: () => void }) {
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [guardando, setGuardando] = useState(false);
  const ok = !!tipo && descripcion.trim().length >= 3 && Number(cantidad) > 0;

  async function reclamar() {
    if (!ok || guardando) return;
    setGuardando(true);
    try {
      const r = await api.post<{ clase: string; numero: string }>(`/servicios-tecnicos/${s.id}/reclamo-proveedor`, {
        tipo, descripcion: descripcion.trim(), cantidad: Number(cantidad),
      });
      toast.success(r.clase === 'incidencia' ? `Reclamo ${r.numero} abierto en Compras` : `Solicitud de repuesto ${r.numero} creada en Compras`,
        { description: 'Seguilo desde Compras. El servicio queda esperando el repuesto.' });
      onHecho();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo crear el reclamo' }); }
    finally { setGuardando(false); }
  }

  return (
    <ModalBase titulo="Reclamar al proveedor" icono={<Factory size={18} className="text-teal-700" />} onClose={onClose} testId="modal-reclamo"
      pie={<>
        <button onClick={onClose} className={btnSec}>Cancelar</button>
        <button onClick={reclamar} disabled={!ok || guardando} className={btnPrim} data-testid="confirmar-reclamo">
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <AlertTriangle size={15} />} Crear reclamo
        </button>
      </>}>
      <p className="text-xs text-gray-600">
        Si el producto vino de una orden de compra, el reclamo se abre sobre esa orden. Si no, se crea una solicitud de compra
        para pedir el repuesto. Las fotos y videos del servicio van con el reclamo.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-3">
        <div>
          <label className={etiquetaCls} htmlFor="rc-tipo">Tipo de falla</label>
          <select id="rc-tipo" value={tipo} onChange={e => setTipo(e.target.value)} className={cn(campoCls, 'mt-1')}>
            <option value="">Elegí…</option>
            {Object.entries(TIPO_INCIDENCIA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={etiquetaCls} htmlFor="rc-cant">Cantidad</label>
          <input id="rc-cant" type="number" min="1" step="1" value={cantidad} onChange={e => setCantidad(e.target.value)} className={cn(campoCls, 'mt-1')} />
        </div>
      </div>
      <div>
        <label className={etiquetaCls} htmlFor="rc-desc">Qué pasa y qué se necesita</label>
        <textarea id="rc-desc" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={4} maxLength={2000}
          placeholder="Ej.: Se partió la rueda inferior; necesitamos 2 ruedas regulables para la línea Módena" className={cn(areaCls, 'mt-1')} />
      </div>
    </ModalBase>
  );
}
