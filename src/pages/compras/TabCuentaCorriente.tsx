import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet, Search, X, RefreshCw, FileDown, MessageCircle, Plus, ArrowLeft, Receipt, Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { BadgeProveedor } from '@/components/BadgeProveedor';
import type { AbrirDetalle } from './Compras';
import {
  TIPO_CC_LABEL, MEDIO_PAGO_LABEL, fmtFecha, fmtMoneda, abrirPdf,
  type ProveedorSaldo, type EstadoCuentaProveedor,
} from './tipos';
import { Badge, Paginacion, inpCls, lblCls, btnPrimario, btnSecundario } from './ui';
import { ModalPago } from './ModalPago';

const PER_PAGE = 12;

export function TabCuentaCorriente({ abrir, refresh, onChanged }: { abrir: AbrirDetalle; refresh: number; onChanged: () => void }) {
  const [filas, setFilas] = useState<ProveedorSaldo[]>([]);
  const [totales, setTotales] = useState({ deuda: 0, a_favor: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [soloConSaldo, setSoloConSaldo] = useState(true);
  const [proveedorId, setProveedorId] = useState<string | null>(null);
  const [pagando, setPagando] = useState<ProveedorSaldo | null>(null);

  const cargar = useCallback(async () => {
    try {
      const d = await api.get<{ proveedores: ProveedorSaldo[]; totales: { deuda: number; a_favor: number } }>('/compras/cuenta-corriente');
      setFilas(d.proveedores); setTotales(d.totales);
    } catch { toast.error('Error al cargar la cuenta corriente'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar, refresh]);

  const q = search.trim().toLowerCase();
  const visibles = filas
    .filter(p => !soloConSaldo || Math.abs(Number(p.saldo)) > 0.01)
    .filter(p => !q || p.nombre.toLowerCase().includes(q));
  const pagina = visibles.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (proveedorId) {
    return <EstadoCuenta proveedorId={proveedorId} onVolver={() => { setProveedorId(null); cargar(); }}
      onChanged={() => { cargar(); onChanged(); }} abrir={abrir} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-amber-200 shadow-md p-4">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-600">Total a pagar</p>
          <p className="text-2xl font-black text-amber-700 tabular-nums">{fmtMoneda(totales.deuda)}</p>
          <p className="text-[11px] text-gray-500">{filas.filter(p => Number(p.saldo) > 0.01).length} proveedor(es) con saldo</p>
        </div>
        <div className="bg-white rounded-xl border border-sky-200 shadow-md p-4">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-600">Saldo a favor</p>
          <p className="text-2xl font-black text-sky-700 tabular-nums">{fmtMoneda(totales.a_favor)}</p>
          <p className="text-[11px] text-gray-500">anticipos sin aplicar</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-400 shadow-md p-4">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-600">Posición neta</p>
          <p className="text-2xl font-black text-gray-900 tabular-nums">{fmtMoneda(totales.deuda - totales.a_favor)}</p>
          <p className="text-[11px] text-gray-500">lo que falta pagar menos lo que tenemos a favor</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-400 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-3 p-3 border-b border-gray-200">
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => { setSoloConSaldo(true); setPage(1); }}
              className={cn('text-xs font-semibold px-3 h-9 rounded-lg transition-colors', soloConSaldo ? 'bg-lime-600 text-white' : 'text-gray-600 hover:bg-gray-100')}>
              Con saldo
            </button>
            <button onClick={() => { setSoloConSaldo(false); setPage(1); }}
              className={cn('text-xs font-semibold px-3 h-9 rounded-lg transition-colors', !soloConSaldo ? 'bg-lime-600 text-white' : 'text-gray-600 hover:bg-gray-100')}>
              Todos
            </button>
          </div>
          <div className="relative flex-1 min-w-0 sm:max-w-xs sm:ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar proveedor…"
              className="w-full pl-8 pr-8 h-9 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-300" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={12} className="text-gray-500" /></button>}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><RefreshCw className="animate-spin text-lime-600" /></div>
        ) : pagina.length === 0 ? (
          <div className="py-12 text-center text-gray-600 text-sm">
            <Wallet size={32} className="mx-auto mb-2 opacity-30" />
            {soloConSaldo ? 'Ningún proveedor tiene saldo pendiente' : 'Sin proveedores'}
          </div>
        ) : (
          <div className="p-3 space-y-1.5">
            {pagina.map(p => {
              const saldo = Number(p.saldo);
              const aFavor = saldo < -0.01;
              return (
                <div key={p.id} onClick={() => setProveedorId(p.id)}
                  className={cn('rounded-xl border border-gray-200 border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all',
                    aFavor ? 'border-l-sky-400' : saldo > 0.01 ? 'border-l-amber-400' : 'border-l-emerald-400')}>
                  <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 truncate">{p.nombre}</span>
                        <BadgeProveedor proveedor={p} />
                        {!p.activo && <Badge label="Inactivo" cls="bg-gray-100 text-gray-600" />}
                      </div>
                      <p className="text-[11px] text-gray-600">
                        {p.ordenes_impagas > 0 ? `${p.ordenes_impagas} orden(es) sin pagar` : 'Sin órdenes pendientes'}
                        {p.ultimo_movimiento && ` · último movimiento ${fmtFecha(p.ultimo_movimiento)}`}
                      </p>
                    </div>
                    <div className="sm:text-right sm:shrink-0">
                      <p className={cn('text-base font-black tabular-nums', aFavor ? 'text-sky-700' : saldo > 0.01 ? 'text-amber-700' : 'text-emerald-700')}>
                        {fmtMoneda(Math.abs(saldo))}
                      </p>
                      <p className="text-[10px] text-gray-500">{aFavor ? 'a favor nuestro' : saldo > 0.01 ? 'a pagar' : 'al día'}</p>
                    </div>
                    <div className="flex gap-1.5 sm:shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setPagando(p)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-2.5 h-9">
                        <Plus size={12} /> Pago
                      </button>
                      <button onClick={() => setProveedorId(p.id)} className={cn(btnSecundario, 'h-9 px-2.5 text-[11px]')}>Ver cuenta</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Paginacion page={page} total={visibles.length} perPage={PER_PAGE} onPage={setPage} />
      </div>

      {pagando && (
        <ModalPago proveedorId={pagando.id} proveedorNombre={pagando.nombre}
          onClose={() => setPagando(null)}
          onHecho={() => { setPagando(null); cargar(); onChanged(); }} />
      )}
    </div>
  );
}

// ── Estado de cuenta de un proveedor ──────────────────────────────────────────

function EstadoCuenta({ proveedorId, onVolver, onChanged, abrir }: {
  proveedorId: string; onVolver: () => void; onChanged: () => void; abrir: AbrirDetalle;
}) {
  const [data, setData] = useState<EstadoCuentaProveedor | null>(null);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagando, setPagando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (desde) qs.set('desde', desde);
      if (hasta) qs.set('hasta', hasta);
      setData(await api.get<EstadoCuentaProveedor>(`/compras/proveedores/${proveedorId}/estado-cuenta?${qs}`));
    } catch { toast.error('Error al cargar el estado de cuenta'); }
    finally { setLoading(false); }
  }, [proveedorId, desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const qsPdf = useMemo(() => {
    const qs = new URLSearchParams();
    if (desde) qs.set('desde', desde);
    if (hasta) qs.set('hasta', hasta);
    return qs.toString();
  }, [desde, hasta]);

  async function enviarWhatsApp() {
    if (!data) return;
    setEnviando(true);
    try {
      await api.post(`/compras/proveedores/${proveedorId}/estado-cuenta/enviar-whatsapp?${qsPdf}`, {});
      toast.success(`Estado de cuenta enviado a ${data.proveedor.nombre}`);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo enviar' }); }
    finally { setEnviando(false); }
  }

  if (loading && !data) return <div className="flex items-center justify-center h-40"><RefreshCw className="animate-spin text-lime-600" /></div>;
  if (!data) return null;

  const t = data.totales;
  const aFavor = t.saldo_actual < -0.01;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button onClick={onVolver} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg font-bold text-gray-900">{data.proveedor.nombre}</p>
              <BadgeProveedor proveedor={data.proveedor} />
            </div>
            <p className="text-xs text-gray-600">
              {[data.proveedor.contacto, data.proveedor.telefono, data.proveedor.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPagando(true)} className={cn(btnPrimario, 'bg-emerald-600 hover:bg-emerald-700')}><Plus size={14} /> Registrar pago</button>
            <button onClick={() => abrirPdf(`/compras/proveedores/${proveedorId}/estado-cuenta/pdf?${qsPdf}`).catch(e => toast.error(e.message))} className={btnSecundario}>
              <FileDown size={14} /> PDF
            </button>
            {data.proveedor.telefono && (
              <button onClick={enviarWhatsApp} disabled={enviando}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-xl px-3 h-11 sm:h-10 disabled:opacity-50">
                <MessageCircle size={14} /> {enviando ? 'Enviando…' : 'WhatsApp'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-4">
          {[
            { l: 'Saldo anterior', v: data.saldo_inicial, c: 'text-gray-700' },
            { l: 'Compras + débitos', v: t.compras + t.debitos, c: 'text-gray-900' },
            { l: 'Pagos', v: t.pagos, c: 'text-emerald-700' },
            { l: 'Créditos', v: t.creditos, c: 'text-emerald-700' },
            { l: aFavor ? 'Saldo a favor' : 'Saldo a pagar', v: Math.abs(t.saldo_actual), c: aFavor ? 'text-sky-700' : Math.abs(t.saldo_actual) <= 0.01 ? 'text-emerald-700' : 'text-amber-700' },
          ].map(x => (
            <div key={x.l} className="p-2.5 rounded-xl border border-gray-200 bg-gray-50">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-600">{x.l}</p>
              <p className={cn('text-base font-black tabular-nums', x.c)}>{fmtMoneda(x.v)}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 mt-4 pt-3 border-t border-gray-200">
          <div><label className={lblCls}>Desde</label><input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inpCls} /></div>
          <div><label className={lblCls}>Hasta</label><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inpCls} /></div>
          {(desde || hasta) && <button onClick={() => { setDesde(''); setHasta(''); }} className={cn(btnSecundario, 'h-10')}>Ver todo</button>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-400 shadow-lg overflow-hidden">
        {data.movimientos.length === 0 ? (
          <div className="py-12 text-center text-gray-600 text-sm">
            <Receipt size={32} className="mx-auto mb-2 opacity-30" />
            Sin movimientos en este período
          </div>
        ) : (
          <>
            {/* Mobile: tarjetas · Desktop: tabla */}
            <div className="sm:hidden divide-y divide-gray-100">
              {data.movimientos.map(m => {
                const cfg = TIPO_CC_LABEL[m.tipo];
                return (
                  <div key={m.id} className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-gray-600">{fmtFecha(m.fecha)}</span>
                      <Badge label={cfg.label} cls={cfg.cls} />
                      {m.pedido_id && <button onClick={() => abrir('oc', m.pedido_id!)} className="text-[10px] font-mono text-emerald-700 hover:underline">{m.pedido_numero}</button>}
                    </div>
                    <p className="text-sm text-gray-800 mt-0.5">{m.concepto}</p>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={cn('text-base font-bold tabular-nums', m.monto > 0 ? 'text-gray-900' : 'text-emerald-700')}>
                        {m.monto > 0 ? '+' : '−'}{fmtMoneda(Math.abs(m.monto))}
                      </span>
                      <span className="text-xs text-gray-600 tabular-nums">saldo {fmtMoneda(m.saldo_acumulado)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Tipo</th>
                    <th className="text-left px-3 py-2">Concepto</th>
                    <th className="text-left px-3 py-2">Orden</th>
                    <th className="text-right px-3 py-2">Debe</th>
                    <th className="text-right px-3 py-2">Haber</th>
                    <th className="text-right px-3 py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-gray-50/60">
                    <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold text-gray-600">Saldo anterior</td>
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums text-gray-700">{fmtMoneda(data.saldo_inicial)}</td>
                  </tr>
                  {data.movimientos.map(m => {
                    const cfg = TIPO_CC_LABEL[m.tipo];
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                        <td className="px-3 py-2"><Badge label={cfg.label} cls={cfg.cls} /></td>
                        <td className="px-3 py-2 text-gray-800">
                          {m.concepto}
                          {m.pago_medio && <span className="text-[11px] text-gray-500"> · {MEDIO_PAGO_LABEL[m.pago_medio]}{m.nro_operacion ? ` ${m.nro_operacion}` : ''}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {m.pedido_id
                            ? <button onClick={() => abrir('oc', m.pedido_id!)} className="text-[11px] font-mono text-emerald-700 hover:underline">{m.pedido_numero}</button>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.monto > 0 ? fmtMoneda(m.monto) : ''}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{m.monto < 0 ? fmtMoneda(Math.abs(m.monto)) : ''}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtMoneda(m.saldo_acumulado)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-xs uppercase tracking-wider text-gray-600">Totales</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoneda(t.compras + t.debitos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{fmtMoneda(t.pagos + t.creditos)}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', aFavor ? 'text-sky-700' : 'text-amber-700')}>{fmtMoneda(t.saldo_final)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
        <Check size={12} /> Saldo positivo = pendiente de pago. Saldo negativo = saldo a nuestro favor (anticipos o notas de crédito sin usar).
      </p>

      {pagando && (
        <ModalPago proveedorId={proveedorId} proveedorNombre={data.proveedor.nombre}
          onClose={() => setPagando(false)}
          onHecho={() => { setPagando(false); cargar(); onChanged(); }} />
      )}
    </div>
  );
}
