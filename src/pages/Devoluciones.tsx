import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Undo2, Plus, RefreshCw, Search, X, Printer, Package, FileWarning, Loader2, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { useAuth } from '@/hooks/useAuth';
import { HelpButton } from '@/components/HelpButton';
import { api } from '@/lib/api';
import { cn, formatCurrency, haceCuanto } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';
import { AsistenteDevolucion } from '@/components/devoluciones/AsistenteDevolucion';

interface Devolucion {
  id: string; numero: string; fecha: string; estado: 'emitida' | 'anulada'; motivo: string;
  valor_total: number; aplicado_a_saldo: number; reintegro_monto: number; credito_monto: number;
  requiere_nc: boolean; created_at: string; cliente_nombre: string | null; cliente_id: string;
  operacion_numero: string | null; remito_numero: string | null; creado_por: string | null;
  unidades: number; unidades_perdidas: number;
  /** Si la devolución fue un cambio: la operación del producto nuevo. */
  cambio_numero?: string | null; cambio_operacion_id?: string | null;
  /** Había ítems facturados y todavía no se emitió la nota de crédito. */
  nc_pendiente?: boolean;
  /** Parte del crédito de esta devolución que ya se gastó (en el cambio o en un recibo). */
  credito_usado?: number;
}
interface ItemDev {
  id: string; descripcion: string; cantidad: number; destino: 'stock' | 'no_reingresa';
  motivo_item: string | null; precio_unitario_neto: number; estado_producto: string;
}
interface DevolucionDetalle extends Devolucion {
  items: ItemDev[]; anulada_motivo: string | null; cambio_total?: number | null;
  reintegros?: { id: string; numero: string; monto: number; forma_pago: string; estado: string }[];
}
interface FacturaDev { id: string; clase: string; punto_venta: number; numero: number | null; fecha: string; imp_total: number | string }
const nroFactura = (f: FacturaDev) => `${f.clase} ${String(f.punto_venta).padStart(4, '0')}-${String(f.numero ?? 0).padStart(8, '0')}`;

interface Reintegro {
  id: string; numero: string; fecha: string; monto: number; forma_pago: string; referencia: string | null; motivo: string | null;
  estado: 'emitido' | 'anulado'; motivo_anulacion: string | null; cliente_nombre: string | null; cliente_id: string;
  devolucion_numero: string | null; creado_por: string | null; anulado_por: string | null;
}
interface RemitoMin {
  id: string; numero: string; estado: string; fecha_emision: string; operacion: { numero: string } | null;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
  items_resumen: { descripcion: string; cantidad: number }[] | null;
}

const num = (n: unknown) => Number(n ?? 0);
const fmtFecha = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const nombreCliente = (c: RemitoMin['cliente']) =>
  c.tipo_persona === 'juridica' ? c.razon_social ?? '—' : [c.apellido, c.nombre].filter(Boolean).join(' ') || '—';

// ── Detalle ──────────────────────────────────────────────────────────

function DetalleDevolucion({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [d, setD] = useState<DevolucionDetalle | null>(null);
  const [facturas, setFacturas] = useState<FacturaDev[]>([]);
  // Anular (solo admin): confirmación roja dentro del modal; si algo ya se usó, el servidor dice qué hay que deshacer primero
  const [anulando, setAnulando] = useState(false);
  const [motivoAnul, setMotivoAnul] = useState('');
  const [errAnul, setErrAnul] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    api.get<DevolucionDetalle>(`/devoluciones/${id}`).then(setD).catch(() => onClose());
  }, [id, onClose]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (d?.nc_pendiente) api.get<FacturaDev[]>(`/devoluciones/${id}/facturas`).then(setFacturas).catch(() => setFacturas([]));
  }, [id, d?.nc_pendiente]);

  async function confirmarAnulacion() {
    setEnviando(true); setErrAnul(null);
    try {
      await api.post(`/devoluciones/${id}/anular`, { motivo_anulacion: motivoAnul.trim() });
      toast.success('Devolución anulada: el stock y el saldo a favor se revirtieron');
      setAnulando(false); setMotivoAnul(''); cargar(); onChanged();
    } catch (e) {
      setErrAnul(e instanceof Error ? e.message : 'No se pudo anular la devolución');
    } finally { setEnviando(false); }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Undo2 size={18} className="text-amber-700" /></div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{d?.numero ?? '…'}</p>
            {d && <p className="text-xs text-gray-600 truncate">{d.cliente_nombre} · {fmtFecha(d.fecha)}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600"><X size={20} /></button>
        </div>
        {!d ? (
          <div className="flex-1 flex items-center justify-center py-10"><Loader2 className="animate-spin text-amber-500" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {d.operacion_numero && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{d.operacion_numero}</span>}
              {d.remito_numero && <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">Remito {d.remito_numero}</span>}
              {d.cambio_numero && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">Cambio → {d.cambio_numero}{d.cambio_total ? ` · ${formatCurrency(num(d.cambio_total))}` : ''}</span>}
              {d.estado === 'anulada' && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Anulada</span>}
              {d.nc_pendiente && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">Falta nota de crédito</span>}
              {d.requiere_nc && !d.nc_pendiente && d.estado === 'emitida' && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Nota de crédito emitida</span>}
            </div>
            <p className="text-sm text-gray-700"><span className="font-semibold">Motivo:</span> {d.motivo}</p>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
              {d.items.map(it => (
                <div key={it.id} className="px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words">{it.cantidad} × {it.descripcion}</span>
                    <span className="shrink-0 tabular-nums">{formatCurrency(num(it.precio_unitario_neto) * it.cantidad)}</span>
                  </div>
                  <p className="text-[11px] mt-0.5">
                    {it.destino === 'stock'
                      ? <span className="text-emerald-700">Volvió a stock · {it.estado_producto.replace('_', ' ')}</span>
                      : <span className="text-red-700">No reingresa — {it.motivo_item}</span>}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
              <div className="flex justify-between px-3 py-2"><span>Valor devuelto</span><b>{formatCurrency(num(d.valor_total))}</b></div>
              {num(d.aplicado_a_saldo) > 0 && <div className="flex justify-between px-3 py-2"><span>Bajó la deuda de la operación</span><b>{formatCurrency(num(d.aplicado_a_saldo))}</b></div>}
              {num(d.reintegro_monto) > 0 && (
                <div className="flex justify-between px-3 py-2 text-amber-700">
                  <span>Devuelto en dinero{d.reintegros?.[0] ? ` · ${d.reintegros[0].numero} (${d.reintegros[0].forma_pago})` : ''}</span>
                  <b>{formatCurrency(num(d.reintegro_monto))}</b>
                </div>
              )}
              {num(d.credito_usado) > 0 && (
                <div className="flex justify-between px-3 py-2 text-emerald-700">
                  <span>{d.cambio_numero ? `Usado para pagar el cambio (${d.cambio_numero})` : 'Ya usado en recibos'}</span><b>−{formatCurrency(num(d.credito_usado))}</b>
                </div>
              )}
              {num(d.credito_monto) - num(d.credito_usado) > 0.009 && (
                <div className="flex justify-between px-3 py-2 text-violet-700"><span>Saldo a favor del cliente</span><b>{formatCurrency(num(d.credito_monto) - num(d.credito_usado))}</b></div>
              )}
            </div>
            {d.nc_pendiente && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2" data-testid="aviso-nc">
                <p className="text-xs text-amber-900 flex gap-1.5"><FileWarning size={14} className="shrink-0 mt-0.5" />
                  Esta devolución incluye ítems que estaban facturados. Hay que hacer la nota de crédito en Facturación (no se emite sola).</p>
                {facturas.map(f => (
                  <button key={f.id} onClick={() => navigate(`/facturacion/nueva?factura_id=${f.id}`)}
                    className="w-full min-h-11 px-3 rounded-lg border border-amber-300 bg-white text-amber-900 text-sm font-semibold text-left flex items-center justify-between gap-2">
                    <span>Nota de crédito de {nroFactura(f)}</span><span className="text-xs tabular-nums">{formatCurrency(num(f.imp_total))}</span>
                  </button>
                ))}
                <p className="text-[11px] text-amber-800">Acreditá solo los ítems devueltos: {d.items.map(i => `${i.cantidad} × ${i.descripcion}`).join(', ')}.</p>
              </div>
            )}
            {d.estado === 'anulada' && d.anulada_motivo && (
              <p className="text-sm text-red-700"><span className="font-semibold">Anulada:</span> {d.anulada_motivo}</p>
            )}
            {d.creado_por && <p className="text-[11px] text-gray-500">Registrada por {d.creado_por} · {haceCuanto(d.created_at)}</p>}
            {user?.rol === 'admin' && d.estado === 'emitida' && !anulando && (
              <button onClick={() => { setAnulando(true); setErrAnul(null); }} data-testid="btn-anular-devolucion"
                className="w-full h-11 rounded-xl border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50">Anular devolución</button>
            )}
            {anulando && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 space-y-2" data-testid="confirmar-anulacion">
                <p className="text-sm font-semibold text-red-800">¿Anular {d.numero}?</p>
                <p className="text-xs text-red-800">La mercadería que volvió a stock se descuenta de nuevo, se quita el saldo a favor que dejó y la deuda de la operación vuelve a ser la de antes.</p>
                <input value={motivoAnul} onChange={e => setMotivoAnul(e.target.value)} maxLength={300} autoFocus placeholder="Motivo de la anulación"
                  className="w-full h-11 border border-red-200 bg-white rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-red-400" />
                {errAnul && <p className="text-xs font-semibold text-red-900 bg-white border border-red-300 rounded-lg p-2" role="alert">{errAnul}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setAnulando(false)} disabled={enviando} className="h-11 px-4 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700">Volver</button>
                  <button onClick={confirmarAnulacion} disabled={enviando || motivoAnul.trim().length < 3}
                    className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                    {enviando && <Loader2 size={14} className="animate-spin" />} Anular devolución
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="shrink-0 border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => window.open(`/imprimir/devolucion/${id}`, '_blank')} disabled={!d}
            className="w-full h-12 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50">
            <Printer size={15} /> Imprimir comprobante
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Elegir de qué remito se devuelve ─────────────────────────────────

function ElegirRemito({ onElegir, onClose }: { onElegir: (remitoId: string) => void; onClose: () => void }) {
  const [remitos, setRemitos] = useState<RemitoMin[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    api.get<{ remitos: RemitoMin[] }>('/remitos/tablero')
      .then(d => setRemitos(d.remitos.filter(r => ['emitido', 'entregado'].includes(r.estado))))
      .catch(() => setRemitos([]));
  }, []);
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (remitos ?? []).filter(r => !t || r.numero.toLowerCase().includes(t) || nombreCliente(r.cliente).toLowerCase().includes(t)
      || (r.operacion?.numero ?? '').toLowerCase().includes(t)).slice(0, 40);
  }, [remitos, q]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[85dvh] sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <p className="flex-1 font-bold text-gray-900">¿De qué remito se devuelve?</p>
          <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-3 border-b border-gray-200 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Número de remito, cliente o presupuesto"
              className="w-full h-11 pl-9 pr-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {remitos === null ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>
            : filtrados.length === 0 ? <p className="p-6 text-sm text-gray-600 text-center">No hay remitos emitidos o entregados que coincidan.</p>
            : filtrados.map(r => (
              <button key={r.id} onClick={() => onElegir(r.id)} className="w-full text-left px-4 py-3 hover:bg-amber-50 min-h-[56px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-gray-900 truncate">{nombreCliente(r.cliente)}</span>
                  <span className="text-[11px] font-mono text-gray-600 shrink-0">{r.numero}</span>
                </div>
                <p className="text-[11px] text-gray-600 truncate">
                  {fmtFecha(r.fecha_emision)}{r.operacion ? ` · ${r.operacion.numero}` : ''}
                  {r.items_resumen?.[0] ? ` · ${r.items_resumen[0].cantidad} ${r.items_resumen[0].descripcion}${r.items_resumen.length > 1 ? ` +${r.items_resumen.length - 1}` : ''}` : ''}
                </p>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Reintegros (dinero que salió de caja hacia clientes) ─────────────

function ReintegrosPanel({ esAdmin }: { esAdmin: boolean }) {
  const [lista, setLista] = useState<Reintegro[] | null>(null);
  const [anulando, setAnulando] = useState<Reintegro | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => { api.get<Reintegro[]>('/reintegros').then(setLista).catch(() => setLista([])); }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const total = (lista ?? []).filter(r => r.estado === 'emitido').reduce((a, r) => a + num(r.monto), 0);

  async function confirmarAnulacion() {
    if (!anulando) return;
    setEnviando(true);
    try {
      await api.post(`/reintegros/${anulando.id}/anular`, { motivo_anulacion: motivo.trim() });
      toast.success(`${anulando.numero} anulado: el dinero vuelve a quedar a favor del cliente`);
      setAnulando(null); setMotivo(''); cargar();
    } catch (e) {
      toastApiError(e, { fallback: 'No se pudo anular el reintegro' });
    } finally { setEnviando(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4 space-y-3" data-testid="panel-reintegros">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Banknote size={15} className="text-amber-600" /> Dinero devuelto a clientes</p>
        <p className="text-sm font-extrabold text-gray-900 tabular-nums">{formatCurrency(total)}</p>
      </div>
      {lista === null ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>
        : lista.length === 0 ? <p className="py-10 text-center text-sm text-gray-600">Todavía no se devolvió dinero a ningún cliente.</p>
        : (
          <div className="space-y-1.5">
            {lista.map(r => (
              <div key={r.id} className={cn('rounded-xl border border-gray-200 border-l-4 px-3 py-2.5', r.estado === 'anulado' ? 'border-l-gray-300 opacity-60' : 'border-l-amber-400')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{r.cliente_nombre ?? '—'}</p>
                    <p className="text-[11px] text-gray-600 truncate">
                      <span className="font-mono">{r.numero}</span> · {fmtFecha(r.fecha)} · {r.forma_pago}{r.referencia ? ` (${r.referencia})` : ''}
                      {r.devolucion_numero ? ` · ${r.devolucion_numero}` : ' · saldo a favor'}
                    </p>
                    {r.motivo && <p className="text-[11px] text-gray-500 truncate">{r.motivo}</p>}
                  </div>
                  <p className="text-sm font-bold text-gray-900 tabular-nums shrink-0">{formatCurrency(num(r.monto))}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {r.creado_por && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">por {r.creado_por}</span>}
                  {r.estado === 'anulado' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold" title={r.motivo_anulacion ?? undefined}>Anulado</span>}
                  <button onClick={() => window.open(`/imprimir/reintegro/${r.id}`, '_blank')} data-testid="btn-imprimir-reintegro-lista"
                    className="ml-auto h-9 px-3 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 flex items-center gap-1.5"><Printer size={12} /> Imprimir</button>
                  {esAdmin && r.estado === 'emitido' && (
                    <button onClick={() => { setAnulando(r); setMotivo(''); }}
                      className="h-9 px-3 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50">Anular</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      {anulando && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex sm:items-center sm:justify-center sm:p-4" onClick={e => { if (e.target === e.currentTarget && !enviando) setAnulando(null); }}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl mt-auto sm:mt-0 rounded-t-2xl p-4 space-y-3 max-h-[90dvh] overflow-y-auto">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              <p className="font-semibold">¿Anular {anulando.numero} por {formatCurrency(num(anulando.monto))}?</p>
              <p className="text-xs mt-1">El dinero no salió de caja: vuelve a quedar como saldo a favor de {anulando.cliente_nombre}.</p>
            </div>
            <input value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300} autoFocus placeholder="Motivo de la anulación"
              className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-red-400" />
            <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
              <button onClick={() => setAnulando(null)} disabled={enviando} className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700">Volver</button>
              <button onClick={confirmarAnulacion} disabled={enviando || motivo.trim().length < 3}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {enviando && <Loader2 size={15} className="animate-spin" />} Anular reintegro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────

export function Devoluciones() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const vista = params.get('tab') === 'reintegros' ? 'reintegros' : 'devoluciones';
  const [lista, setLista] = useState<Devolucion[] | null>(null);
  const [estado, setEstado] = useState<'' | 'emitida' | 'anulada'>('');
  const [q, setQ] = useState('');
  const [verId, setVerId] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [remitoId, setRemitoId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api.get<Devolucion[]>(`/devoluciones${estado ? `?estado=${estado}` : ''}`).then(setLista).catch(() => setLista([]));
  }, [estado]);
  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (lista ?? []).filter(d => !t || d.numero.toLowerCase().includes(t) || (d.cliente_nombre ?? '').toLowerCase().includes(t)
      || (d.remito_numero ?? '').toLowerCase().includes(t) || (d.operacion_numero ?? '').toLowerCase().includes(t));
  }, [lista, q]);
  const totales = useMemo(() => {
    const v = (lista ?? []).filter(d => d.estado === 'emitida');
    return { n: v.length, valor: v.reduce((s, d) => s + num(d.valor_total), 0), perdidas: v.reduce((s, d) => s + d.unidades_perdidas, 0) };
  }, [lista]);

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4" data-section="remitos">
      <SectionHero
        section="remitos"
        icon={Undo2}
        title="Devoluciones"
        sub="Mercadería que vuelve, deuda que baja y saldo a favor del cliente"
        actions={<>
          <button onClick={cargar} aria-label="Actualizar" className="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-white/70 rounded-xl text-gray-600">
            <RefreshCw size={15} className={lista === null ? 'animate-spin' : ''} />
          </button>
          <HelpButton topic="devoluciones" />
          <button onClick={() => setEligiendo(true)} data-testid="btn-nueva-devolucion"
            className="h-11 sm:h-auto flex items-center gap-1.5 px-4 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold">
            <Plus size={14} /> Nueva devolución
          </button>
        </>}
      />

      <div className="flex gap-2">
        {([['devoluciones', 'Devoluciones', Undo2], ['reintegros', 'Dinero devuelto', Banknote]] as const).map(([v, l, Icono]) => (
          <button key={v} onClick={() => setParams(v === 'devoluciones' ? {} : { tab: v })} data-testid={`tab-${v}`}
            className={cn('h-11 px-4 rounded-xl border text-sm font-semibold flex items-center gap-1.5',
              vista === v ? 'bg-white border-gray-400 shadow-lg text-gray-900' : 'border-transparent text-gray-700 hover:bg-white/60')}>
            <Icono size={14} /> {l}
          </button>
        ))}
      </div>

      {vista === 'reintegros' ? <ReintegrosPanel esAdmin={user?.rol === 'admin'} /> : (<>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { l: 'Devoluciones', v: String(totales.n) },
          { l: 'Valor devuelto', v: formatCurrency(totales.valor) },
          { l: 'Unidades en pérdida', v: String(totales.perdidas) },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border border-gray-400 shadow-lg px-3 py-2.5 text-center">
            <p className="text-sm sm:text-lg font-extrabold text-gray-900 tabular-nums">{s.v}</p>
            <p className="text-[10px] sm:text-xs text-gray-600">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {([['', 'Todas'], ['emitida', 'Emitidas'], ['anulada', 'Anuladas']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setEstado(v)}
              className={cn('h-9 px-3 rounded-lg border text-xs font-semibold', estado === v ? 'bg-amber-600 border-amber-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>{l}</button>
          ))}
          <div className="relative flex-1 min-w-[10rem]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por número, cliente, remito…"
              className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-base sm:text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>

        {lista === null ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>
          : filtradas.length === 0 ? (
            <div className="py-12 text-center">
              <Package size={28} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-600">{lista.length === 0 ? 'Todavía no se registró ninguna devolución.' : 'Sin devoluciones en esta vista.'}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtradas.map(d => (
                <button key={d.id} onClick={() => setVerId(d.id)}
                  className={cn('w-full text-left rounded-xl border border-gray-200 border-l-4 px-3 py-2.5 hover:shadow-md transition-shadow',
                    d.estado === 'anulada' ? 'border-l-gray-300 opacity-60' : 'border-l-amber-400')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{d.cliente_nombre ?? '—'}</p>
                      <p className="text-[11px] text-gray-600 truncate">
                        <span className="font-mono">{d.numero}</span> · {fmtFecha(d.fecha)}
                        {d.remito_numero && ` · Remito ${d.remito_numero}`}{d.operacion_numero && ` · ${d.operacion_numero}`}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 tabular-nums shrink-0">{formatCurrency(num(d.valor_total))}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">{d.unidades} {d.unidades === 1 ? 'unidad' : 'unidades'}</span>
                    {d.unidades_perdidas > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">{d.unidades_perdidas} en pérdida</span>}
                    {d.cambio_numero && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">Cambio → {d.cambio_numero}</span>}
                    {num(d.credito_monto) - num(d.credito_usado) > 0.009 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">{formatCurrency(num(d.credito_monto) - num(d.credito_usado))} a favor</span>}
                    {d.nc_pendiente && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold flex items-center gap-1"><FileWarning size={9} /> Falta NC</span>}
                    {d.estado === 'anulada' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Anulada</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
      </div>
      </>)}

      {verId && <DetalleDevolucion id={verId} onClose={() => setVerId(null)} onChanged={cargar} />}
      {eligiendo && <ElegirRemito onClose={() => setEligiendo(false)} onElegir={id => { setEligiendo(false); setRemitoId(id); }} />}
      {remitoId && <AsistenteDevolucion origen={{ remito_id: remitoId }} onClose={() => setRemitoId(null)} onDone={cargar} />}
    </div>
  );
}
