import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { HelpButton } from '@/components/HelpButton';
import {
  ArrowLeft, Save, Receipt, Users, Calendar, CreditCard,
  RefreshCw, Check, X, Package, Gift, ImagePlus, Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastApiError, CAMPO_LABELS } from '@/lib/apiError';
import { MontoInput } from '@/components/MontoInput';
import { PDFDialog } from '@/components/PDFDialog';
import { SectionCard } from '@/components/SectionCard';
import { FORMAS_PAGO } from '@/lib/formasPago';

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
  cobrado_total: number;
  forma_pago: string | null;
  cliente: { nombre: string | null; apellido: string | null };
}

interface PresupuestoDetalle {
  id: string;
  numero: string;
  cliente_id: string;
  proveedor_id: string | null;
  cliente: {
    id: string;
    nombre: string | null;
    apellido: string | null;
    razon_social: string | null;
    tipo_persona: 'fisica' | 'juridica';
    telefono: string | null;
  };
  forma_pago: string | null;
  forma_envio: string | null;
  costo_envio: number;
  precio_total: number;
  items: Array<{
    descripcion: string;
    producto_id: string | null;
    precio_unitario: number;
    precio_instalacion: number;
    incluye_instalacion: boolean;
    cantidad: number;
    /** unitario + instalación, × cantidad — lo calcula GET /operaciones/:id */
    precio_total: number;
  }>;
  formas_pago_alternativas?: Array<{ id: string; nombre: string; descuento_pct: number }>;
}

interface ReciboItemPayload {
  descripcion: string;
  producto_id: string | null;
  cantidad?: number;
  monto: number;
}

// ── Helpers ───────────────────────────────────────────────────
function nombreCliente(c: Cliente) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

// ── Página ────────────────────────────────────────────────────
export function NuevoRecibo() {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();
  const isEdit   = Boolean(id);
  const [searchParams] = useSearchParams();

  // ── Form state ────────────────────────────────────────────
  const urlMonto   = searchParams.get('monto');
  const urlConcepto = searchParams.get('concepto');

  const [clienteId,   setClienteId]   = useState(searchParams.get('cliente_id') ?? '');
  const [clienteSel,  setClienteSel]  = useState<Cliente | null>(null);
  const [operacionId, setOperacionId] = useState(searchParams.get('operacion_id') ?? '');
  const [fecha,       setFecha]       = useState(new Date().toISOString().split('T')[0]);
  const [formaPago,   setFormaPago]   = useState('Contado');
  const [formaPagoAlternativaId, setFormaPagoAlternativaId] = useState('');
  const [referencia,  setReferencia]  = useState('');
  const [concepto,    setConcepto]    = useState(urlConcepto ?? (urlMonto ? 'Pago parcial' : ''));
  // El concepto se arma solo con el número del presupuesto (igual que la venta rápida
  // de mostrador), pero deja de tocarse apenas el usuario escribe el suyo o viene uno
  // por URL (ej. "Cancelación de saldo" desde el botón "Cobrar saldo" de Recibos).
  const [conceptoManual, setConceptoManual] = useState(Boolean(urlConcepto));
  const [notas,       setNotas]       = useState('');
  const [comprobanteUrl,     setComprobanteUrl]     = useState('');
  const [uploadingComprobante, setUploadingComprobante] = useState(false);

  // "Pago total" toma saldo automático; "parcial" pide monto manual
  const [tipoPago,     setTipoPago]     = useState<'total' | 'parcial'>(urlMonto ? 'parcial' : 'total');
  const [montoParcial, setMontoParcial] = useState(urlMonto ?? '');

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
  const [descuentosOp,       setDescuentosOp]       = useState(0);
  const [operacionSel,       setOperacionSel]       = useState<Operacion | null>(null);
  const [presupuestoDetalle, setPresupuestoDetalle] = useState<PresupuestoDetalle | null>(null);
  const [tienePedido,        setTienePedido]        = useState(false);
  // Ítems ya guardados (modo edición). Sin esto, guardar una edición los borraba:
  // PUT /recibos/:id hace DELETE + re-INSERT de recibo_items con lo que llega.
  const [itemsExistentes, setItemsExistentes] = useState<ReciboItemPayload[]>([]);

  // ── UI ────────────────────────────────────────────────────
  const [saving,        setSaving]        = useState(false);
  const [savedId,       setSavedId]       = useState<string | null>(null);
  const [searchCliente, setSearchCliente] = useState('');
  const [showClientes,  setShowClientes]  = useState(false);
  const clienteRef = useRef<HTMLInputElement>(null);
  const comprobanteInputRef = useRef<HTMLInputElement>(null);

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
        setComprobanteUrl(data.comprobante_url ?? '');
        setTipoPago('parcial');
        setMontoParcial(String(data.monto_total));
        setConceptoManual(true);
        setItemsExistentes((data.items ?? []).map((it: {
          descripcion: string; producto_id: string | null; cantidad: number | null; monto: number;
        }) => ({
          descripcion: it.descripcion,
          producto_id: it.producto_id ?? null,
          cantidad:    it.cantidad && it.cantidad > 0 ? it.cantidad : undefined,
          monto:       Number(it.monto),
        })));
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
      .then(ops => setOperaciones(ops.filter(o => Number(o.cobrado_total) < Number(o.precio_total) - 0.01)))
      .catch(() => setOperaciones([]));
  }, [clienteId]);

  // ── Al cambiar operación → detalle + cobrado ──────────────
  useEffect(() => {
    if (!operacionId) {
      setOperacionSel(null); setCobradoOp(0); setDescuentosOp(0); setPresupuestoDetalle(null);
      resetBonificacion();
      return;
    }
    const op = operaciones.find(o => o.id === operacionId) ?? null;
    setOperacionSel(op);
    resetBonificacion();

    api.get<PresupuestoDetalle>(`/operaciones/${operacionId}`)
      .then(detail => {
        setPresupuestoDetalle(detail);
        // Auto-set client when arriving from "Cobrar saldo" (URL param, no client selected yet)
        if (!clienteId && detail.cliente_id) {
          setClienteId(detail.cliente_id);
          setClienteSel(detail.cliente as Cliente);
        }
      })
      .catch(() => setPresupuestoDetalle(null));

    api.get<{ id: string; estado: string }[]>(`/pedidos?operacion_id=${operacionId}`)
      .then(data => setTienePedido(data.some(p => p.estado !== 'cancelado')))
      .catch(() => setTienePedido(false));

    api.get<{ monto_total: number; monto_descuento?: number; estado: string }[]>(`/recibos?operacion_id=${operacionId}`)
      .then(data => {
        const emitidos = data.filter(r => r.estado === 'emitido');
        setCobradoOp(emitidos.reduce((s, r) => s + Number(r.monto_total), 0));
        setDescuentosOp(emitidos.reduce((s, r) => s + Number(r.monto_descuento ?? 0), 0));
      })
      .catch(() => { setCobradoOp(0); setDescuentosOp(0); });
  }, [operacionId, operaciones]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Reset parcial cuando cambia a pago total ──────────────
  useEffect(() => {
    if (tipoPago === 'total') setMontoParcial('');
  }, [tipoPago]);

  // ── Cálculo del total de presupuesto ──────────────────────
  const totalPresupuesto = Number(operacionSel?.precio_total ?? 0);
  // Descuentos ya otorgados en recibos previos no son deuda — restarlos del saldo
  const saldoOp = Math.max(0, totalPresupuesto - cobradoOp - descuentosOp);

  // ── Breakdown bonificación ────────────────────────────────
  // Descuentos disponibles en cualquier forma de pago (típicamente Contado, excepcionalmente otros)
  const aplicaBonificacion = !isEdit && !!presupuestoDetalle;

  // Presupuesto con "Varias formas de pago" → obliga a elegir cuál de las ofrecidas se usó
  const alternativasOfrecidas = presupuestoDetalle?.forma_pago === 'Varias formas de pago'
    ? (presupuestoDetalle.formas_pago_alternativas ?? [])
    : [];

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

  // ── Saldo efectivo (aplica descuento si hay bonificación activa) ──
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

  // Atajos de vencimiento para el compromiso — se cuentan desde la fecha del recibo,
  // no desde hoy (se puede estar cargando un cobro de días atrás).
  function fechaEnDias(dias: number): string {
    const d = new Date(fecha + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }
  // Un parcial que igual cancela todo el saldo no deja nada que comprometer.
  const hayQueComprometer = saldoTrasRecibo > 0.01;
  const diasHastaCompromiso = compromisoFecha
    ? Math.round(
        (new Date(compromisoFecha + 'T12:00:00').getTime() - new Date(fecha + 'T12:00:00').getTime()) / 86400000,
      )
    : null;

  // ── Concepto e ítems tomados del presupuesto ──────────────
  // Mismo criterio que la venta rápida de mostrador: el recibo dice a qué presupuesto
  // corresponde y qué incluye, sin que haya que escribirlo a mano.
  //
  // El concepto describe lo que el pago HACE, no qué botón se apretó: "Pago total"
  // solo cuando este recibo cubre el presupuesto entero y no hubo cobros previos. Si
  // ya se cobró algo antes y este pago cierra el saldo, es la cancelación de un saldo
  // — decirle "Pago total" al segundo de dos pagos era engañoso en el comprobante.
  const cancelaSaldo   = montoFinal > 0 && saldoTrasRecibo < 0.01;
  const huboCobrosPrevios = cobradoOp > 0.01;
  // "Pago total" solo si es el modo elegido Y no hubo cobros previos. Con "Pago
  // parcial" seleccionado el concepto arranca SIEMPRE con "Pago parcial", aunque el
  // monto tipeado alcance a cubrir el saldo — si no, escribir el importe completo
  // hacía que el concepto se contradijera con el modo elegido.
  const conceptoSugerido = operacionSel
    ? (tipoPago === 'total' && !huboCobrosPrevios
        ? `Pago total presupuesto N° ${operacionSel.numero}`
        : cancelaSaldo
          ? `Pago parcial — cancelación total de saldo presupuesto N° ${operacionSel.numero}`
          : `Pago parcial presupuesto N° ${operacionSel.numero}`)
    : '';

  useEffect(() => {
    if (isEdit || conceptoManual || !conceptoSugerido) return;
    setConcepto(conceptoSugerido);
  }, [conceptoSugerido, conceptoManual, isEdit]);

  // Ítems del presupuesto, para que el recibo detalle qué se está cobrando. Suman
  // exactamente `operaciones.precio_total` (el trigger recalcular_totales_operacion
  // no incluye el envío, así que no hay que sumarlo acá).
  const itemsDelPresupuesto = (presupuestoDetalle?.items ?? []).map(it => ({
    descripcion: (it.descripcion || 'Ítem del presupuesto').slice(0, 500),
    producto_id: it.producto_id ?? null,
    cantidad:    Number.isInteger(it.cantidad) && it.cantidad > 0 ? it.cantidad : undefined,
    monto:       Math.round(Number(it.precio_total) * 100) / 100,
  }));

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

  // Al llegar el detalle de una operación con varias alternativas ofrecidas, no
  // preseleccionar ninguna — obliga a elegir antes de poder calcular/guardar.
  useEffect(() => {
    if (presupuestoDetalle?.forma_pago === 'Varias formas de pago' && (presupuestoDetalle.formas_pago_alternativas?.length ?? 0) > 0) {
      setFormaPago('');
      setFormaPagoAlternativaId('');
      resetBonificacion();
    }
  }, [presupuestoDetalle]); // eslint-disable-line react-hooks/exhaustive-deps

  function elegirAlternativa(alt: { id: string; nombre: string; descuento_pct: number }) {
    setFormaPago(alt.nombre);
    setFormaPagoAlternativaId(alt.id);
    aplicarPreset(Number(alt.descuento_pct) / 100);
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

  // ── Comprobante de pago (pegar / arrastrar / seleccionar) ──
  async function subirComprobante(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Solo se aceptan imágenes'); return; }
    setUploadingComprobante(true);
    try {
      const token = sessionStorage.getItem('aberturas_token');
      const fd = new FormData();
      fd.append('comprobante', file);
      const res = await fetch('/api/recibos/upload-comprobante', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error('Error al subir comprobante');
      const { url } = await res.json();
      setComprobanteUrl(url);
      toast.success('Comprobante adjuntado');
    } catch {
      toast.error('No se pudo subir el comprobante');
    } finally {
      setUploadingComprobante(false);
    }
  }

  function handlePasteComprobante(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (file) { e.preventDefault(); subirComprobante(file); }
  }

  function handleDropComprobante(e: React.DragEvent) {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (file) subirComprobante(file);
  }

  // ── Guardar ───────────────────────────────────────────────
  async function handleSave() {
    if (!clienteId)                { toast.error('Seleccioná un cliente'); return; }
    if (!operacionId)              { toast.error('Seleccioná el presupuesto'); return; }
    if (!formaPago)                { toast.error('Seleccioná forma de pago'); return; }
    if (alternativasOfrecidas.length > 0 && !formaPagoAlternativaId) {
      toast.error('Elegí cuál de las formas de pago ofrecidas usó el cliente');
      return;
    }
    if (montoFinal <= 0)           { toast.error('El monto debe ser mayor a 0'); return; }
    if (esParcial && hayQueComprometer && crearCompromiso && !compromisoFecha) {
      toast.error('Ingresá la fecha estimada de cancelación del saldo');
      return;
    }

    // Campos de descuento — monto_lista - monto_descuento = monto_total (cobrado)
    const descPct    = aplicaBonificacion && pctActual > 0 ? Math.round(pctActual * 10000) / 100 : 0;
    const descMonto  = aplicaBonificacion && pctActual > 0 ? Math.round(descuentoMonto * 100) / 100 : 0;
    const listaTotal = Math.round((montoFinal + descMonto) * 100) / 100;

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
      // En alta, el detalle de lo que se cobra sale del presupuesto vinculado; en
      // edición se reenvían los que ya tenía (el PUT los reemplaza por completo).
      items:           isEdit ? itemsExistentes : itemsDelPresupuesto,
      descuento_pct:   descPct,
      monto_lista:     listaTotal,
      monto_descuento: descMonto,
      comprobante_url: comprobanteUrl || null,
      forma_pago_alternativa_id: formaPagoAlternativaId || null,
    };

    if (!isEdit && esParcial && hayQueComprometer && crearCompromiso && compromisoFecha) {
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
        toast.success(payload.compromiso ? 'Recibo creado y compromiso registrado' : 'Recibo creado');
        setSavedId(rec.id);
      }
    } catch (e) {
      toastApiError(e, { fallback: 'Error al guardar', labelCampo: campo => CAMPO_LABELS[campo] ?? campo });
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white';
  const labelCls = 'block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5';

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/recibos')} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
          <ArrowLeft size={17} className="text-gray-600" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
          <Receipt size={16} className="text-emerald-600" />
        </div>
        <h1 className="text-base font-bold text-gray-900 flex-1">
          {isEdit ? 'Editar recibo' : 'Nuevo recibo'}
        </h1>
        <div className="flex items-center gap-2">
          <HelpButton topic="recibos" />
          <button onClick={() => navigate('/recibos')}
            className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium shadow-md">
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
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-200 last:border-0">
                    <p className="text-sm font-medium text-gray-800">{nombreCliente(c)}</p>
                    {c.telefono && <p className="text-xs text-gray-600">{c.telefono}</p>}
                  </button>
                ))}
              </div>
            )}
            {showClientes && searchCliente.length > 1 && clientes.length === 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-center text-xs text-gray-600">
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
            <p className="text-xs text-gray-600 italic">
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
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Total presupuesto</p>
                    <p className="text-sm font-bold text-gray-800">{formatCurrency(totalPresupuesto)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Ya cobrado</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(cobradoOp)}</p>
                  </div>
                  <div className={cn('rounded-xl p-3 text-center', saldoOp <= 0 ? 'bg-gray-100' : 'bg-amber-50')}>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Saldo pendiente</p>
                    <p className={cn('text-sm font-bold', saldoOp <= 0 ? 'text-gray-600' : 'text-amber-700')}>
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
            {alternativasOfrecidas.length === 0 && (
              <div>
                <label className={labelCls}>Forma de pago *</label>
                <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className={inputCls}>
                  {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            )}
          </div>

          {alternativasOfrecidas.length > 0 && (
            <div className="mt-3">
              <label className={labelCls}>Forma de pago * — elegí la que usó el cliente</label>
              <div className="space-y-1.5 mt-1">
                {alternativasOfrecidas.map(alt => (
                  <label key={alt.id} className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer',
                    formaPagoAlternativaId === alt.id ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-400'
                  )}>
                    <input type="radio" name="forma_pago_alternativa" checked={formaPagoAlternativaId === alt.id}
                      onChange={() => elegirAlternativa(alt)}
                      className="text-violet-600 focus:ring-violet-400" />
                    <span className="text-sm text-gray-700 flex-1">{alt.nombre}</span>
                    {Number(alt.descuento_pct) > 0 && (
                      <span className="text-xs font-semibold text-emerald-600">{alt.descuento_pct}% desc.</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
          {formaPago === 'Transferencia' && (
            <div className="mt-3">
              <label className={labelCls}>N° de transferencia / CBU</label>
              <input value={referencia} onChange={e => setReferencia(e.target.value)}
                placeholder="Referencia del pago" className={inputCls} />
            </div>
          )}

          {/* Comprobante de pago — transferencia o link de MercadoPago */}
          <div className="mt-3">
            <label className={labelCls}>Comprobante de pago</label>
            {comprobanteUrl ? (
              <div className="flex items-center gap-3 border border-gray-200 rounded-xl p-2">
                <a href={comprobanteUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <img src={comprobanteUrl} alt="Comprobante" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                </a>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600">Comprobante adjuntado</p>
                  <a href={comprobanteUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline">Ver completo</a>
                </div>
                <button type="button" onClick={() => setComprobanteUrl('')}
                  className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors shrink-0" title="Quitar">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div
                tabIndex={0}
                onPaste={handlePasteComprobante}
                onDrop={handleDropComprobante}
                onDragOver={e => e.preventDefault()}
                onClick={() => comprobanteInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-xl py-4 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                {uploadingComprobante ? (
                  <RefreshCw size={18} className="text-gray-600 animate-spin" />
                ) : (
                  <ImagePlus size={18} className="text-gray-600" />
                )}
                <p className="text-xs text-gray-600 text-center">
                  Hacé click y pegá (Ctrl+V) la captura de WhatsApp, o arrastrala acá
                </p>
                <input
                  ref={comprobanteInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(f); e.target.value = ''; }}
                />
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── 4. Descuento (típicamente pago contado) ──────── */}
      {aplicaBonificacion && (
        <SectionCard
          title="Descuento"
          icon={Gift}
          accent="bg-violet-50 border-violet-100 text-violet-700"
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              {alternativasOfrecidas.length > 0
                ? 'Descuento de la alternativa elegida — se puede ajustar puntualmente si hace falta.'
                : formaPago === 'Contado'
                ? 'Descuento sobre precio de productos. No aplica sobre instalación ni envío.'
                : <span className="text-amber-600">Descuento habitual es solo contado. Confirmar si aplica en esta forma de pago.</span>
              }
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-600 font-semibold">Descuento:</span>
              {alternativasOfrecidas.length === 0 && [5, 7, 10, 15].map(pct => (
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
                    'w-24 pl-3 pr-7 py-1.5 border rounded-lg text-base sm:text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none',
                    bonCustom ? 'border-violet-400 bg-violet-50' : 'border-gray-200',
                  )}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 pointer-events-none">%</span>
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
                {/* Si hay pagos previos, mostrar el subtotal y la deducción para que cuadren los números */}
                {cobradoOp > 0 ? (
                  <>
                    <div className="flex justify-between text-xs text-violet-600 pt-1.5 border-t border-violet-200">
                      <span>Subtotal operación c/bonif.</span>
                      <span className="font-semibold">{formatCurrency(totalConBonif)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Ya cobrado anteriormente</span>
                      <span>− {formatCurrency(cobradoOp)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-violet-700 pt-1.5 border-t border-violet-200">
                      <span>Saldo a cobrar en este recibo</span>
                      <span>{formatCurrency(saldoEfectivo)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm font-bold text-violet-700 pt-1.5 border-t border-violet-200">
                    <span>Total con bonificación</span>
                    <span>{formatCurrency(totalConBonif)}</span>
                  </div>
                )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                {pctActual > 0 && (
                  <span className="text-[10px] text-violet-600 font-medium">
                    incl. {(pctActual * 100 % 1 === 0 ? (pctActual * 100).toFixed(0) : (pctActual * 100).toFixed(1))}% desc.
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
                <span className="text-xs text-gray-600">Indicar monto</span>
              </button>
            </div>

            {/* Input monto parcial */}
            {tipoPago === 'parcial' && (
              <div>
                <label className={labelCls}>Monto a cobrar *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 font-medium">$</span>
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
                {/* Cuenta completa del saldo, calculada sola: de dónde sale y qué
                    queda. Antes solo se veía el resultado en una línea gris chica. */}
                {montoFinal > 0 && (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Total del presupuesto</span>
                      <span className="tabular-nums">{formatCurrency(totalPresupuesto)}</span>
                    </div>
                    {cobradoOp > 0 && (
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Ya cobrado antes de este recibo</span>
                        <span className="tabular-nums">− {formatCurrency(cobradoOp)}</span>
                      </div>
                    )}
                    {descuentosOp > 0 && (
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Bonificaciones otorgadas</span>
                        <span className="tabular-nums">− {formatCurrency(descuentosOp)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-gray-700 font-medium">
                      <span>Este pago</span>
                      <span className="tabular-nums">− {formatCurrency(montoFinal)}</span>
                    </div>
                    <div className={cn(
                      'flex justify-between items-baseline pt-1.5 border-t',
                      saldoTrasRecibo > 0.01 ? 'border-amber-200' : 'border-emerald-200',
                    )}>
                      <span className={cn(
                        'text-xs font-bold uppercase tracking-wide',
                        saldoTrasRecibo > 0.01 ? 'text-amber-700' : 'text-emerald-700',
                      )}>
                        {saldoTrasRecibo > 0.01 ? 'Saldo pendiente' : 'Saldo cancelado'}
                      </span>
                      <span className={cn(
                        'text-lg font-black tabular-nums',
                        saldoTrasRecibo > 0.01 ? 'text-amber-700' : 'text-emerald-700',
                      )}>
                        {formatCurrency(saldoTrasRecibo)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── 6. Compromiso de saldo (solo pago parcial) ───── */}
      {!isEdit && esParcial && operacionSel && montoFinal > 0 && hayQueComprometer && (
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
                className="w-4 h-4 text-emerald-600 rounded border-gray-400 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">Registrar compromiso de cancelación del saldo</span>
            </label>

            {crearCompromiso && (
              <div className="space-y-3">
                {/* La fecha es el dato que hay que acordar con el cliente en el
                    mostrador, así que va destacada y no como un input más. */}
                <div className={cn(
                  'rounded-xl border-2 p-3',
                  compromisoFecha ? 'border-amber-300 bg-amber-50/60' : 'border-red-300 bg-red-50/60',
                )}>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-gray-700 flex items-center gap-1.5 mb-2">
                    <Calendar size={13} /> ¿Cuándo cancela el saldo? *
                  </label>
                  <input type="date"
                    value={compromisoFecha}
                    onChange={e => setCompromisoFecha(e.target.value)}
                    min={fecha}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[7, 15, 30, 60].map(d => (
                      <button key={d} type="button" onClick={() => setCompromisoFecha(fechaEnDias(d))}
                        className={cn(
                          'px-2.5 h-8 rounded-lg text-xs font-semibold border transition-colors',
                          compromisoFecha === fechaEnDias(d)
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300',
                        )}>
                        {d} días
                      </button>
                    ))}
                  </div>
                  {compromisoFecha ? (
                    <p className="text-sm text-amber-900 mt-2.5 leading-snug">
                      Se compromete a pagar{' '}
                      <strong className="font-black">{formatCurrency(saldoTrasRecibo)}</strong>
                      {' '}el{' '}
                      <strong className="font-black">
                        {new Date(compromisoFecha + 'T12:00:00').toLocaleDateString('es-AR', {
                          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                        })}
                      </strong>
                      {diasHastaCompromiso !== null && diasHastaCompromiso >= 0 && (
                        <span className="text-amber-700"> (en {diasHastaCompromiso} día{diasHastaCompromiso !== 1 ? 's' : ''})</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 font-medium mt-2">
                      Falta la fecha — sin esto no se puede guardar el recibo.
                    </p>
                  )}
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
                onChange={e => { setConcepto(e.target.value); setConceptoManual(true); }}
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
        <div className="bg-white rounded-xl border border-gray-400 shadow-lg p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Total del recibo</p>
              <p className={cn('text-3xl font-bold', montoFinal > 0 ? 'text-gray-900' : 'text-gray-600')}>
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
                <p className="text-xs text-gray-600 mt-1">
                  Saldo pendiente:{' '}
                  <span className={cn('font-semibold', saldoTrasRecibo <= 0 ? 'text-emerald-600' : 'text-amber-600')}>
                    {formatCurrency(saldoTrasRecibo)}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={() => navigate('/recibos')}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold shadow-md">
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
          entityEndpoint={`/recibos/${savedId}`}
          clienteNombre={presupuestoDetalle ? (
            presupuestoDetalle.cliente.tipo_persona === 'juridica'
              ? presupuestoDetalle.cliente.razon_social ?? undefined
              : [presupuestoDetalle.cliente.apellido, presupuestoDetalle.cliente.nombre].filter(Boolean).join(' ') || undefined
          ) : undefined}
          clienteTelefono={presupuestoDetalle?.cliente.telefono ?? undefined}
          pedidoProveedorUrl={operacionId && !tienePedido ? `/pedidos/nuevo?operacion_id=${operacionId}` : undefined}
        />
      )}
    </div>
  );
}
