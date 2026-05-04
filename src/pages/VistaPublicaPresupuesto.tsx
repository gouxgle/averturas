import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Clock, Loader2, MapPin, Gift, Truck, Building2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const NAVY = '#031d49';
const RED  = '#e31e24';

interface Empresa {
  nombre: string; cuit: string | null; telefono: string | null;
  email: string | null; direccion: string | null; logo_url: string | null;
}

interface Item {
  descripcion: string; cantidad: number; precio_unitario: number;
  precio_instalacion: number; incluye_instalacion: boolean; precio_total: number;
  medida_ancho: number | null; medida_alto: number | null; color: string | null;
  tipo_abertura_nombre: string | null; sistema_nombre: string | null;
}

interface Presupuesto {
  id: string; numero: string; estado: string; forma_pago: string | null;
  forma_envio: string | null; costo_envio: number; tiempo_entrega: number | null;
  fecha_validez: string | null; notas: string | null; precio_total: number;
  aprobado_online_at: string | null;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string; direccion: string | null; localidad: string | null };
  empresa: Empresa;
  items: Item[];
}

const FORMA_ENVIO_LABEL: Record<string, { label: string; Icon: React.ElementType }> = {
  retiro_local:     { label: 'Retiro en local',                Icon: MapPin },
  envio_bonificado: { label: 'Envío bonificado',               Icon: Gift },
  envio_destino:    { label: 'Envío a destino (paga cliente)', Icon: Truck },
  envio_empresa:    { label: 'Envío a cargo de la empresa',    Icon: Building2 },
};

function fmtFecha(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function nombreCliente(c: Presupuesto['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '';
  return [c.apellido, c.nombre].filter(Boolean).join(', ');
}

type Estado = 'loading' | 'error' | 'not_found' | 'data' | 'aprobando' | 'aprobado' | 'ya_aprobado';

export function VistaPublicaPresupuesto() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<Estado>('loading');
  const [pres, setPres]     = useState<Presupuesto | null>(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (!token) { setEstado('not_found'); return; }
    fetch(`/api/pub/presupuesto/${token}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error ?? 'Error')))
      .then(d => {
        setPres(d);
        if (d.aprobado_online_at || d.estado === 'aprobado') setEstado('ya_aprobado');
        else setEstado('data');
      })
      .catch(e => { setErrMsg(String(e)); setEstado('not_found'); });
  }, [token]);

  async function aprobar() {
    if (!token) return;
    setEstado('aprobando');
    try {
      const r = await fetch(`/api/pub/presupuesto/${token}/aprobar`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Error');
      setEstado(d.ya_aprobado ? 'ya_aprobado' : 'aprobado');
    } catch (e) {
      setErrMsg(String(e));
      setEstado('error');
    }
  }

  // ── Estados de pantalla ────────────────────────────────────
  if (estado === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 size={28} className="animate-spin text-gray-400" />
    </div>
  );

  if (estado === 'not_found') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <AlertTriangle size={36} className="mx-auto mb-4 text-red-400" />
        <h2 className="text-lg font-bold text-gray-800 mb-2">Link inválido</h2>
        <p className="text-sm text-gray-500">{errMsg || 'Este presupuesto no existe o el link es incorrecto.'}</p>
      </div>
    </div>
  );

  if (estado === 'aprobado') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-sm w-full text-center">
        <div className="bg-emerald-600 px-6 py-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
            <CheckCircle2 size={36} className="text-white" />
          </div>
          <h2 className="text-white font-bold text-xl">¡Presupuesto aprobado!</h2>
          <p className="text-emerald-100 text-sm mt-1">Gracias por confirmar</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            Recibimos tu aprobación del presupuesto <strong>{pres?.numero}</strong>.
            Nos comunicaremos pronto para coordinar los próximos pasos.
          </p>
          {pres?.empresa?.telefono && (
            <a
              href={`https://wa.me/${pres.empresa.telefono.replace(/\D/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] hover:bg-[#1ebe5a] text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Contactar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );

  if (estado === 'ya_aprobado') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <CheckCircle2 size={36} className="mx-auto mb-4 text-emerald-500" />
        <h2 className="text-lg font-bold text-gray-800 mb-2">Presupuesto ya aprobado</h2>
        <p className="text-sm text-gray-500">
          El presupuesto <strong>{pres?.numero}</strong> ya fue confirmado.
          Si tenés dudas, comunicate directamente con nosotros.
        </p>
      </div>
    </div>
  );

  if (estado === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <AlertTriangle size={36} className="mx-auto mb-4 text-red-400" />
        <p className="text-sm text-gray-600">{errMsg || 'Ocurrió un error. Intentá de nuevo.'}</p>
      </div>
    </div>
  );

  if (!pres) return null;

  const costoEnvio = pres.forma_envio === 'envio_empresa' ? Number(pres.costo_envio ?? 0) : 0;
  const esCuotas   = pres.forma_pago === 'Tarjeta de crédito 3 cuotas sin interés';
  const envioInfo  = pres.forma_envio ? FORMA_ENVIO_LABEL[pres.forma_envio] : null;
  const vencido    = pres.fecha_validez
    ? new Date(pres.fecha_validez.slice(0, 10) + 'T23:59:59') < new Date()
    : false;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Header empresa */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logochico.png" alt="Logo" style={{ height: 36 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p className="font-bold text-base" style={{ color: NAVY }}>{pres.empresa.nombre}</p>
              {pres.empresa.cuit && <p className="text-xs text-gray-500">CUIT {pres.empresa.cuit}</p>}
              {pres.empresa.telefono && <p className="text-xs text-gray-500">Tel: {pres.empresa.telefono}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: RED }}>Presupuesto</div>
            <div className="font-mono font-bold text-gray-800 mt-0.5">{pres.numero}</div>
          </div>
        </div>

        {/* Vencimiento */}
        {pres.fecha_validez && (
          <div className={`rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-medium ${vencido ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            <Clock size={14} />
            {vencido
              ? `Este presupuesto venció el ${fmtFecha(pres.fecha_validez)}`
              : `Válido hasta el ${fmtFecha(pres.fecha_validez)}`
            }
          </div>
        )}

        {/* Cliente */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Para</p>
          <p className="text-base font-bold text-gray-900">{nombreCliente(pres.cliente)}</p>
          {(pres.cliente.direccion || pres.cliente.localidad) && (
            <p className="text-sm text-gray-500 mt-0.5">
              {[pres.cliente.direccion, pres.cliente.localidad].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* Ítems */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Detalle</p>
          </div>
          <div className="divide-y divide-gray-50">
            {pres.items.map((item, i) => {
              const specs = [
                item.tipo_abertura_nombre,
                item.sistema_nombre,
                item.color,
                (item.medida_ancho || item.medida_alto)
                  ? `${item.medida_ancho ?? '?'} × ${item.medida_alto ?? '?'} m`
                  : null,
              ].filter(Boolean).join(' · ');
              return (
                <div key={i} className="flex items-start justify-between gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{item.descripcion}</span>
                      {item.cantidad > 1 && (
                        <span className="text-xs text-gray-400 shrink-0">× {item.cantidad}</span>
                      )}
                    </div>
                    {specs && <p className="text-xs text-gray-400 mt-0.5">{specs}</p>}
                    {item.incluye_instalacion && (
                      <span className="text-xs text-emerald-600 font-medium">✓ Con instalación</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-900 tabular-nums shrink-0">
                    {formatCurrency(Number(item.precio_total))}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="px-5 py-4 border-t border-gray-100 space-y-1.5 bg-gray-50/60">
            {costoEnvio > 0 && envioInfo && (
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  {(() => { const { Icon } = envioInfo; return <Icon size={13} />; })()}
                  {envioInfo.label}
                </span>
                <span>{formatCurrency(costoEnvio)}</span>
              </div>
            )}
            {envioInfo && costoEnvio === 0 && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                {(() => { const { Icon } = envioInfo; return <Icon size={13} />; })()}
                <span>{envioInfo.label}</span>
              </div>
            )}
            {pres.forma_pago && (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Forma de pago</span>
                <span className="font-medium">{pres.forma_pago}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-base font-bold text-gray-900">Total</span>
              <span className="text-xl font-extrabold tabular-nums" style={{ color: NAVY }}>
                {formatCurrency(Number(pres.precio_total))}
              </span>
            </div>
            {esCuotas && (
              <div className="flex justify-end">
                <span className="text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100 px-3 py-1 rounded-lg">
                  3 cuotas de {formatCurrency(Number(pres.precio_total) / 3)}
                </span>
              </div>
            )}
          </div>
        </div>

        {pres.notas && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
            {pres.notas}
          </div>
        )}

        {pres.tiempo_entrega && (
          <p className="text-center text-sm text-gray-500">
            Tiempo de entrega estimado: <strong>{pres.tiempo_entrega} días hábiles</strong>
          </p>
        )}

        {/* Botón aprobar */}
        <div className="pb-4">
          <button
            onClick={aprobar}
            disabled={estado === 'aprobando'}
            className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
            style={{ background: estado === 'aprobando' ? '#888' : '#16a34a', boxShadow: '0 4px 18px rgba(22,163,74,0.35)' }}
          >
            {estado === 'aprobando'
              ? <><Loader2 size={18} className="animate-spin" /> Procesando...</>
              : <><CheckCircle2 size={18} /> Aprobar presupuesto</>
            }
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            Al aprobar confirmás que aceptás el presupuesto tal como está presentado.
          </p>
        </div>

      </div>
    </div>
  );
}
