import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, ArrowRight, Send, CheckCircle, XCircle, AlertTriangle, Clock, RotateCcw, X, Pen, Printer, User, CreditCard, Truck, MapPin, Gift, Building2, Package, Share2, Copy, Check, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Operacion, EstadoOperacion } from '@/types';

const FILTROS: { value: 'activos' | EstadoOperacion; label: string }[] = [
  { value: 'activos',     label: 'Activos' },
  { value: 'presupuesto', label: 'Borrador' },
  { value: 'enviado',     label: 'Enviados' },
  { value: 'aprobado',    label: 'Aprobados' },
  { value: 'rechazado',   label: 'Rechazados' },
];

const ESTADO_COLOR: Record<string, string> = {
  presupuesto:   'bg-gray-100 text-gray-700',
  enviado:       'bg-blue-100 text-blue-700',
  aprobado:      'bg-green-100 text-green-700',
  rechazado:     'bg-red-100 text-red-700',
  en_produccion: 'bg-amber-100 text-amber-700',
  listo:         'bg-teal-100 text-teal-700',
  instalado:     'bg-purple-100 text-purple-700',
  entregado:     'bg-indigo-100 text-indigo-700',
  cancelado:     'bg-red-100 text-red-700',
};

const ESTADO_LABEL: Record<string, string> = {
  presupuesto: 'Borrador',
  enviado:     'Enviado',
  aprobado:    'Aprobado',
  rechazado:   'Rechazado',
};

const TIPO_LABEL: Record<string, string> = {
  estandar:           'Estándar',
  a_medida_proveedor: 'A medida',
  fabricacion_propia: 'Fabricación',
};

const FORMA_ENVIO_LABEL: Record<string, { label: string; icon: React.ElementType }> = {
  retiro_local:     { label: 'Retiro en local',                icon: MapPin },
  envio_bonificado: { label: 'Envío bonificado',               icon: Gift },
  envio_destino:    { label: 'Envío a destino (paga cliente)', icon: Truck },
  envio_empresa:    { label: 'Envío a cargo de la empresa',    icon: Building2 },
};

interface OpDetalle {
  id: string; numero: string; tipo: string; estado: EstadoOperacion;
  cliente_id: string; tipo_proyecto: string | null; forma_pago: string | null;
  tiempo_entrega: number | null; fecha_validez: string | null;
  notas: string | null; created_at: string; updated_at: string;
  forma_envio: string | null; costo_envio: number;
  cliente: {
    nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; telefono: string | null; email: string | null;
    direccion: string | null; localidad: string | null;
  };
  items: Array<{
    id: string; descripcion: string; cantidad: number;
    precio_unitario: number; precio_instalacion: number;
    incluye_instalacion: boolean; precio_total: number;
    medida_ancho: number | null; medida_alto: number | null;
    color: string | null; vidrio: string | null; accesorios: string[];
    tipo_abertura_nombre: string | null; sistema_nombre: string | null;
    producto_atributos: Record<string, unknown> | null;
  }>;
}

function PresupuestoModal({
  id, onClose, onEstadoChange,
}: {
  id: string;
  onClose: () => void;
  onEstadoChange: (id: string, estado: EstadoOperacion) => void;
}) {
  const navigate = useNavigate();
  const [op, setOp] = useState<OpDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando]         = useState(false);
  const [linkUrl, setLinkUrl]             = useState<string | null>(null);
  const [generandoLink, setGenerandoLink] = useState(false);
  const [copiado, setCopiado]             = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get<OpDetalle>(`/operaciones/${id}`)
      .then(d => { setOp(d); setLoading(false); })
      .catch(err => { setError(err.message ?? 'Error al cargar'); setLoading(false); });
  }, [id]);

  async function generarLink() {
    setGenerandoLink(true);
    try {
      const { url } = await api.post<{ token: string; url: string }>(`/operaciones/${id}/generar-link`, {});
      setLinkUrl(url);
    } finally {
      setGenerandoLink(false);
    }
  }

  async function copiarLink() {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(linkUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function compartirWhatsApp() {
    if (!linkUrl || !op) return;
    const cl = op.cliente;
    const nombre = cl.tipo_persona === 'juridica' ? cl.razon_social : `${cl.nombre ?? ''} ${cl.apellido ?? ''}`.trim();
    const msg = encodeURIComponent(`Hola ${nombre}, te envío el presupuesto ${op.numero} para tu revisión y aprobación:\n${linkUrl}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  async function cambiarEstado(nuevoEstado: EstadoOperacion) {
    if (!op) return;
    setCambiando(true);
    await api.patch(`/operaciones/${id}/estado`, { estado: nuevoEstado });
    const updated = { ...op, estado: nuevoEstado };
    setOp(updated);
    onEstadoChange(id, nuevoEstado);
    setCambiando(false);
  }

  const esAprobado  = op?.estado === 'aprobado';
  const puedeEditar = op && !esAprobado;

  const subtotal   = op ? op.items.reduce((s, it) => s + Number(it.precio_total), 0) : 0;
  const costoEnvio = op?.forma_envio === 'envio_empresa' ? Number(op.costo_envio ?? 0) : 0;
  const total      = subtotal + costoEnvio;
  const esCuotas   = op?.forma_pago === 'Tarjeta de crédito 3 cuotas sin interés';

  const fmtEnvio = op?.forma_envio ? FORMA_ENVIO_LABEL[op.forma_envio] : null;
  const EnvioIcon = fmtEnvio?.icon ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <FileText size={16} className="text-violet-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{op?.numero ?? '...'}</span>
                {op && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', ESTADO_COLOR[op.estado] ?? 'bg-gray-100 text-gray-700')}>
                    {ESTADO_LABEL[op.estado] ?? op.estado}
                  </span>
                )}
              </div>
              {op && <p className="text-xs text-gray-400 mt-0.5">{formatDate(op.created_at)}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {op && (
              <>
                {puedeEditar && (
                  <button
                    onClick={() => navigate(`/presupuestos/${id}/editar`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg font-medium transition-colors"
                  >
                    <Pen size={13} /> Editar
                  </button>
                )}
                <button
                  onClick={() => window.open(`/imprimir/presupuesto/${id}`, '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg font-medium transition-colors"
                >
                  <Printer size={13} /> PDF
                </button>
                <button
                  onClick={generarLink}
                  disabled={generandoLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Share2 size={13} /> {generandoLink ? '...' : 'Compartir'}
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Panel de link generado */}
        {linkUrl && (
          <div className="mx-5 mt-4 mb-0 bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-emerald-800">Link de aprobación generado</p>
            <div className="flex items-center gap-2">
              <input
                readOnly value={linkUrl}
                className="flex-1 text-xs bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-mono select-all"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={copiarLink}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                {copiado ? <Check size={12} /> : <Copy size={12} />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <button
              onClick={compartirWhatsApp}
              className="w-full flex items-center justify-center gap-2 py-2 bg-[#25D366] hover:bg-[#1ebe5a] text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Enviar por WhatsApp
            </button>
            <p className="text-[10px] text-emerald-700 text-center">El link regenerado invalida el anterior</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 text-sm">{error}</div>
        ) : op ? (
          <div className="divide-y divide-gray-100">
            {/* Cliente */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2.5">
                <User size={13} className="text-gray-400" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cliente</p>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {op.cliente.tipo_persona === 'juridica'
                  ? op.cliente.razon_social
                  : `${op.cliente.apellido ?? ''} ${op.cliente.nombre ?? ''}`.trim()}
              </p>
              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                {op.cliente.telefono && <span>{op.cliente.telefono}</span>}
                {op.cliente.email    && <span>{op.cliente.email}</span>}
                {(op.cliente.direccion || op.cliente.localidad) && (
                  <span>{[op.cliente.direccion, op.cliente.localidad].filter(Boolean).join(', ')}</span>
                )}
              </div>
            </div>

            {/* Proyecto/pago */}
            <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {op.tipo_proyecto && (
                <div><span className="text-gray-400">Proyecto: </span><span className="font-medium">{op.tipo_proyecto}</span></div>
              )}
              {op.tiempo_entrega && (
                <div><span className="text-gray-400">Entrega: </span><span className="font-medium">{op.tiempo_entrega} días</span></div>
              )}
              {op.fecha_validez && (
                <div><span className="text-gray-400">Válido hasta: </span><span className="font-medium">{formatDate(op.fecha_validez.slice(0, 10) + 'T12:00:00')}</span></div>
              )}
              {op.forma_pago && (
                <div className="col-span-2">
                  <span className="text-gray-400">Pago: </span>
                  <span className="font-semibold text-violet-700">{op.forma_pago}</span>
                </div>
              )}
            </div>

            {/* Ítems */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Package size={13} className="text-gray-400" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Ítems ({op.items.length})
                </p>
              </div>
              <div className="space-y-2.5">
                {op.items.map((item, i) => {
                  const attr = item.producto_atributos ?? {};
                  const hojas = attr.hojas ? `${attr.hojas} hojas`
                    : attr.config_hojas ? String(attr.config_hojas) : null;
                  const specs = [
                    item.tipo_abertura_nombre,
                    item.sistema_nombre,
                    item.color,
                    hojas,
                    (item.medida_ancho || item.medida_alto)
                      ? `${item.medida_ancho ?? '?'} × ${item.medida_alto ?? '?'} m`
                      : null,
                  ].filter(Boolean).join(' · ');

                  return (
                    <div key={item.id} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-400 shrink-0">{i + 1}.</span>
                          <span className="text-sm font-medium text-gray-800 truncate">{item.descripcion}</span>
                          {item.cantidad > 1 && (
                            <span className="text-xs text-gray-400 shrink-0">× {item.cantidad}</span>
                          )}
                        </div>
                        {specs && <p className="text-[11px] text-gray-400 mt-0.5 ml-4">{specs}</p>}
                        {item.accesorios.length > 0 && (
                          <p className="text-[11px] text-gray-400 mt-0.5 ml-4">Incluye: {item.accesorios.join(', ')}</p>
                        )}
                        {item.incluye_instalacion && (
                          <span className="ml-4 text-[10px] text-emerald-600 font-medium">✓ Con instalación</span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-gray-800 shrink-0">
                        {formatCurrency(Number(item.precio_total))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Envío + Total */}
            <div className="px-5 py-4 space-y-2">
              {fmtEnvio && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CreditCard size={13} className="text-gray-400" />
                  {EnvioIcon && <EnvioIcon size={13} className="text-gray-400" />}
                  <span>{fmtEnvio.label}</span>
                  {costoEnvio > 0 && <span className="font-semibold">({formatCurrency(costoEnvio)})</span>}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                {costoEnvio > 0 && (
                  <span className="text-xs text-gray-400">Productos: {formatCurrency(subtotal)} + Envío: {formatCurrency(costoEnvio)}</span>
                )}
                <span className="text-xs text-gray-500">Total:</span>
                <span className="text-xl font-bold text-gray-900">{formatCurrency(total)}</span>
              </div>
              {esCuotas && total > 0 && (
                <div className="flex justify-end">
                  <span className="text-xs text-violet-600 font-semibold bg-violet-50 px-3 py-1 rounded-lg border border-violet-100">
                    3 cuotas de {formatCurrency(total / 3)}
                  </span>
                </div>
              )}
              {op.notas && (
                <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700 border border-amber-100">
                  {op.notas}
                </div>
              )}
            </div>

            {/* Acciones de estado */}
            {!esAprobado && (
              <div className="px-5 py-3 flex items-center gap-2 bg-gray-50 rounded-b-2xl">
                <span className="text-xs text-gray-400 mr-1">Cambiar estado:</span>
                {op.estado === 'presupuesto' && (
                  <button onClick={() => cambiarEstado('enviado')} disabled={cambiando}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium disabled:opacity-50">
                    <Send size={11} /> Enviar
                  </button>
                )}
                {op.estado === 'enviado' && (
                  <>
                    <button onClick={() => cambiarEstado('aprobado')} disabled={cambiando}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium disabled:opacity-50">
                      <CheckCircle size={11} /> Aprobar
                    </button>
                    <button onClick={() => cambiarEstado('rechazado')} disabled={cambiando}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium disabled:opacity-50">
                      <XCircle size={11} /> Rechazar
                    </button>
                  </>
                )}
                {op.estado === 'rechazado' && (
                  <button onClick={() => cambiarEstado('presupuesto')} disabled={cambiando}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium disabled:opacity-50">
                    <RotateCcw size={11} /> Revisar
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function diasHastaVencimiento(fecha: string | null): number | null {
  if (!fecha) return null;
  const diff = new Date(fecha).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function Presupuestos() {
  const navigate = useNavigate();
  const [presupuestos, setPresupuestos] = useState<Operacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'activos' | EstadoOperacion>('activos');
  const [search, setSearch] = useState('');
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtro === 'activos') {
      params.set('estados', 'presupuesto,enviado,aprobado');
    } else {
      params.set('estado', filtro);
    }
    if (search.trim()) params.set('search', search);
    const data = await api.get<Operacion[]>(`/operaciones?${params}`);
    setPresupuestos(data);
    setLoading(false);
  }, [filtro, search]);

  useEffect(() => { load(); }, [load]);

  async function cambiarEstado(op: Operacion, nuevoEstado: EstadoOperacion) {
    setCambiando(op.id);
    await api.patch(`/operaciones/${op.id}/estado`, { estado: nuevoEstado });
    setPresupuestos(prev => prev.map(p => p.id === op.id ? { ...p, estado: nuevoEstado } : p));
    setCambiando(null);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <FileText size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Presupuestos</h1>
            <p className="text-sm text-gray-500">Gestión de cotizaciones</p>
          </div>
        </div>
        <Link
          to="/presupuestos/nuevo"
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all"
        >
          <Plus size={16} /> Nuevo presupuesto
        </Link>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTROS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFiltro(value)}
            className={cn(
              'whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
              filtro === value
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por número..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : presupuestos.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-1">No hay presupuestos</p>
            <Link to="/presupuestos/nuevo" className="text-sm text-violet-600 hover:underline">
              Crear el primero
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {presupuestos.map(op => {
              const dias = diasHastaVencimiento(op.fecha_validez);
              const vencido = dias !== null && dias < 0;
              const porVencer = dias !== null && dias >= 0 && dias <= 3;
              const cliente = op.cliente as any;
              const aprobadoOnline = !!(op as any).aprobado_online_at;

              return (
                <div
                  key={op.id}
                  className={cn(
                    'flex items-center gap-4 px-5 py-4 transition-colors group cursor-pointer',
                    aprobadoOnline
                      ? 'bg-emerald-50/70 hover:bg-emerald-50 border-l-4 border-emerald-500'
                      : 'hover:bg-gray-50'
                  )}
                  onClick={() => setDetailId(op.id)}
                >
                  <div className="w-32 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-800 group-hover:text-violet-600 transition-colors">
                        {op.numero}
                      </span>
                      {aprobadoOnline && (
                        <span title="Aprobado por el cliente vía link">
                          <Check size={12} className="text-emerald-600" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{TIPO_LABEL[op.tipo]}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {cliente?.nombre} {cliente?.apellido ?? ''}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                      <span>{formatDate(op.created_at)}</span>
                      {aprobadoOnline && (
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                          <Check size={9} /> Aprobado online
                        </span>
                      )}
                      {op.fecha_validez && !aprobadoOnline && (
                        <span className={cn(
                          'flex items-center gap-1',
                          vencido ? 'text-red-500' : porVencer ? 'text-amber-500' : 'text-gray-400'
                        )}>
                          {vencido ? <AlertTriangle size={10} /> : <Clock size={10} />}
                          {vencido
                            ? `Vencido hace ${Math.abs(dias!)} días`
                            : dias === 0
                              ? 'Vence hoy'
                              : `Vence en ${dias} días`
                          }
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium shrink-0', ESTADO_COLOR[op.estado] ?? 'bg-gray-100 text-gray-700')}>
                    {ESTADO_LABEL[op.estado] ?? op.estado}
                  </span>

                  <div className="text-right w-28 shrink-0">
                    <p className="text-sm font-bold text-gray-800">{formatCurrency(op.precio_total)}</p>
                    {op.margen > 0 && <p className="text-xs text-gray-400">{op.margen}% margen</p>}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}>
                    {op.estado === 'presupuesto' && (
                      <button
                        onClick={() => cambiarEstado(op, 'enviado')}
                        disabled={cambiando === op.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        <Send size={12} /> Enviar
                      </button>
                    )}
                    {op.estado === 'enviado' && (
                      <>
                        <button
                          onClick={() => cambiarEstado(op, 'aprobado')}
                          disabled={cambiando === op.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          <CheckCircle size={12} /> Aprobar
                        </button>
                        <button
                          onClick={() => cambiarEstado(op, 'rechazado')}
                          disabled={cambiando === op.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          <XCircle size={12} /> Rechazar
                        </button>
                      </>
                    )}
                    {op.estado === 'rechazado' && (
                      <button
                        onClick={() => cambiarEstado(op, 'presupuesto')}
                        disabled={cambiando === op.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        <RotateCcw size={12} /> Revisar
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/operaciones/${op.id}`)}
                      className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors"
                      title="Ver operación completa"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailId && (
        <PresupuestoModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onEstadoChange={(id, estado) => {
            setPresupuestos(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
          }}
        />
      )}
    </div>
  );
}
