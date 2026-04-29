import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Receipt, Users, Calendar, CreditCard,
  Plus, Trash2, AlertTriangle, RefreshCw, Check, X, Package
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MontoInput } from '@/components/MontoInput';
import { PDFDialog } from '@/components/PDFDialog';

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
  'Entrega de mercadería',
  'Flete / Traslado',
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
  tipo: string;
  estado: string;
  precio_total: number;
  cliente: { nombre: string | null; apellido: string | null };
}

interface Remito {
  id: string;
  numero: string;
  estado: string;
}

interface ReciboItem {
  descripcion: string;
  producto_id: string;
  monto: string;
}

interface Producto {
  id: string;
  nombre: string;
  codigo: string | null;
}

// ── Constantes ────────────────────────────────────────────────
const FORMAS_PAGO = [
  { v: 'efectivo',        l: 'Efectivo' },
  { v: 'transferencia',   l: 'Transferencia' },
  { v: 'cheque',          l: 'Cheque' },
  { v: 'tarjeta_debito',  l: 'Tarjeta débito' },
  { v: 'tarjeta_credito', l: 'Tarjeta crédito' },
  { v: 'mercadopago',     l: 'MercadoPago' },
  { v: 'otro',            l: 'Otro' },
];

const ESTADOS_OP_ACTIVOS = ['consulta', 'presupuesto', 'enviado', 'aprobado', 'en_produccion', 'listo', 'instalado', 'entregado'];

function nombreCliente(c: Cliente) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

// ── Componentes auxiliares ────────────────────────────────────
function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-gray-50 border-gray-100 rounded-t-xl">
        <Icon size={13} className="text-gray-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</span>
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
  const [searchParams]   = useSearchParams();

  // Form state
  const [clienteId,       setClienteId]       = useState(searchParams.get('cliente_id') ?? '');
  const [clienteSel,      setClienteSel]       = useState<Cliente | null>(null);
  const [operacionId,     setOperacionId]      = useState(searchParams.get('operacion_id') ?? '');
  const [remitoId,        setRemitoId]         = useState('');
  const [fecha,           setFecha]            = useState(new Date().toISOString().split('T')[0]);
  const [formaPago,       setFormaPago]        = useState('efectivo');
  const [referencia,      setReferencia]       = useState('');
  const [concepto,        setConcepto]         = useState('');
  const [notas,           setNotas]            = useState('');
  const [items,           setItems]            = useState<ReciboItem[]>([{ descripcion: 'Pago', producto_id: '', monto: '' }]);
  const [montoManual,     setMontoManual]      = useState('');
  const [useManual,       setUseManual]        = useState(false);

  // Data
  const [clientes,        setClientes]         = useState<Cliente[]>([]);
  const [operaciones,     setOperaciones]      = useState<Operacion[]>([]);
  const [remitos,         setRemitos]          = useState<Remito[]>([]);
  const [productos,       setProductos]        = useState<Producto[]>([]);
  const [cobradoOp,       setCobradoOp]        = useState(0);
  const [operacionSel,    setOperacionSel]     = useState<Operacion | null>(null);

  // UI state
  const [saving,          setSaving]           = useState(false);
  const [savedId,         setSavedId]          = useState<string | null>(null);
  const [searchCliente,   setSearchCliente]    = useState('');
  const [showClientes,    setShowClientes]     = useState(false);
  const clienteRef = useRef<HTMLInputElement>(null);

  // ── Carga inicial ─────────────────────────────────────────
  useEffect(() => {
    api.get<Producto[]>('/catalogo/productos').then(setProductos).catch(() => {});

    // Pre-fill cliente desde URL param (cuando viene desde OperacionDetalle)
    const urlClienteId = searchParams.get('cliente_id');
    if (!isEdit && urlClienteId) {
      api.get<Cliente>(`/clientes/${urlClienteId}`).then(c => setClienteSel(c)).catch(() => {});
    }

    if (isEdit && id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api.get<any>(`/recibos/${id}`).then(data => {
        setClienteId(data.cliente_id);
        setClienteSel(data.cliente);
        setOperacionId(data.operacion_id ?? '');
        setRemitoId(data.remito_id ?? '');
        setFecha(data.fecha);
        setFormaPago(data.forma_pago);
        setReferencia(data.referencia_pago ?? '');
        setConcepto(data.concepto ?? '');
        setNotas(data.notas ?? '');
        if (data.items?.length) {
          setItems(data.items.map((it: { descripcion: string; producto_id: string | null; monto: number }) => ({
            descripcion: it.descripcion,
            producto_id: it.producto_id ?? '',
            monto: String(it.monto),
          })));
        } else {
          setUseManual(true);
          setMontoManual(String(data.monto_total));
        }
      });
    }
  }, [id, isEdit]);

  // ── Búsqueda de clientes ──────────────────────────────────
  useEffect(() => {
    if (!searchCliente.trim()) { setClientes([]); return; }
    const t = setTimeout(() => {
      api.get<Cliente[]>(`/clientes?search=${encodeURIComponent(searchCliente)}&limit=10`)
        .then(setClientes).catch(() => setClientes([]));
    }, 250);
    return () => clearTimeout(t);
  }, [searchCliente]);

  // ── Al cambiar cliente → cargar sus operaciones ───────────
  useEffect(() => {
    if (!clienteId) { setOperaciones([]); setOperacionId(''); setOperacionSel(null); return; }
    api.get<Operacion[]>(`/operaciones?cliente_id=${clienteId}`)
      .then(data => setOperaciones(data.filter(o => ESTADOS_OP_ACTIVOS.includes(o.estado))))
      .catch(() => setOperaciones([]));
  }, [clienteId]);

  // ── Al cambiar operación → cargar remitos + cobrado ───────
  useEffect(() => {
    if (!operacionId) {
      setRemitos([]); setRemitoId(''); setOperacionSel(null); setCobradoOp(0);
      return;
    }
    const op = operaciones.find(o => o.id === operacionId) ?? null;
    setOperacionSel(op);

    // Remitos de esta operación
    api.get<Remito[]>(`/remitos?operacion_id=${operacionId}`)
      .then(data => setRemitos(data.filter(r => r.estado !== 'cancelado')))
      .catch(() => setRemitos([]));

    // Total ya cobrado para esta operación
    api.get<{ monto_total: number; estado: string }[]>(`/recibos?operacion_id=${operacionId}`)
      .then(data => {
        const total = data
          .filter(r => r.estado === 'emitido' && (!isEdit || true))
          .reduce((s, r) => s + Number(r.monto_total), 0);
        setCobradoOp(isEdit ? total : total); // se ajusta si es edición
      })
      .catch(() => setCobradoOp(0));
  }, [operacionId, operaciones, isEdit]);

  // ── Sugerir monto cuando se selecciona operación ─────────
  useEffect(() => {
    if (operacionSel && !isEdit && !useManual) {
      const saldo = Number(operacionSel.precio_total) - cobradoOp;
      if (saldo > 0 && items.length === 1 && !items[0].monto) {
        setItems([{ descripcion: `Pago - ${operacionSel.numero}`, producto_id: '', monto: String(Math.max(0, saldo)) }]);
      }
    }
  }, [operacionSel, cobradoOp]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cálculo del total ─────────────────────────────────────
  const totalItems = items.reduce((s, it) => s + (parseFloat(it.monto) || 0), 0);
  const montoFinal = useManual ? (parseFloat(montoManual) || 0) : totalItems;
  const saldoOp    = operacionSel ? Number(operacionSel.precio_total) - cobradoOp : null;

  // ── Item helpers ──────────────────────────────────────────
  function addItem() {
    setItems(prev => [...prev, { descripcion: '', producto_id: '', monto: '' }]);
  }
  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }
  function updateItem(i: number, field: keyof ReciboItem, value: string) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  }

  // ── Guardar ───────────────────────────────────────────────
  async function handleSave() {
    if (!clienteId)        { toast.error('Seleccioná un cliente'); return; }
    if (!formaPago)        { toast.error('Seleccioná forma de pago'); return; }
    if (montoFinal <= 0)   { toast.error('El monto debe ser mayor a 0'); return; }

    const payload = {
      cliente_id:     clienteId,
      operacion_id:   operacionId  || null,
      remito_id:      remitoId     || null,
      fecha,
      forma_pago:     formaPago,
      referencia_pago: referencia  || null,
      concepto:       concepto     || null,
      notas:          notas        || null,
      monto_total:    montoFinal,
      items: useManual ? [] : items.filter(it => it.descripcion && parseFloat(it.monto) > 0).map(it => ({
        descripcion: it.descripcion,
        producto_id: it.producto_id || null,
        monto:       parseFloat(it.monto),
      })),
    };

    setSaving(true);
    try {
      if (isEdit && id) {
        await api.put(`/recibos/${id}`, payload);
        toast.success('Recibo actualizado');
      } else {
        const rec = await api.post<{ id: string }>('/recibos', payload);
        toast.success('Recibo creado');
        setSavedId(rec.id);
        return;
      }
      navigate('/recibos');
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // ── Estilos comunes ───────────────────────────────────────
  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white';
  const labelCls = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5';

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">

      {/* Header */}
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

      {/* Cliente */}
      <SectionCard title="Cliente *" icon={Users}>
        {clienteSel ? (
          <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <div>
              <p className="text-sm font-semibold text-emerald-800">{nombreCliente(clienteSel)}</p>
              {clienteSel.telefono && <p className="text-xs text-emerald-600">{clienteSel.telefono}</p>}
            </div>
            {!isEdit && (
              <button onClick={() => { setClienteSel(null); setClienteId(''); setSearchCliente(''); setOperaciones([]); setOperacionId(''); setOperacionSel(null); }}
                className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600">
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <input ref={clienteRef} value={searchCliente}
              onChange={e => setSearchCliente(e.target.value)}
              onFocus={() => setShowClientes(true)}
              onBlur={() => setTimeout(() => setShowClientes(false), 150)}
              placeholder="Buscar cliente por nombre o apellido..."
              className={inputCls} />
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

      {/* Fecha y pago */}
      <SectionCard title="Fecha y forma de pago" icon={Calendar}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Fecha *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Forma de pago *</label>
            <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className={inputCls}>
              {FORMAS_PAGO.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
            </select>
          </div>
        </div>
        {(formaPago === 'transferencia' || formaPago === 'cheque' || formaPago === 'mercadopago') && (
          <div className="mt-3">
            <label className={labelCls}>
              {formaPago === 'transferencia' ? 'N° de transferencia / CBU' :
               formaPago === 'cheque'        ? 'N° de cheque' : 'N° de operación'}
            </label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)}
              placeholder="Referencia del pago" className={inputCls} />
          </div>
        )}
      </SectionCard>

      {/* Operación vinculada */}
      {clienteId && (
        <SectionCard title="Operación vinculada" icon={Receipt}>
          {operaciones.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No hay operaciones activas para este cliente</p>
          ) : (
            <>
              <select value={operacionId} onChange={e => setOperacionId(e.target.value)} className={inputCls}>
                <option value="">— Sin vincular —</option>
                {operaciones.map(op => (
                  <option key={op.id} value={op.id}>
                    {op.numero} — {formatCurrency(op.precio_total)} ({op.estado})
                  </option>
                ))}
              </select>

              {operacionSel && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Total operación</p>
                    <p className="text-sm font-bold text-gray-800">{formatCurrency(Number(operacionSel.precio_total))}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Ya cobrado</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(cobradoOp)}</p>
                  </div>
                  <div className={cn('rounded-xl p-3 text-center', (saldoOp ?? 0) <= 0 ? 'bg-gray-100' : 'bg-amber-50')}>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Saldo pendiente</p>
                    <p className={cn('text-sm font-bold', (saldoOp ?? 0) <= 0 ? 'text-gray-400' : 'text-amber-700')}>
                      {formatCurrency(Math.max(0, saldoOp ?? 0))}
                    </p>
                  </div>
                </div>
              )}

              {/* Remito de esa operación */}
              {operacionId && remitos.length > 0 && (
                <div className="mt-3">
                  <label className={labelCls}>Remito vinculado (opcional)</label>
                  <select value={remitoId} onChange={e => setRemitoId(e.target.value)} className={inputCls}>
                    <option value="">— Sin vincular —</option>
                    {remitos.map(rm => (
                      <option key={rm.id} value={rm.id}>{rm.numero} ({rm.estado})</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}

      {/* Detalle del cobro — items */}
      <SectionCard title="Detalle del cobro" icon={CreditCard}>
        <div className="space-y-3">

          {/* Toggle: desglose por ítems vs monto total directo */}
          <div className="flex items-center gap-2">
            <button onClick={() => setUseManual(false)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                !useManual ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300')}>
              Desglose por ítems
            </button>
            <button onClick={() => setUseManual(true)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                useManual ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300')}>
              Monto directo
            </button>
          </div>

          {useManual ? (
            <div>
              <label className={labelCls}>Monto total *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">$</span>
                <MontoInput
                  value={montoManual}
                  onChange={setMontoManual}
                  placeholder="0,00"
                  className={cn(inputCls, 'pl-7 font-mono text-base font-semibold')}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Lista de ítems */}
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="grid gap-2" style={{ gridTemplateColumns: '1fr auto auto auto' }}>
                    <input value={it.descripcion}
                      onChange={e => updateItem(i, 'descripcion', e.target.value)}
                      placeholder="Descripción (ej: Seña 50%, Pago final, Instalación...)"
                      className={inputCls} />
                    <select value={it.producto_id} onChange={e => updateItem(i, 'producto_id', e.target.value)}
                      className={cn(inputCls, 'w-44 shrink-0')}
                      title="Producto relacionado (opcional)">
                      <option value="">— Producto —</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ''}</option>)}
                    </select>
                    <div className="relative w-40 shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">$</span>
                      <MontoInput
                        value={it.monto}
                        onChange={v => updateItem(i, 'monto', v)}
                        placeholder="0,00"
                        className={cn(inputCls, 'pl-7 font-mono font-semibold')}
                      />
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)}
                        className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={addItem}
                className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-1">
                <Plus size={13} /> Agregar ítem
              </button>

              {/* Total de ítems */}
              {totalItems > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Total desglose</span>
                  <span className="font-bold text-gray-900 font-mono">
                    $ {totalItems.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Alerta si supera el saldo */}
          {operacionSel && montoFinal > 0 && saldoOp !== null && montoFinal > saldoOp + 0.01 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              Este recibo ({formatCurrency(montoFinal)}) supera el saldo pendiente ({formatCurrency(Math.max(0, saldoOp))}).
              Verificá si es un pago en exceso o seña anticipada.
            </div>
          )}

          {/* Confirmación si cubre el total */}
          {operacionSel && montoFinal > 0 && saldoOp !== null && montoFinal >= saldoOp - 0.01 && montoFinal <= saldoOp + 0.01 && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
              <Check size={13} />
              Este recibo cancela el saldo pendiente de la operación.
            </div>
          )}
        </div>
      </SectionCard>

      {/* Concepto y notas */}
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

      {/* Resumen final + botón guardar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total del recibo</p>
            <p className={cn('text-3xl font-bold mt-0.5', montoFinal > 0 ? 'text-gray-900' : 'text-gray-300')}>
              {montoFinal > 0
                ? `$ ${montoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                : '$  0,00'
              }
            </p>
            {operacionSel && montoFinal > 0 && saldoOp !== null && (
              <p className="text-xs text-gray-400 mt-1">
                Saldo tras este recibo: <span className={cn('font-semibold', saldoOp - montoFinal <= 0 ? 'text-emerald-600' : 'text-amber-600')}>
                  {formatCurrency(Math.max(0, saldoOp - montoFinal))}
                </span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
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
