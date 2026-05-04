import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Receipt, Users, Calendar, CreditCard,
  RefreshCw, Check, X, Package, Gift,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MontoInput } from '@/components/MontoInput';
import { PDFDialog } from '@/components/PDFDialog';

// ── Formas de pago (igual que en presupuesto) ─────────────────
const FORMAS_PAGO = [
  'Contado',
  'Tarjeta de débito/crédito en 1 pago',
  'Transferencia',
  'Tarjeta de crédito 3 cuotas sin interés',
];

// ── Conceptos predefinidos ────────────────────────────────────
const CONCEPTOS_PREDEFINIDOS = [
  'Seña / Anticipo',
  'Pago parcial',
  'Cancelación de saldo',
  'Pago a cuenta',
  'Pago de instalación',
  'Pago de materiales',
  'Mano de obra',
  'Medición y presupuesto',
  'Garantía / Servicio técnico',
];

// ── Tipos ─────────────────────────────────────────────────────
interface Cliente {
  id: string;
  tipo_persona: 'fisica' | 'juridica';
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  telefono: string | null;
}

interface Operacion {
  id: string;
  numero: string;
  estado: string;
  precio_total: number;
  forma_pago: string | null;
  cliente: { nombre: string | null; apellido: string | null };
}

interface PresupuestoDetalle {
  id: string;
  numero: string;
  forma_pago: string | null;
  forma_envio: string | null;
  costo_envio: number;
  precio_total: number;
  items: Array<{
    precio_unitario: number;
    precio_instalacion: number;
    incluye_instalacion: boolean;
    cantidad: number;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────
function nombreCliente(c: Cliente) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function SectionCard({
  title, icon: Icon, children, accent,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b rounded-t-xl',
        accent ?? 'bg-gray-50 border-gray-100',
      )}>
        <Icon size={13} className={accent ? 'opacity-70' : 'text-gray-400'} />
        <span className={cn(
          'text-[11px] font-semibold uppercase tracking-wider',
          accent ? '' : 'text-gray-500',
        )}>{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────
export function NuevoRecibo() {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();
  const isEdit   = Boolean(id);
  const [searchParams] = useSearchParams();

  // ── Form state ────────────────────────────────────────────
  const [clienteId,   setClienteId]   = useState(searchParams.get('cliente_id') ?? '');
  const [clienteSel,  setClienteSel]  = useState<Cliente | null>(null);
  const [operacionId, setOperacionId] = useState(searchParams.get('operacion_id') ?? '');
  const [fecha,       setFecha]       = useState(new Date().toISOString().split('T')[0]);
  const [formaPago,   setFormaPago]   = useState('Contado');
  const [referencia,  setReferencia]  = useState('');
  const [concepto,    setConcepto]    = useState('');
  const [notas,       setNotas]       = useState('');

  // "Pago total" toma saldo automático; "parcial" pide monto manual
  const [tipoPago,     setTipoPago]     = useState<'total' | 'parcial'>('total');
  const [montoParcial, setMontoParcial] = useState('');

  // ── Bonificación ──────────────────────────────────────────
  const [bonPct,    setBonPct]    = useState(0);      // preset: 0.05, 0.10…
  const [bonCustom, setBonCustom] = useState('');     // texto "%"

  // ── Compromiso de saldo ───────────────────────────────────
  const [crearCompromiso, setCrearCompromiso] = useState(true);
  const [compromisoFecha, setCompromisoFecha] = useState('');
  const [compromisoTipo,  setCompromisoTipo]  = useState('cuota');

  // ── Data ──────────────────────────────────────────────────
  const [clientes,           setClientes]           = useState<Cliente[]>([]);
  const [operaciones,        setOperaciones]        = useState<Operacion[]>([]);
  const [cobradoOp,          setCobradoOp]          = useState(0);
  const [operacionSel,       setOperacionSel]       = useState<Operacion | null>(null);
  const [presupuestoDetalle, setPresupuestoDetalle] = useState<PresupuestoDetalle | null>(null);

  // ── UI ────────────────────────────────────────────────────
  const [saving,        setSaving]        = useState(false);
  const [savedId,       setSavedId]       = useState<string | null>(null);
  const [searchCliente, setSearchCliente] = useState('');
  const [showClientes,  setShowClientes]  = useState(false);
  const clienteRef = useRef<HTMLInputElement>(null);

  // ── Carga inicial / edit ──────────────────────────────────
  useEffect(() => {
    const urlClienteId = searchParams.get('cliente_id');
    if (!isEdit && urlClienteId) {
      api.get<Cliente>(`/clientes/${urlClienteId}`).then(setClienteSel).catch(() => {});
    }
    if (isEdit && id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api.get<any>(`/recibos/${id}`).then(data => {
        setClienteId(data.cliente_id);
        setClienteSel(data.cliente);
        setOperacionId(data.operacion_id ?? '');
        setFecha(data.fecha);
        setFormaPago(data.forma_pago);
        setReferencia(data.referencia_pago ?? '');
        setConcepto(data.concepto ?? '');
        setNotas(data.notas ?? '');
        setTipoPago('parcial');
        setMontoParcial(String(data.monto_total));
      });
    }
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Búsqueda de clientes ──────────────────────────────────
  useEffect(() => {
    if (!searchCliente.trim()) { setClientes([]); return; }
    const t = setTimeout(() => {
      api.get<Cliente[]>(`/clientes?search=${encodeURIComponent(searchCliente)}&limit=10`)
        .then(setClientes).catch(() => setClientes([]));
    }, 250);
    return () => clearTimeout(t);
  }, [searchCliente]);

  // ── Al cambiar cliente → presupuestos aprobados ───────────
  useEffect(() => {
    if (!clienteId) {
      setOperaciones([]); setOperacionId(''); setOperacionSel(null);
      setPresupuestoDetalle(null);
      return;
    }
    api.get<Operacion[]>(`/operaciones?cliente_id=${clienteId}&estado=aprobado`)
      .then(setOperaciones)
      .catch(() => setOperaciones([]));
  }, [clienteId]);

  // ── Al cambiar operación → detalle + cobrado ──────────────
  useEffect(() => {
    if (!operacionId) {
      setOperacionSel(null); setCobradoOp(0); setPresupuestoDetalle(null);
      resetBonificacion();
      return;
    }
    const op = operaciones.find(o => o.id === operacionId) ?? null;
    setOperacionSel(op);
    resetBonificacion();

    api.get<PresupuestoDetalle>(`/operaciones/${operacionId}`)
      .then(setPresupuestoDetalle)
      .catch(() => setPresupuestoDetalle(null));

    api.get<{ monto_total: number; estado: string }[]>(`/recibos?operacion_id=${operacionId}`)
      .then(data => {
        const total = data.filter(r => r.estado === 'emitido')
          .reduce((s, r) => s + Number(r.monto_total), 0);
        setCobradoOp(total);
      })
      .catch(() => setCobradoOp(0));
  }, [operacionId, operaciones]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Al cambiar formaPago → limpiar bonificación si no es Contado ──
  useEffect(() => {
    if (formaPago !== 'Contado') resetBonificacion();
  }, [formaPago]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset parcial cuando cambia a pago total ──────────────
  useEffect(() => {
    if (tipoPago === 'total') setMontoParcial('');
  }, [tipoPago]);

  // ── Cálculo del total de presupuesto ──────────────────────
  const totalPresupuesto = Number(operacionSel?.precio_total ?? 0);
  const saldoOp = Math.max(0, totalPresupuesto - cobradoOp);

  // ── Breakdown bonificación ────────────────────────────────
  const aplicaBonificacion = !isEdit && formaPago === 'Contado' && !!presupuestoDetalle;

  const montoProductos = presupuestoDetalle
    ? presupuestoDetalle.items.reduce(
        (s, it) => s + Number(it.precio_unitario) * Number(it.cantidad), 0)
    : 0;
  const montoInstalacion = presupuestoDetalle
    ? presupuestoDetalle.items.reduce(
        (s, it) => s + (it.incluye_instalacion ? Number(it.precio_instalacion) * Number(it.cantidad) : 0), 0)
    : 0;
  const envioExtra = presupuestoDetalle?.forma_envio === 'envio_empresa'
    ? Number(presupuestoDetalle.costo_envio ?? 0)
    : 0;

  const pctActual = bonPct > 0 ? bonPct
    : bonCustom ? parseFloat(bonCustom) / 100 : 0;
  const descuentoMonto = Math.round(montoProductos * pctActual * 100) / 100;
  const totalConBonif  = montoProductos - descuentoMonto + montoInstalacion + envioExtra;

  // ── Saldo efectivo (aplica descuento si corresponde) ──────
  const saldoEfectivo = (aplicaBonificacion && pctActual > 0)
    ? Math.max(0, totalConBonif - cobradoOp)
    : saldoOp;

  // ── Monto final del recibo ────────────────────────────────
  const montoFinal = tipoPago === 'total'
    ? saldoEfectivo
    : (parseFloat(montoParcial) || 0);

  const esParcial = tipoPago === 'parcial';
  const saldoTrasRecibo = Math.max(0, saldoEfectivo - montoFinal);
  const esCuotas = formaPago === 'Tarjeta de crédito 3 cuotas sin interés';

  // ── Helpers bonificación ──────────────────────────────────
  function resetBonificacion() {
    setBonPct(0);
    setBonCustom('');
  }

  function calcTotalConDesc(pct: number): number {
    if (!presupuestoDetalle) return saldoOp;
    const prod  = presupuestoDetalle.items.reduce(
      (s, it) => s + Number(it.precio_unitario) * Number(it.cantidad), 0);
    const inst  = presupuestoDetalle.items.reduce(
      (s, it) => s + (it.incluye_instalacion ? Number(it.precio_instalacion) * Number(it.cantidad) : 0), 0);
    const envio = presupuestoDetalle.forma_envio === 'envio_empresa'
      ? Number(presupuestoDetalle.costo_envio ?? 0) : 0;
    const desc  = Math.round(prod * pct * 100) / 100;
    return Math.max(0, (prod - desc + inst + envio) - cobradoOp);
  }

  function aplicarPreset(pct: number) {
    setBonPct(pct);
    setBonCustom('');
    // Si está en parcial, actualizar sugerido
    if (tipoPago === 'parcial') {
      setMontoParcial(String(Math.round(calcTotalConDesc(pct) * 100) / 100));
    }
  }

  function aplicarCustom(val: string) {
    setBonCustom(val);
    setBonPct(0);
    const pct = parseFloat(val) / 100;
    if (!isNaN(pct) && pct > 0 && pct <= 0.5 && tipoPago === 'parcial') {
      setMontoParcial(String(Math.round(calcTotalConDesc(pct) * 100) / 100));
    }
  }

  // ── Guardar ───────────────────────────────────────────────
  async function handleSave() {
    if (!clienteId)                { toast.error('Seleccioná un cliente'); return; }
    if (!operacionId)              { toast.error('Seleccioná el presupuesto'); return; }
    if (!formaPago)                { toast.error('Seleccioná forma de pago'); return; }
    if (montoFinal <= 0)           { toast.error('El monto debe ser mayor a 0'); return; }
    if (esParcial && crearCompromiso && !compromisoFecha) {
      toast.error('Ingresá la fecha estimada de cancelación del saldo');
      return;
    }

    const payload: Record<string, unknown> = {
      cliente_id:      clienteId,
      operacion_id:    operacionId || null,
      remito_id:       null,
      fecha,
      forma_pago:      formaPago,
      referencia_pago: referencia || null,
      concepto:        concepto   || null,
      notas:           notas      || null,
      monto_total:     montoFinal,
      items:           [],
    };

    if (!isEdit && esParcial && crearCompromiso && compromisoFecha) {
      payload.compromiso = {
        monto:             Math.round(saldoTrasRecibo * 100) / 100,
        fecha_vencimiento: compromisoFecha,
        tipo:              compromisoTipo,
        descripcion:       `Saldo pendiente — ${operacionSel?.numero ?? ''}${pctActual > 0 ? ` (bonif. ${(pctActual * 100).toFixed(0)}%)` : ''}`,
      };
    }

    setSaving(true);
    try {
      if (isEdit && id) {
        await api.put(`/recibos/${id}`, payload);
        toast.success('Recibo actualizado');
        navigate('/recibos');
      } else {
        const rec = await api.post<{ id: string }>('/recibos', payload);
        toast.success(
          payload.compromiso
            ? 'Recibo creado y compromiso registrado'
            : 'Recibo creado',
        );
        setSavedId(rec.id);
      }
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white';
  const labelCls = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5';

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/recibos')} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
          <ArrowLeft size={17} className="text-gray-500" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
          <Receipt size={16} className="text-emerald-600" />
        </div>
        <h1 className="text-base font-bold text-gray-900 flex-1">
          {isEdit ? 'Editar recibo' : 'Nuevo recibo'}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/recibos')}
            className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium shadow-sm">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear recibo'}
          </button>
        </div>
      </div>

      {/* ── 1. Cliente ───────────────────────────────────── */}
      <SectionCard title="Cliente *" icon={Users}>
        {clienteSel ? (
          <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <div>
              <p className="text-sm font-semibold text-emerald-800">{nombreCliente(clienteSel)}</p>
              {clienteSel.telefono && <p className="text-xs text-emerald-600">{clienteSel.telefono}</p>}
            </div>
            {!isEdit && (
              <button
                onClick={() => {
                  setClienteSel(null); setClienteId(''); setSearchCliente('');
                  setOperaciones([]); setOperacionId(''); setOperacionSel(null);
                  setPresupuestoDetalle(null);
                }}
                className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600">
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <input
              ref={clienteRef}
              value={searchCliente}
              onChange={e => setSearchCliente(e.target.value)}
              onFocus={() => setShowClientes(true)}
              onBlur={() => setTimeout(() => setShowClientes(false), 150)}
              placeholder="Buscar cliente por nombre o apellido..."
              className={inputCls}
            />
            {showClientes && clientes.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {clientes.map(c => (
                  <button key={c.id} type="button"
                    onMouseDown={() => { setClienteId(c.id); setClienteSel(c); setSearchCliente(''); setShowClientes(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-800">{nombreCliente(c)}</p>
                    {c.telefono && <p className="text-xs text-gray-400">{c.telefono}</p>}
                  </button>
                ))}
              </div>
            )}
            {showClientes && searchCliente.length > 1 && clientes.length === 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-center text-xs text-gray-400">
                Sin resultados
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── 2. Presupuesto aprobado ──────────────────────── */}
      {clienteId && (
        <SectionCard title="Presupuesto aprobado *" icon={Receipt}>
          {operaciones.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              Este cliente no tiene presupuestos aprobados.
            </p>
          ) : (
            <>
              <select
                value={operacionId}
                onChange={e => setOperacionId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Seleccioná el presupuesto —</option>
                {operaciones.map(op => (
                  <option key={op.id} value={op.id}>
                    {op.numero} — {formatCurrency(Number(op.precio_total))}
                    {op.forma_pago ? ` · ${op.forma_pago}` : ''}
                  </option>
                ))}
              </select>

              {operacionSel && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Total presupuesto</p>
                    <p className="text-sm font-bold text-gray-800">{formatCurrency(totalPresupuesto)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Ya cobrado</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(cobradoOp)}</p>
                  </div>
                  <div className={cn('rounded-xl p-3 text-center', saldoOp <= 0 ? 'bg-gray-100' : 'bg-amber-50')}>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Saldo pendiente</p>
                    <p className={cn('text-sm font-bold', saldoOp <= 0 ? 'text-gray-400' : 'text-amber-700')}>
                      {formatCurrency(saldoOp)}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}

      {/* ── 3. Fecha y forma de pago ─────────────────────── */}
      {operacionId && (
        <SectionCard title="Fecha y forma de pago" icon={Calendar}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Forma de pago *</label>
              <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className={inputCls}>
                {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          {formaPago === 'Transferencia' && (
            <div className="mt-3">
              <label className={labelCls}>N° de transferencia / CBU</label>
              <input value={referencia} onChange={e => setReferencia(e.target.value)}
                placeholder="Referencia del pago" className={inputCls} />
            </div>
          )}
        </SectionCard>
      )}

      {/* ── 4. Bonificación (solo Contado) ───────────────── */}
      {aplicaBonificacion && (
        <SectionCard
          title="Bonificación por pago al contado"
          icon={Gift}
          accent="bg-violet-50 border-violet-100 text-violet-700"
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Bonificación sobre precio de productos.
              No aplica sobre instalación ni envío.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-semibold">Descuento:</span>
              {[5, 10, 15, 20].map(pct => (
                <button key={pct}
                  onClick={() => aplicarPreset(pct / 100)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    bonPct === pct / 100
                      ? 'border-violet-500 bg-violet-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-violet-400 hover:text-violet-700',
                  )}>
                  {pct}%
                </button>
              ))}
              <div className="relative">
                <input
                  type="number" min="1" max="50" step="0.5"
                  value={bonCustom}
                  onChange={e => aplicarCustom(e.target.value)}
                  placeholder="Otro %"
                  className={cn(
                    'w-24 pl-3 pr-7 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none',
                    bonCustom ? 'border-violet-400 bg-violet-50' : 'border-gray-200',
                  )}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
              </div>
              {(bonPct > 0 || bonCustom) && (
                <button onClick={resetBonificacion}
                  className="text-xs text-red-400 hover:text-red-600 font-medium">
                  × Quitar
                </button>
              )}
            </div>

            {pctActual > 0 && (
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Productos</span>
                  <span className="font-medium">{formatCurrency(montoProductos)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                  <span>Descuento {(pctActual * 100 % 1 === 0 ? (pctActual * 100).toFixed(0) : (pctActual * 100).toFixed(1))}%</span>
                  <span>− {formatCurrency(descuentoMonto)}</span>
                </div>
                {montoInstalacion > 0 && (
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Instalación (sin descuento)</span>
                    <span className="font-medium">{formatCurrency(montoInstalacion)}</span>
                  </div>
                )}
                {envioExtra > 0 && (
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Envío (sin descuento)</span>
                    <span className="font-medium">{formatCurrency(envioExtra)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-violet-700 pt-1.5 border-t border-violet-200">
                  <span>Total con bonificación</span>
                  <span>{formatCurrency(totalConBonif)}</span>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── 5. Monto a cobrar ────────────────────────────── */}
      {operacionId && (
        <SectionCard title="Monto a cobrar" icon={CreditCard}>
          <div className="space-y-4">

            {/* Radio: Pago total / Pago parcial */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTipoPago('total')}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center',
                  tipoPago === 'total'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-300',
                )}
              >
                {tipoPago === 'total' && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </span>
                )}
                <span className={cn('text-sm font-bold', tipoPago === 'total' ? 'text-emerald-700' : 'text-gray-600')}>
                  Pago total
                </span>
                <span className={cn('text-lg font-bold', tipoPago === 'total' ? 'text-emerald-800' : 'text-gray-700')}>
                  {formatCurrency(saldoEfectivo)}
                </span>
                {pctActual > 0 && aplicaBonificacion && (
                  <span className="text-[10px] text-violet-600 font-medium">
                    incl. {(pctActual * 100).toFixed(0)}% bonif.
                  </span>
                )}
              </button>

              <button
                onClick={() => setTipoPago('parcial')}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center',
                  tipoPago === 'parcial'
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-gray-200 hover:border-amber-300',
                )}
              >
                {tipoPago === 'parcial' && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </span>
                )}
                <span className={cn('text-sm font-bold', tipoPago === 'parcial' ? 'text-amber-700' : 'text-gray-600')}>
                  Pago parcial
                </span>
                <span className="text-xs text-gray-400">Indicar monto</span>
              </button>
            </div>

            {/* Input monto parcial */}
            {tipoPago === 'parcial' && (
              <div>
                <label className={labelCls}>Monto a cobrar *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">$</span>
                  <MontoInput
                    value={montoParcial}
                    onChange={setMontoParcial}
                    placeholder="0,00"
                    className={cn(inputCls, 'pl-7 font-mono text-base font-semibold')}
                  />
                </div>
                {montoFinal > saldoEfectivo + 0.01 && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    El monto supera el saldo ({formatCurrency(saldoEfectivo)}). Verificá si es seña anticipada.
                  </p>
                )}
                {montoFinal > 0 && saldoTrasRecibo > 0 && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Saldo pendiente tras este pago:{' '}
                    <span className="font-semibold text-amber-600">{formatCurrency(saldoTrasRecibo)}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── 6. Compromiso de saldo (solo pago parcial) ───── */}
      {!isEdit && esParcial && operacionSel && montoFinal > 0 && (
        <SectionCard title="Compromiso de pago del saldo" icon={Calendar}>
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800">
              <p className="font-semibold mb-0.5">Pago parcial</p>
              <p>
                Saldo a comprometer:{' '}
                <strong className="text-amber-700">{formatCurrency(saldoTrasRecibo)}</strong>
              </p>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox"
                checked={crearCompromiso}
                onChange={e => setCrearCompromiso(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">Registrar compromiso de cancelación del saldo</span>
            </label>

            {crearCompromiso && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha estimada *</label>
                  <input type="date"
                    value={compromisoFecha}
                    onChange={e => setCompromisoFecha(e.target.value)}
                    min={fecha}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tipo</label>
                  <select value={compromisoTipo} onChange={e => setCompromisoTipo(e.target.value)} className={inputCls}>
                    <option value="cuota">Cuota / Saldo</option>
                    <option value="cheque">Cheque diferido</option>
                    <option value="efectivo_futuro">Efectivo diferido</option>
                    <option value="transferencia">Transferencia diferida</option>
                  </select>
                </div>
                {compromisoFecha && (
                  <div className="col-span-2 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
                    Compromiso de{' '}
                    <strong className="text-gray-700">{formatCurrency(saldoTrasRecibo)}</strong>
                    {' '}con vencimiento el{' '}
                    <strong className="text-gray-700">
                      {new Date(compromisoFecha + 'T12:00:00').toLocaleDateString('es-AR', {
                        day: '2-digit', month: 'long', year: 'numeric',
                      })}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── 7. Concepto y observaciones ──────────────────── */}
      {operacionId && (
        <SectionCard title="Concepto y observaciones" icon={Package}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Concepto</label>
              <input
                list="conceptos-list"
                value={concepto}
                onChange={e => setConcepto(e.target.value)}
                placeholder="Seleccioná o escribí el concepto..."
                className={inputCls}
              />
              <datalist id="conceptos-list">
                {CONCEPTOS_PREDEFINIDOS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Notas internas</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)}
                rows={2} placeholder="Observaciones privadas..."
                className={cn(inputCls, 'resize-none')} />
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── 8. Resumen final ──────────────────────────────── */}
      {operacionId && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Total del recibo</p>
              <p className={cn('text-3xl font-bold', montoFinal > 0 ? 'text-gray-900' : 'text-gray-300')}>
                {montoFinal > 0
                  ? `$ ${montoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                  : '$ —'
                }
              </p>

              {/* Cuotas info */}
              {esCuotas && montoFinal > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-violet-700 font-semibold">
                    3 cuotas sin interés de {formatCurrency(montoFinal / 3)}
                  </span>
                </div>
              )}

              {/* Bonificación info */}
              {pctActual > 0 && aplicaBonificacion && montoFinal > 0 && (
                <p className="text-xs text-violet-600 mt-1.5 font-medium">
                  Bonificación {(pctActual * 100).toFixed(0)}% aplicada
                  {descuentoMonto > 0 ? ` · ahorro ${formatCurrency(descuentoMonto)}` : ''}
                </p>
              )}

              {/* Saldo tras recibo */}
              {tipoPago === 'parcial' && montoFinal > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Saldo pendiente:{' '}
                  <span className={cn('font-semibold', saldoTrasRecibo <= 0 ? 'text-emerald-600' : 'text-amber-600')}>
                    {formatCurrency(saldoTrasRecibo)}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={() => navigate('/recibos')}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold shadow-sm">
                {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear recibo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {savedId && (
        <PDFDialog
          title="Recibo creado"
          subtitle="¿Querés generar el PDF ahora?"
          pdfUrl={`/imprimir/recibo/${savedId}`}
          onClose={() => { setSavedId(null); navigate('/recibos'); }}
          onNavigate={() => navigate('/recibos')}
          navigateLabel="Ir a recibos"
        />
      )}
    </div>
  );
}
