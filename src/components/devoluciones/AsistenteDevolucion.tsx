import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Undo2, Minus, Plus, AlertTriangle, CheckCircle2, RefreshCw, Printer, ChevronLeft, Package, FileWarning,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { SelectorCambio, type ItemCambio } from '@/components/devoluciones/SelectorCambio';
import {
  calcularResultado, FORMAS_REINTEGRO, type DestinoDevolucion, type FormaReintegro, type LineaDevolvible, type PreparacionDevolucion,
} from '@/lib/devolucion';

interface Seleccion {
  cantidad: number;
  destino: DestinoDevolucion;
  motivo_item: string;
  estado_producto: 'nuevo' | 'bueno' | 'con_detalles';
  precio: string;   // solo si el ítem no tiene precio en el remito ni en el presupuesto
}

interface Creada {
  id: string; numero: string; valor_total: number; aplicado_a_saldo: number; credito_monto: number; requiere_nc: boolean;
  reintegro_monto: number; reintegro_numero: string | null;
  cambio?: {
    operacion: { id: string; numero: string; total: number }; remito: { numero: string };
    pagado_con_saldo_favor: number; diferencia_cobrada: number; diferencia_pendiente: number;
  };
}

// Cómo paga el cliente lo que le falta si el producto nuevo cuesta más ('pendiente' = queda a cobrar después)
const FORMAS_DIFERENCIA = ['Contado', 'Tarjeta de débito/crédito en 1 pago', 'Transferencia', 'Tarjeta de crédito 3 cuotas sin interés'] as const;

const MOTIVOS_PERDIDA = ['Falla de fábrica', 'Rota o dañada', 'Mal estado'];
const MOTIVOS_DEVOLUCION = ['No le gustó', 'Medida equivocada', 'Falla del producto', 'Error en el pedido'];
const ESTADOS: { v: Seleccion['estado_producto']; l: string }[] = [
  { v: 'nuevo', l: 'Nuevo' }, { v: 'bueno', l: 'Bueno' }, { v: 'con_detalles', l: 'Con detalles' },
];

// Devolución de un cliente: qué ítems vuelven (cantidad, a stock o pérdida), y el resultado
// económico antes de confirmar. Pantalla completa en el celular, modal en escritorio.
export function AsistenteDevolucion({ origen, onClose, onDone }: {
  origen: { remito_id?: string | null; operacion_id?: string | null };
  onClose: () => void;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const [prep, setPrep] = useState<PreparacionDevolucion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, Seleccion>>({});
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  // Cambio: el cliente se lleva otro producto (se entrega en el momento)
  const [quiereCambio, setQuiereCambio] = useState(false);
  const [itemsCambio, setItemsCambio] = useState<ItemCambio[]>([]);
  const [formaDiferencia, setFormaDiferencia] = useState<typeof FORMAS_DIFERENCIA[number] | 'pendiente'>('Contado');
  const [motivo, setMotivo] = useState('');
  // Qué se hace con la plata que sobra (la que el cliente ya había pagado): a favor, en dinero o repartida
  const [reparto, setReparto] = useState<'favor' | 'dinero' | 'mixto'>('favor');
  const [montoMixto, setMontoMixto] = useState('');
  const [formaReintegro, setFormaReintegro] = useState<FormaReintegro>('Efectivo');
  const [refReintegro, setRefReintegro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [creada, setCreada] = useState<Creada | null>(null);

  useEffect(() => {
    const q = origen.remito_id ? `remito_id=${origen.remito_id}` : `operacion_id=${origen.operacion_id}`;
    api.get<PreparacionDevolucion>(`/devoluciones/preparar?${q}`)
      .then(setPrep)
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar lo devolvible'));
  }, [origen.remito_id, origen.operacion_id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, enviando]);

  const lineas = prep?.lineas ?? [];
  const devolvibles = lineas.filter(l => l.maximo > 0 && !(l.tipo_item === 'a_medida' && !esAdmin));
  const elegidas = lineas.filter(l => (sel[l.remito_item_id]?.cantidad ?? 0) > 0);

  function cambiar(l: LineaDevolvible, parcial: Partial<Seleccion>) {
    setSel(prev => {
      const actual = prev[l.remito_item_id] ?? {
        cantidad: 0, destino: l.tipo_item === 'a_medida' || !l.producto_id ? 'no_reingresa' : 'stock',
        motivo_item: '', estado_producto: 'nuevo', precio: '',
      } as Seleccion;
      return { ...prev, [l.remito_item_id]: { ...actual, ...parcial } };
    });
  }
  const setCantidad = (l: LineaDevolvible, n: number) => cambiar(l, { cantidad: Math.min(Math.max(n, 0), l.maximo) });

  function todo() {
    const todos = devolvibles.every(l => (sel[l.remito_item_id]?.cantidad ?? 0) === l.maximo);
    devolvibles.forEach(l => setCantidad(l, todos ? 0 : l.maximo));
  }

  const destinoDe = (l: LineaDevolvible) => sel[l.remito_item_id]?.destino ?? (l.tipo_item === 'a_medida' || !l.producto_id ? 'no_reingresa' : 'stock');
  const precioDe = (l: LineaDevolvible) => l.precio_bruto ?? (parseFloat(sel[l.remito_item_id]?.precio ?? '') || 0);

  // Qué falta para poder continuar (se muestra y bloquea el botón)
  const faltantes = useMemo(() => {
    const f: string[] = [];
    if (elegidas.length === 0) f.push('Elegí al menos un ítem');
    for (const l of elegidas) {
      const s = sel[l.remito_item_id];
      if (destinoDe(l) === 'no_reingresa' && l.tipo_item !== 'a_medida' && !s?.motivo_item.trim()) f.push(`${l.nombre}: indicá por qué no vuelve a stock`);
      if (l.sin_precio && !(parseFloat(s?.precio ?? '') > 0)) f.push(`${l.nombre}: cargá el precio`);
    }
    return f;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, prep]);

  const resultado = useMemo(() => calcularResultado(
    prep?.operacion ?? null,
    elegidas.map(l => ({ cantidad: sel[l.remito_item_id].cantidad, precio_bruto: precioDe(l) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [sel, prep]);
  const hayFacturado = elegidas.some(l => l.facturado);

  // Cambio: el producto nuevo se paga primero con la plata del cliente que sobra de la devolución (U);
  // lo que falta lo paga él (D) y, si sobra, se reparte entre dinero y saldo a favor (lo de abajo).
  const eC = Math.round(resultado.excedente * 100);
  const totalCambioC = quiereCambio ? itemsCambio.reduce((a, i) => a + Math.round(i.precio_unitario * 100) * i.cantidad, 0) : 0;
  const usadoC = Math.min(eC, totalCambioC);
  const diferenciaC = totalCambioC - usadoC;
  const cambioInvalido = quiereCambio && (itemsCambio.length === 0 || itemsCambio.some(i => !(i.precio_unitario > 0)));

  // Lo que sale en dinero (0 si todo queda a favor) y lo que queda a favor, en centavos para no perder uno.
  const excedenteC = eC - usadoC;
  const reintegroC = excedenteC <= 0 ? 0
    : reparto === 'dinero' ? excedenteC
    : reparto === 'mixto' ? Math.round((parseFloat(montoMixto) || 0) * 100) : 0;
  const reintegro = reintegroC / 100;
  const aFavor = (excedenteC - reintegroC) / 100;
  const repartoInvalido = reparto === 'mixto' && excedenteC > 0 && (reintegroC <= 0 || reintegroC >= excedenteC);

  async function confirmar() {
    if (motivo.trim().length < 3) { toast.error('Contá el motivo de la devolución'); return; }
    if (repartoInvalido) { toast.error('En el reparto, el dinero a devolver tiene que ser menos que lo que sobra'); return; }
    setEnviando(true);
    try {
      const nueva = await api.post<Creada>('/devoluciones', {
        remito_id: origen.remito_id ?? null,
        operacion_id: origen.remito_id ? null : origen.operacion_id,
        motivo: motivo.trim(),
        cambio: quiereCambio ? {
          items: itemsCambio.map(i => ({ producto_id: i.producto_id, descripcion: i.nombre, cantidad: i.cantidad, precio_unitario: i.precio_unitario })),
          pago_diferencia: diferenciaC > 0 && formaDiferencia !== 'pendiente' ? { forma_pago: formaDiferencia } : null,
        } : null,
        reintegro: reintegroC > 0 ? { monto: reintegro, forma_pago: formaReintegro, referencia: refReintegro.trim() || null } : null,
        items: elegidas.map(l => {
          const s = sel[l.remito_item_id];
          return {
            remito_item_id: l.remito_item_id, cantidad: s.cantidad, destino: destinoDe(l),
            motivo_item: s.motivo_item.trim() || null, estado_producto: s.estado_producto,
            precio_unitario: l.sin_precio ? parseFloat(s.precio) : null,
          };
        }),
      });
      setCreada(nueva);
    } catch (e) {
      toastApiError(e, { fallback: 'No se pudo registrar la devolución' });
    } finally {
      setEnviando(false);
    }
  }

  const cerrar = () => { if (creada) onDone?.(); onClose(); };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget && !enviando) cerrar(); }}>
      <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:rounded-2xl shadow-2xl flex flex-col"
        data-testid="asistente-devolucion">

        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Undo2 size={18} className="text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 leading-tight">Registrar devolución</p>
            <p className="text-xs text-gray-600 truncate">
              {creada ? creada.numero : paso === 1 ? 'Paso 1 de 3 · qué vuelve' : paso === 2 ? 'Paso 2 de 3 · ¿se lleva otro producto?' : 'Paso 3 de 3 · resultado'}
              {prep?.operacion && !creada ? ` · ${prep.operacion.numero}` : ''}
            </p>
          </div>
          <button type="button" onClick={cerrar} disabled={enviando} aria-label="Cerrar"
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600 disabled:opacity-40">
            <X size={20} />
          </button>
        </div>

        {/* ── Cuerpo ── */}
        {error ? (
          <div className="flex-1 p-4"><div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div></div>
        ) : !prep ? (
          <div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin text-amber-500" /></div>
        ) : creada ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-center">
            <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
            <div>
              <p className="text-lg font-bold text-gray-900">Devolución {creada.numero} registrada</p>
              <p className="text-sm text-gray-600">Por {formatCurrency(creada.valor_total)}</p>
            </div>
            <div className="text-left rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
              {creada.aplicado_a_saldo > 0 && (
                <div className="flex justify-between px-3 py-2"><span>Bajó la deuda de la operación</span><b>{formatCurrency(creada.aplicado_a_saldo)}</b></div>
              )}
              {creada.cambio && (
                <div className="px-3 py-2 text-emerald-800 bg-emerald-50/60">
                  <div className="flex justify-between"><span>Se llevó a cambio ({creada.cambio.operacion.numero})</span><b>{formatCurrency(creada.cambio.operacion.total)}</b></div>
                  <p className="text-[11px] mt-0.5">Remito {creada.cambio.remito.numero} entregado
                    {creada.cambio.diferencia_cobrada > 0 && ` · cobrada la diferencia ${formatCurrency(creada.cambio.diferencia_cobrada)}`}
                    {creada.cambio.diferencia_pendiente > 0 && ` · pendiente de cobro ${formatCurrency(creada.cambio.diferencia_pendiente)}`}</p>
                </div>
              )}
              {creada.reintegro_monto > 0 && (
                <div className="flex justify-between px-3 py-2 text-amber-700">
                  <span>Devuelto en dinero{creada.reintegro_numero ? ` (${creada.reintegro_numero})` : ''}</span><b>{formatCurrency(creada.reintegro_monto)}</b>
                </div>
              )}
              {creada.credito_monto - (creada.cambio?.pagado_con_saldo_favor ?? 0) > 0.009 && (
                <div className="flex justify-between px-3 py-2 text-violet-700">
                  <span>Saldo a favor del cliente</span><b>{formatCurrency(creada.credito_monto - (creada.cambio?.pagado_con_saldo_favor ?? 0))}</b>
                </div>
              )}
            </div>
            {creada.requiere_nc && (
              <div className="flex gap-2 text-left p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <FileWarning size={16} className="shrink-0 mt-0.5" />
                Había ítems facturados: falta hacer la nota de crédito en Facturación.
              </div>
            )}
          </div>
        ) : paso === 1 ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {devolvibles.length > 1 && (
              <button type="button" onClick={todo} className="text-xs font-semibold text-amber-700 hover:underline h-8">
                Devolver todo
              </button>
            )}
            {lineas.length === 0 && <p className="text-sm text-gray-600">No hay mercadería entregada para devolver.</p>}
            {lineas.map(l => {
              const s = sel[l.remito_item_id];
              const n = s?.cantidad ?? 0;
              const noAdmin = l.tipo_item === 'a_medida' && !esAdmin;
              const deshabilitada = l.maximo <= 0 || noAdmin;
              const destino = destinoDe(l);
              return (
                <div key={l.remito_item_id}
                  className={cn('rounded-xl border p-3 space-y-2', n > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200', deshabilitada && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 break-words">{l.nombre}</p>
                      <p className="text-[11px] text-gray-600">
                        {l.producto_codigo ? `Cód. ${l.producto_codigo} · ` : ''}Entregado {l.entregado}
                        {l.devuelto > 0 && ` · ya devuelto ${l.devuelto}`}
                        {l.precio_bruto != null && ` · ${formatCurrency(l.precio_bruto)} c/u`}
                      </p>
                    </div>
                    {!deshabilitada && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => setCantidad(l, n - 1)} disabled={n <= 0} aria-label="Menos"
                          className="w-11 h-11 rounded-lg border border-gray-300 flex items-center justify-center disabled:opacity-30"><Minus size={16} /></button>
                        <span className="w-7 text-center font-bold tabular-nums">{n}</span>
                        <button type="button" onClick={() => setCantidad(l, n + 1)} disabled={n >= l.maximo} aria-label="Más"
                          className="w-11 h-11 rounded-lg border border-gray-300 flex items-center justify-center disabled:opacity-30"><Plus size={16} /></button>
                      </div>
                    )}
                  </div>
                  {l.bloqueo && <p className="text-xs text-gray-600">{l.bloqueo}</p>}
                  {l.maximo <= 0 && !l.bloqueo && <p className="text-xs text-gray-600">Ya se devolvió todo lo entregado.</p>}
                  {noAdmin && <p className="text-xs text-red-700">Producto a medida: solo un administrador puede registrar su devolución.</p>}
                  {l.aviso && esAdmin && l.maximo > 0 && (
                    <p className="flex gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {l.aviso}
                    </p>
                  )}
                  {l.facturado && n > 0 && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">Este ítem estaba facturado: después hay que hacer la nota de crédito.</p>
                  )}

                  {n > 0 && l.tipo_item !== 'a_medida' && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" disabled={!l.producto_id} onClick={() => cambiar(l, { destino: 'stock' })}
                          className={cn('h-11 rounded-xl border-2 text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40',
                            destino === 'stock' ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-700')}>
                          <Package size={14} /> Vuelve a stock
                        </button>
                        <button type="button" onClick={() => cambiar(l, { destino: 'no_reingresa' })}
                          className={cn('h-11 rounded-xl border-2 text-sm font-semibold',
                            destino === 'no_reingresa' ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-200 text-gray-700')}>
                          No reingresa
                        </button>
                      </div>
                      {!l.producto_id && <p className="text-[11px] text-gray-600">Ítem sin producto del catálogo: no puede volver a stock.</p>}
                      {destino === 'stock' ? (
                        <div className="flex flex-wrap gap-1.5">
                          {ESTADOS.map(e => (
                            <button key={e.v} type="button" onClick={() => cambiar(l, { estado_producto: e.v })}
                              className={cn('h-9 px-3 rounded-lg border text-xs font-semibold',
                                (s?.estado_producto ?? 'nuevo') === e.v ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600')}>
                              {e.l}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            {MOTIVOS_PERDIDA.map(m => (
                              <button key={m} type="button" onClick={() => cambiar(l, { motivo_item: m })}
                                className={cn('h-9 px-3 rounded-lg border text-xs font-semibold',
                                  s?.motivo_item === m ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-200 text-gray-600')}>{m}</button>
                            ))}
                          </div>
                          <input value={s?.motivo_item ?? ''} onChange={e => cambiar(l, { motivo_item: e.target.value })} maxLength={300}
                            placeholder="Motivo (queda como pérdida)"
                            className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-red-400" />
                        </div>
                      )}
                    </div>
                  )}
                  {n > 0 && l.sin_precio && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Precio unitario (no figura en el remito ni en el presupuesto)</label>
                      <input value={s?.precio ?? ''} onChange={e => cambiar(l, { precio: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.') })}
                        inputMode="decimal" placeholder="$"
                        className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : paso === 2 ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="paso-cambio">
            <div className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
              Devuelve {elegidas.reduce((a, l) => a + sel[l.remito_item_id].cantidad, 0)} unidad(es) por <b>{formatCurrency(resultado.valor_total)}</b>.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setQuiereCambio(false)}
                className={cn('min-h-12 px-2 rounded-xl border-2 text-sm font-semibold leading-tight',
                  !quiereCambio ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-200 text-gray-700')}>Solo devolución</button>
              <button type="button" onClick={() => setQuiereCambio(true)} data-testid="btn-quiere-cambio"
                className={cn('min-h-12 px-2 rounded-xl border-2 text-sm font-semibold leading-tight',
                  quiereCambio ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-200 text-gray-700')}>Cambiar por otro producto</button>
            </div>
            {quiereCambio && <SelectorCambio items={itemsCambio} onChange={setItemsCambio} />}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
              {elegidas.map(l => (
                <div key={l.remito_item_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 break-words">
                    {sel[l.remito_item_id].cantidad} × {l.nombre}
                    <span className={cn('ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                      destinoDe(l) === 'stock' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                      {destinoDe(l) === 'stock' ? 'a stock' : 'pérdida'}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
              <div className="flex justify-between px-3 py-2"><span>Valor de lo devuelto</span><b>{formatCurrency(resultado.valor_total)}</b></div>
              {prep.operacion && prep.operacion.descuentos > 0 && (
                <p className="px-3 py-1.5 text-[11px] text-gray-600">Ya descuenta la bonificación que tuvo la compra: no se devuelve lo que el cliente no pagó.</p>
              )}
              {prep.operacion && (
                <div className="flex justify-between px-3 py-2">
                  <span>Baja la deuda de {prep.operacion.numero}</span>
                  <b className={resultado.aplicado_a_saldo > 0 ? 'text-emerald-700' : ''}>{formatCurrency(resultado.aplicado_a_saldo)}</b>
                </div>
              )}
              <div className="flex justify-between px-3 py-2 bg-violet-50/60">
                <span>{resultado.excedente > 0 ? 'Plata del cliente que sobra' : 'Queda a favor del cliente'}</span>
                <b className="text-violet-700">{formatCurrency(resultado.excedente)}</b>
              </div>
              {prep.operacion && resultado.saldo_final != null && (
                <div className="flex justify-between px-3 py-2 text-gray-600">
                  <span>Saldo de la operación después</span><span>{formatCurrency(resultado.saldo_final)}</span>
                </div>
              )}
            </div>
            {quiereCambio && (
              <div className="rounded-xl border border-amber-300 divide-y divide-amber-100 text-sm bg-amber-50/40" data-testid="resumen-cambio">
                {itemsCambio.map(i => (
                  <div key={i.producto_id} className="flex justify-between gap-3 px-3 py-2">
                    <span className="break-words min-w-0">{i.cantidad} × {i.nombre}</span><b className="shrink-0">{formatCurrency(i.cantidad * i.precio_unitario)}</b>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 font-semibold"><span>Producto nuevo</span><b>{formatCurrency(totalCambioC / 100)}</b></div>
                {usadoC > 0 && (
                  <div className="flex justify-between px-3 py-2 text-violet-700"><span>Se paga con la plata que sobra de la devolución</span><b>−{formatCurrency(usadoC / 100)}</b></div>
                )}
                {diferenciaC > 0 && (
                  <div className="px-3 py-2 space-y-2" data-testid="diferencia">
                    <div className="flex justify-between font-semibold text-gray-900"><span>El cliente paga la diferencia</span><b>{formatCurrency(diferenciaC / 100)}</b></div>
                    <div className="flex flex-wrap gap-1.5">
                      {[...FORMAS_DIFERENCIA, 'pendiente' as const].map(f => (
                        <button key={f} type="button" onClick={() => setFormaDiferencia(f)}
                          className={cn('min-h-9 px-2.5 py-1 rounded-lg border text-xs font-semibold',
                            formaDiferencia === f ? 'border-amber-500 bg-white text-amber-900' : 'border-amber-200 text-amber-800')}>
                          {f === 'pendiente' ? 'Cobrar después' : f === 'Tarjeta de débito/crédito en 1 pago' ? 'Tarjeta 1 pago' : f === 'Tarjeta de crédito 3 cuotas sin interés' ? 'Tarjeta 3 cuotas' : f}
                        </button>
                      ))}
                    </div>
                    {formaDiferencia === 'pendiente' && <p className="text-[11px] text-gray-600">Queda como saldo pendiente de cobro en la operación nueva.</p>}
                  </div>
                )}
                {excedenteC > 0 && (
                  <div className="flex justify-between px-3 py-2 bg-violet-50/60"><span>Sobra a favor del cliente</span><b className="text-violet-700">{formatCurrency(excedenteC / 100)}</b></div>
                )}
              </div>
            )}

            {excedenteC > 0 && (
              <div className="space-y-2" data-testid="reparto">
                <p className="text-xs font-semibold text-gray-700">¿Qué se hace con los {formatCurrency(excedenteC / 100)} {quiereCambio ? 'que sobran' : 'que ya había pagado'}?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([['favor', 'Dejar a favor'], ['dinero', 'Devolver dinero'], ['mixto', 'Repartir']] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setReparto(v)}
                      className={cn('min-h-11 px-1 rounded-xl border-2 text-xs sm:text-sm font-semibold leading-tight',
                        reparto === v ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-700')}>{l}</button>
                  ))}
                </div>
                {reparto === 'mixto' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Dinero a devolver ahora</label>
                    <input value={montoMixto} onChange={e => setMontoMixto(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
                      inputMode="decimal" placeholder={`Hasta ${formatCurrency(excedenteC / 100)}`}
                      className={cn('w-full h-11 border rounded-xl px-3 text-base focus:outline-none focus:ring-2',
                        repartoInvalido && montoMixto ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-violet-400')} />
                  </div>
                )}
                {reintegro > 0 && (
                  <div className="space-y-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-xs text-amber-900">Sale <b>{formatCurrency(reintegro)}</b> de caja{aFavor > 0 ? <> y <b>{formatCurrency(aFavor)}</b> quedan a favor del cliente</> : null}. Se le avisa al administrador.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FORMAS_REINTEGRO.map(f => (
                        <button key={f} type="button" onClick={() => setFormaReintegro(f)}
                          className={cn('h-9 px-3 rounded-lg border text-xs font-semibold',
                            formaReintegro === f ? 'border-amber-500 bg-white text-amber-900' : 'border-amber-200 text-amber-800')}>{f}</button>
                      ))}
                    </div>
                    {formaReintegro !== 'Efectivo' && (
                      <input value={refReintegro} onChange={e => setRefReintegro(e.target.value)} maxLength={200}
                        placeholder={formaReintegro === 'Transferencia' ? 'N° de transferencia / CBU (opcional)' : 'Referencia (opcional)'}
                        className="w-full h-11 border border-amber-200 bg-white rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    )}
                  </div>
                )}
                {reintegro === 0 && <p className="text-xs text-gray-600">Queda como <b>saldo a favor</b> del cliente, para descontar de una próxima compra.</p>}
              </div>
            )}
            {hayFacturado && (
              <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <FileWarning size={16} className="shrink-0 mt-0.5" />
                Hay ítems facturados: la devolución queda registrada, pero hay que hacer la nota de crédito en Facturación.
              </div>
            )}

            <div>
              <label htmlFor="dev-motivo" className="block text-xs font-semibold text-gray-700 mb-1">Motivo de la devolución</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {MOTIVOS_DEVOLUCION.map(m => (
                  <button key={m} type="button" onClick={() => setMotivo(m)}
                    className={cn('h-9 px-3 rounded-lg border text-xs font-semibold',
                      motivo === m ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600')}>{m}</button>
                ))}
              </div>
              <input id="dev-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={500} placeholder="Contá qué pasó"
                className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
        )}

        {/* ── Pie fijo ── */}
        <div className="shrink-0 border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white sm:rounded-b-2xl space-y-2">
          {creada ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => window.open(`/imprimir/devolucion/${creada.id}`, '_blank')}
                className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Printer size={15} /> Imprimir
              </button>
              <button type="button" onClick={cerrar}
                className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold">Listo</button>
            </div>
          ) : paso === 1 ? (
            <>
              {elegidas.length > 0 && faltantes.length > 0 && <p className="text-[11px] text-red-600">{faltantes[0]}</p>}
              <button type="button" disabled={faltantes.length > 0 || !prep} onClick={() => setPaso(2)}
                className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-base font-bold disabled:opacity-50">
                Continuar{elegidas.length > 0 ? ` · ${formatCurrency(resultado.valor_total)}` : ''}
              </button>
            </>
          ) : paso === 2 ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaso(1)}
                className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 flex items-center gap-1">
                <ChevronLeft size={16} /> Atrás
              </button>
              <button type="button" onClick={() => setPaso(3)} disabled={cambioInvalido}
                className="flex-1 h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-base font-bold disabled:opacity-50">
                Continuar
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaso(2)} disabled={enviando}
                className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 flex items-center gap-1">
                <ChevronLeft size={16} /> Atrás
              </button>
              <button type="button" onClick={confirmar} disabled={enviando || motivo.trim().length < 3 || repartoInvalido}
                className="flex-1 h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-base font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {enviando && <RefreshCw size={15} className="animate-spin" />} {quiereCambio ? 'Registrar cambio' : 'Registrar devolución'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
