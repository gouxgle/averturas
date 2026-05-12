import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2, AlertTriangle, Clock, Loader2,
  Phone, Mail, MapPin, Package, Truck, Shield, X,
} from 'lucide-react';

const NAVY  = '#031d49';
const RED   = '#e31e24';
const GREEN = '#16a34a';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Empresa {
  nombre: string; cuit: string | null; telefono: string | null;
  email: string | null; direccion: string | null; logo_url: string | null;
  instagram: string | null;
}
interface Item {
  descripcion: string; cantidad: number; precio_unitario: number;
  precio_instalacion: number; incluye_instalacion: boolean; precio_total: number;
  medida_ancho: number | null; medida_alto: number | null; color: string | null;
  tipo_abertura_nombre: string | null; sistema_nombre: string | null;
  producto_imagen_url: string | null;
}
interface Presupuesto {
  id: string; numero: string; estado: string; forma_pago: string | null;
  forma_envio: string | null; costo_envio: number; tiempo_entrega: number | null;
  fecha_validez: string | null; notas: string | null; precio_total: number;
  aprobado_online_at: string | null; created_at: string;
  cliente: {
    nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; documento_nro: string | null; telefono: string | null;
    email: string | null; direccion: string | null; localidad: string | null;
  };
  empresa: Empresa;
  items: Item[];
}
type Estado =
  | 'loading' | 'not_found' | 'error' | 'data'
  | 'encuesta' | 'rechazando' | 'rechazado' | 'ya_rechazado'
  | 'aprobando' | 'aprobado' | 'ya_aprobado';

const MOTIVOS = [
  'El precio no me cierra',
  'Necesito modificar medidas / productos',
  'Quiero pensarlo unos días',
  'Ya compré en otro lugar',
  'Necesito otra forma de pago',
  'Otro motivo',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtM = (n: number) =>
  `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

function fmtFecha(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function nombreCliente(c: Presupuesto['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '';
  return [c.apellido, c.nombre].filter(Boolean).join(' ');
}

function numToWords(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return 'Cero pesos';

  const U = ['','un','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
    'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete',
    'dieciocho','diecinueve','veinte','veintiún','veintidós','veintitrés',
    'veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
  const D = ['','diez','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const C = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos',
    'seiscientos','setecientos','ochocientos','novecientos'];

  function lt1000(x: number): string {
    if (x === 0) return '';
    if (x === 100) return 'cien';
    const c = Math.floor(x / 100);
    const r = x % 100;
    const cStr = C[c];
    if (r === 0) return cStr;
    const prefix = c > 0 ? cStr + ' ' : '';
    if (r < 30) return prefix + U[r];
    const d = Math.floor(r / 10);
    const u = r % 10;
    return prefix + D[d] + (u > 0 ? ' y ' + U[u] : '');
  }

  const M = Math.floor(n / 1_000_000);
  const K = Math.floor((n % 1_000_000) / 1_000);
  const R = n % 1_000;
  const parts: string[] = [];
  if (M > 0) parts.push(M === 1 ? 'un millón' : `${lt1000(M)} millones`);
  if (K > 0) parts.push(K === 1 ? 'mil' : `${lt1000(K)} mil`);
  if (R > 0) parts.push(lt1000(R));
  const text = parts.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1) + ' pesos';
}

// ── Ícono WhatsApp (SVG inline) ───────────────────────────────────────────────
function WaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function VistaPublicaPresupuesto() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado]       = useState<Estado>('loading');
  const [pres, setPres]           = useState<Presupuesto | null>(null);
  const [errMsg, setErrMsg]       = useState('');
  const [motivoSel, setMotivoSel] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    if (!token) { setEstado('not_found'); return; }
    fetch(`/api/pub/presupuesto/${token}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error ?? 'Error')))
      .then(d => {
        setPres(d);
        if (d.aprobado_online_at || d.estado === 'aprobado') setEstado('ya_aprobado');
        else if (d.estado === 'rechazado') setEstado('ya_rechazado');
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
    } catch (e) { setErrMsg(String(e)); setEstado('error'); }
  }

  async function rechazar() {
    if (!token || !motivoSel) return;
    setEstado('rechazando');
    try {
      const r = await fetch(`/api/pub/presupuesto/${token}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoSel, comentario: comentario.trim() || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Error');
      setEstado('rechazado');
    } catch (e) { setErrMsg(String(e)); setEstado('error'); }
  }

  const waLink = (tel: string | null) =>
    tel ? `https://wa.me/${tel.replace(/\D/g, '')}` : null;

  // ── Pantallas de estado ───────────────────────────────────────────────────

  if (estado === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Loader2 size={28} className="animate-spin text-gray-400" />
    </div>
  );

  if (estado === 'not_found') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <AlertTriangle size={36} className="mx-auto mb-4 text-red-400" />
        <h2 className="text-lg font-bold text-gray-800 mb-2">Link inválido</h2>
        <p className="text-sm text-gray-500">{errMsg || 'Este presupuesto no existe o el link es incorrecto.'}</p>
      </div>
    </div>
  );

  if (estado === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <AlertTriangle size={36} className="mx-auto mb-4 text-red-400" />
        <p className="text-sm text-gray-600">{errMsg}</p>
        <button onClick={() => setEstado('data')} className="mt-4 text-sm text-blue-600 underline">Volver</button>
      </div>
    </div>
  );

  if (estado === 'aprobado') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-sm w-full text-center">
        <div className="px-6 py-8 flex flex-col items-center" style={{ background: NAVY }}>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
            <CheckCircle2 size={36} className="text-white" />
          </div>
          <h2 className="text-white font-bold text-xl">¡Gracias por elegirnos!</h2>
          <p className="text-blue-200 text-sm mt-1">{pres?.numero} confirmada</p>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 leading-relaxed">
            ¡Excelente decisión! Recibimos tu confirmación y ya estamos trabajando en tu pedido.
            Nos pondremos en contacto a la brevedad para coordinar los próximos pasos y asegurarnos de que todo salga perfecto.
          </p>
          {waLink(pres?.empresa?.telefono ?? null) && (
            <a href={waLink(pres!.empresa.telefono)!} target="_blank" rel="noopener noreferrer"
              className="mt-5 flex items-center justify-center gap-2 w-full py-3 text-white rounded-xl text-sm font-semibold"
              style={{ background: '#25D366' }}>
              <WaIcon /> Contactar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );

  if (estado === 'ya_aprobado') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <CheckCircle2 size={36} className="mx-auto mb-4 text-emerald-500" />
        <h2 className="text-lg font-bold text-gray-800 mb-2">Proforma ya confirmada</h2>
        <p className="text-sm text-gray-500">
          La proforma <strong>{pres?.numero}</strong> ya fue confirmada. Si tenés dudas, comunicate directamente con nosotros.
        </p>
      </div>
    </div>
  );

  if (estado === 'ya_rechazado') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <AlertTriangle size={36} className="mx-auto mb-4 text-amber-400" />
        <h2 className="text-lg font-bold text-gray-800 mb-2">Proforma no aceptada</h2>
        <p className="text-sm text-gray-500 mb-4">
          Registramos que no aceptaste esta proforma. Si cambiaste de opinión, comunicate con nosotros.
        </p>
        {waLink(pres?.empresa?.telefono ?? null) && (
          <a href={waLink(pres!.empresa.telefono)!} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 text-white rounded-xl text-sm font-semibold"
            style={{ background: '#25D366' }}>
            <WaIcon /> Consultanos por WhatsApp
          </a>
        )}
      </div>
    </div>
  );

  if (estado === 'rechazado') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-sm w-full text-center">
        <div className="bg-slate-700 px-6 py-7 flex flex-col items-center">
          <div className="text-4xl mb-2">🙏</div>
          <h2 className="text-white font-bold text-xl">Gracias por avisarnos</h2>
          <p className="text-slate-300 text-sm mt-1">Registramos tu respuesta</p>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 leading-relaxed">
            Lamentamos no haber podido ayudarte esta vez. Tu opinión es muy valiosa para nosotros y nos ayuda a mejorar.
            ¡Esperamos poder atenderte en un futuro proyecto!
          </p>
          {waLink(pres?.empresa?.telefono ?? null) && (
            <a href={waLink(pres!.empresa.telefono)!} target="_blank" rel="noopener noreferrer"
              className="mt-5 flex items-center justify-center gap-2 w-full py-3 text-white rounded-xl text-sm font-semibold"
              style={{ background: '#25D366' }}>
              <WaIcon /> Consultanos por otra opción
            </a>
          )}
        </div>
      </div>
    </div>
  );

  // ── Pantalla de encuesta ──────────────────────────────────────────────────
  if (estado === 'encuesta' || estado === 'rechazando') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: `${RED}18` }}>
            <X size={22} style={{ color: RED }} />
          </div>
          <h2 className="text-lg font-bold text-gray-800">¿Por qué no aceptás la proforma?</h2>
          <p className="text-sm text-gray-400 mt-1">Tu opinión nos ayuda a mejorar</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {MOTIVOS.map(m => (
            <button key={m} onClick={() => setMotivoSel(m)}
              className={`text-left px-3 py-3 rounded-xl border text-xs font-medium transition-all leading-snug ${
                motivoSel === m
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}>
              {motivoSel === m && <span className="mr-1">✓</span>}
              {m}
            </button>
          ))}
        </div>

        <textarea
          value={comentario}
          onChange={e => setComentario(e.target.value)}
          placeholder="Comentario adicional (opcional)"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-red-200 mb-4"
        />

        <button onClick={rechazar} disabled={!motivoSel || estado === 'rechazando'}
          className="w-full py-3 rounded-xl text-white text-sm font-bold mb-2 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
          style={{ background: RED }}>
          {estado === 'rechazando' ? <Loader2 size={15} className="animate-spin" /> : null}
          {estado === 'rechazando' ? 'Enviando...' : 'Enviar respuesta'}
        </button>

        <button onClick={() => { setMotivoSel(null); setComentario(''); setEstado('data'); }}
          className="w-full py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors">
          ← Volver al presupuesto
        </button>
      </div>
    </div>
  );

  if (!pres) return null;

  // ── Vista principal ────────────────────────────────────────────────────────
  const costoEnvio    = pres.forma_envio === 'envio_empresa' ? Number(pres.costo_envio ?? 0) : 0;
  const total         = Number(pres.precio_total);
  const esCuotas      = pres.forma_pago === 'Tarjeta de crédito 3 cuotas sin interés';
  const vencido       = pres.fecha_validez
    ? new Date(pres.fecha_validez.slice(0, 10) + 'T23:59:59') < new Date()
    : false;
  const clienteNom    = nombreCliente(pres.cliente);
  const proformaNum   = pres.numero.replace(/^OP-/, 'PRO-');
  const fechaEmision  = fmtFecha(pres.created_at ?? new Date().toISOString());

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-2 sm:py-8 sm:px-4">
      <div className="max-w-[740px] mx-auto">

        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div className="rounded-t-2xl overflow-hidden">
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-5"
            style={{ background: NAVY }}>

            {/* Empresa */}
            <div>
              <img src="/logochico.png" alt="Logo" style={{ height: 36, marginBottom: 12, opacity: 0.9 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {pres.empresa.cuit && (
                <div className="text-blue-200 text-xs mb-0.5">
                  <span className="font-semibold">CUIT:</span> {pres.empresa.cuit}
                </div>
              )}
              {pres.empresa.telefono && (
                <div className="flex items-center gap-1 text-blue-200 text-xs mb-0.5">
                  <Phone size={10} /> {pres.empresa.telefono}
                </div>
              )}
              {pres.empresa.email && (
                <div className="flex items-center gap-1 text-blue-200 text-xs mb-0.5">
                  <Mail size={10} /> {pres.empresa.email}
                </div>
              )}
              {pres.empresa.direccion && (
                <div className="flex items-center gap-1 text-blue-200 text-xs mb-0.5">
                  <MapPin size={10} /> {pres.empresa.direccion}
                </div>
              )}
              {pres.empresa.instagram && (
                <div className="text-blue-200 text-xs">Instagram: {pres.empresa.instagram}</div>
              )}
            </div>

            {/* PROFORMA + detalles */}
            <div className="text-right shrink-0">
              <div className="text-2xl sm:text-3xl font-black tracking-widest leading-none mb-1"
                style={{ color: RED }}>PROFORMA</div>
              <div className="text-white font-bold text-sm">N°: {proformaNum}</div>
              <div className="text-blue-200 text-xs mt-2">📅 Fecha: {fechaEmision}</div>
              {pres.fecha_validez && (
                <div className={`text-xs mt-0.5 font-semibold ${vencido ? 'text-red-300' : 'text-amber-300'}`}>
                  ⏱ Válido hasta: {fmtFecha(pres.fecha_validez)}
                </div>
              )}
              {pres.tiempo_entrega && (
                <div className="text-blue-200 text-xs mt-0.5">
                  🚚 Entrega: {pres.tiempo_entrega} días hábiles
                </div>
              )}
            </div>
          </div>
          <div style={{ height: 3, background: RED }} />
        </div>

        {/* ── CLIENTE + GRACIAS ─────────────────────────────────────────── */}
        <div className="bg-white grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-base">👤</div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente</span>
            </div>
            <div className="text-base font-bold" style={{ color: NAVY }}>{clienteNom}</div>
            {(pres.cliente.documento_nro || pres.cliente.telefono) && (
              <div className="text-xs text-gray-500 mt-0.5">
                {pres.cliente.documento_nro &&
                  `${pres.cliente.tipo_persona === 'juridica' ? 'CUIT' : 'DNI'}: ${pres.cliente.documento_nro}`}
                {pres.cliente.documento_nro && pres.cliente.telefono && ' | '}
                {pres.cliente.telefono && `Tel: ${pres.cliente.telefono}`}
              </div>
            )}
            {pres.cliente.email && (
              <div className="text-xs text-gray-500">{pres.cliente.email}</div>
            )}
            {(pres.cliente.direccion || pres.cliente.localidad) && (
              <div className="text-xs text-gray-500 mt-0.5">
                {[pres.cliente.direccion, pres.cliente.localidad].filter(Boolean).join(' | ')}
              </div>
            )}
          </div>
          <div className="p-4 bg-blue-50/40 flex items-center gap-3">
            <div className="text-3xl shrink-0">🤝</div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Gracias por elegirnos
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Nos comprometemos a brindarte la mejor calidad, atención y asesoramiento en cada proyecto.
              </p>
            </div>
          </div>
        </div>

        {/* Aviso vencimiento */}
        {pres.fecha_validez && (
          <div className={`px-4 py-2.5 flex items-center gap-2 text-xs font-medium ${
            vencido
              ? 'bg-red-50 text-red-600 border-b border-red-100'
              : 'bg-amber-50 text-amber-700 border-b border-amber-100'
          }`}>
            <Clock size={13} />
            {vencido
              ? `Este presupuesto venció el ${fmtFecha(pres.fecha_validez)}`
              : `Precio válido hasta el ${fmtFecha(pres.fecha_validez)}`}
          </div>
        )}

        {/* ── ITEMS ─────────────────────────────────────────────────────── */}
        <div className="bg-white mt-px">
          {/* Encabezado tabla */}
          <div className="grid text-xs font-bold text-white uppercase tracking-wider px-4 py-2.5"
            style={{
              background: NAVY,
              gridTemplateColumns: '28px 56px 1fr 52px 88px 88px',
            }}>
            <span>Ítem</span>
            <span></span>
            <span>Producto</span>
            <span className="text-center">Cant.</span>
            <span className="text-right">Precio unit.</span>
            <span className="text-right">Subtotal</span>
          </div>

          {pres.items.map((item, i) => {
            const specs = [
              item.tipo_abertura_nombre ? `Tipo: ${item.tipo_abertura_nombre}` : null,
              item.sistema_nombre       ? `Línea: ${item.sistema_nombre}` : null,
              item.color                ? `Color: ${item.color}` : null,
              (item.medida_ancho || item.medida_alto)
                ? `${item.medida_ancho ?? '?'} × ${item.medida_alto ?? '?'} m`
                : null,
            ].filter(Boolean).join(' · ');

            const pUnit = Number(item.precio_unitario) +
              (item.incluye_instalacion ? Number(item.precio_instalacion) : 0);

            return (
              <div key={i}
                className="grid items-center px-4 py-3 text-sm"
                style={{
                  gridTemplateColumns: '28px 56px 1fr 52px 88px 88px',
                  borderBottom: i < pres.items.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                <span className="text-gray-300 font-bold text-xs">{i + 1}</span>
                <div className="pr-2">
                  {item.producto_imagen_url ? (
                    <img
                      src={item.producto_imagen_url}
                      alt=""
                      className="w-11 h-11 object-cover rounded-md border border-gray-200"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-11 h-11 bg-gray-100 rounded-md flex items-center justify-center text-xl">🪟</div>
                  )}
                </div>
                <div className="pr-2">
                  <div className="font-semibold text-gray-900 text-sm leading-snug">{item.descripcion}</div>
                  {specs && <div className="text-xs text-gray-400 mt-0.5">{specs}</div>}
                  {item.incluye_instalacion && (
                    <span className="text-xs text-emerald-600 font-medium">✓ Incluye instalación</span>
                  )}
                </div>
                <span className="text-center text-gray-700 text-xs font-medium">{item.cantidad}</span>
                <span className="text-right text-gray-500 text-xs">{fmtM(pUnit)}</span>
                <span className="text-right font-bold text-gray-900 text-xs">{fmtM(Number(item.precio_total))}</span>
              </div>
            );
          })}
        </div>

        {/* ── TOTAL ─────────────────────────────────────────────────────── */}
        <div className="px-5 py-4" style={{ background: NAVY }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Total final</div>
              <div className="text-white text-3xl font-black tabular-nums">{fmtM(total)}</div>
              {costoEnvio > 0 && (
                <div className="text-blue-300 text-xs mt-0.5">
                  (productos {fmtM(total - costoEnvio)} + envío {fmtM(costoEnvio)})
                </div>
              )}
              <div className="text-blue-200/80 text-xs mt-1 italic">Son: {numToWords(total)}</div>
              {esCuotas && (
                <span className="inline-block mt-1.5 bg-violet-500/20 text-violet-200 text-xs px-2.5 py-1 rounded-lg font-semibold">
                  3 cuotas de {fmtM(total / 3)}
                </span>
              )}
            </div>
            {pres.forma_pago && (
              <div className="text-right shrink-0">
                <div className="text-white/40 text-xs uppercase tracking-wider">Forma de pago</div>
                <div className="text-white font-bold text-sm mt-0.5">{pres.forma_pago}</div>
              </div>
            )}
          </div>
        </div>

        {/* Notas */}
        {pres.notas && (
          <div className="bg-amber-50 border-l-4 border-amber-300 px-4 py-3 text-sm text-amber-800 mt-px">
            {pres.notas}
          </div>
        )}

        {/* ── CONDICIONES ───────────────────────────────────────────────── */}
        <div className="bg-white mt-px grid grid-cols-3 divide-x divide-gray-100">
          {[
            { Icon: Package, color: 'text-green-600', bg: 'bg-green-100', title: 'En stock',             desc: 'Productos listos para entrega' },
            { Icon: Truck,   color: 'text-blue-600',  bg: 'bg-blue-100',  title: 'Entrega rápida',        desc: 'De 2 a 5 días hábiles' },
            { Icon: Shield,  color: 'text-amber-600', bg: 'bg-amber-100', title: 'Calidad garantizada',   desc: '12 meses en todos los productos' },
          ].map(({ Icon, color, bg, title, desc }) => (
            <div key={title} className="p-3 text-center">
              <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center mx-auto mb-1.5`}>
                <Icon size={14} className={color} />
              </div>
              <div className="text-xs font-bold text-gray-800 uppercase tracking-wide leading-tight">{title}</div>
              <div className="text-xs text-gray-400 mt-0.5 leading-tight">{desc}</div>
            </div>
          ))}
        </div>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <div className="bg-white mt-px px-5 py-6 rounded-b-2xl">
          <h3 className="text-sm font-black text-gray-800 mb-0.5 uppercase tracking-wide">
            ¿Querés avanzar con tu pedido?
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Aceptá la proforma y confirmá que leíste y aceptás los términos y condiciones de venta.
          </p>

          {vencido ? (
            <div className="rounded-xl px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 text-center font-medium">
              Esta proforma venció. Solicitá una nueva cotización.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Acepto */}
              <button onClick={aprobar} disabled={estado === 'aprobando'}
                className="flex-1 py-4 rounded-xl text-white font-bold text-sm flex flex-col items-center justify-center gap-0.5 disabled:opacity-60 transition-all"
                style={{ background: GREEN, boxShadow: '0 4px 14px rgba(22,163,74,0.30)' }}>
                <span className="flex items-center gap-1.5">
                  {estado === 'aprobando'
                    ? <Loader2 size={15} className="animate-spin" />
                    : <CheckCircle2 size={15} />}
                  {estado === 'aprobando' ? 'Procesando...' : 'ACEPTO LA PROFORMA'}
                </span>
                <span className="text-green-200 text-xs font-normal">
                  Leí y acepto los términos y condiciones
                </span>
              </button>

              {/* No acepto */}
              <button onClick={() => setEstado('encuesta')}
                className="flex-1 py-4 rounded-xl text-white font-bold text-sm flex flex-col items-center justify-center gap-0.5 transition-all"
                style={{ background: RED, boxShadow: '0 4px 14px rgba(227,30,36,0.25)' }}>
                <span className="flex items-center gap-1.5">
                  <X size={15} /> NO ACEPTO LA PROFORMA
                </span>
                <span className="text-red-200 text-xs font-normal">
                  Quiero modificar / No estoy conforme
                </span>
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-3">
            Si tenés consultas, comunicate con nosotros antes de decidir.
          </p>
        </div>

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <div className="mt-4 pb-8 flex items-center justify-center flex-wrap gap-x-4 gap-y-1">
          {pres.empresa.telefono && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Phone size={10} /> {pres.empresa.telefono}
            </span>
          )}
          {pres.empresa.email && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Mail size={10} /> {pres.empresa.email}
            </span>
          )}
          {pres.empresa.direccion && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin size={10} /> {pres.empresa.direccion}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
