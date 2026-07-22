import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2, AlertTriangle, Clock, Loader2,
  Phone, Mail, MapPin, Package, Truck, Shield, X, ScrollText,
  MessageCircle, Pencil, ChevronRight, ArrowLeft, CalendarClock,
} from 'lucide-react';

const NAVY  = '#031d49';
const RED   = '#e31e24';
const GREEN = '#16a34a';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Empresa {
  nombre: string; cuit: string | null; telefono: string | null;
  email: string | null; direccion: string | null; logo_url: string | null;
  instagram: string | null; terminos_url: string | null;
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
  | 'menu'
  | 'form_mas_tiempo' | 'form_consulta' | 'form_llamada' | 'form_modificar'
  | 'respondiendo' | 'respondido'
  | 'encuesta' | 'rechazando' | 'rechazado' | 'ya_rechazado'
  | 'aprobando' | 'aprobado' | 'ya_aprobado';

// Motivos de "No voy a avanzar" (rechazo definitivo)
const MOTIVOS = [
  'El precio no me cierra',
  'Ya compré en otro lugar',
  'Cancelé la obra',
  'No era lo que buscaba',
  'Otro motivo',
];

// Motivos de "Necesito más tiempo" — definen la fecha de seguimiento sugerida
const MOTIVOS_TIEMPO = [
  'Estoy comparando presupuestos',
  'Necesito consultarlo',
  'Espero cobrar',
  'La obra todavía no comenzó',
  'Todavía no lo decidí',
  'Quiero retomarlo más adelante',
];

// Opciones de "Quiero modificar la propuesta"
const CAMBIOS = [
  'Cambiar medidas', 'Cambiar color', 'Cambiar vidrio', 'Cambiar sistema',
  'Cambiar cantidad', 'Una opción más económica', 'Agregar productos', 'Quitar productos',
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

// ── Wrapper de pantalla de formulario de intención ────────────────────────────
function FormWrap({ Icon, color, titulo, sub, onBack, children }: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string; titulo: string; sub: string;
  onBack: () => void; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: `${color}18`, color }}>
            <Icon size={22} />
          </div>
          <h2 className="text-lg font-bold text-gray-800">{titulo}</h2>
          <p className="text-sm text-gray-400 mt-1">{sub}</p>
        </div>
        {children}
        <button onClick={onBack}
          className="w-full mt-2 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
          <ArrowLeft size={14} /> Volver
        </button>
      </div>
    </div>
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
  const [showTerminos, setShowTerminos] = useState(false);
  // Estado de las respuestas intermedias
  const [cambiosSel, setCambiosSel]   = useState<string[]>([]);
  const [llamadaFecha, setLlamadaFecha]     = useState('');
  const [llamadaHorario, setLlamadaHorario] = useState('');
  const [respTipo, setRespTipo] = useState<'mas_tiempo' | 'consulta' | 'llamada' | 'modificar' | null>(null);

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

  async function responder(tipo: 'mas_tiempo' | 'consulta' | 'llamada' | 'modificar') {
    if (!token) return;
    setRespTipo(tipo);
    setEstado('respondiendo');
    try {
      const r = await fetch(`/api/pub/presupuesto/${token}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          motivo:          tipo === 'mas_tiempo' ? motivoSel : null,
          comentario:      comentario.trim() || null,
          cambios:         tipo === 'modificar' ? cambiosSel : [],
          llamada_fecha:   tipo === 'llamada' ? (llamadaFecha || null) : null,
          llamada_horario: tipo === 'llamada' ? (llamadaHorario.trim() || null) : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Error');
      setEstado('respondido');
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

  // ── Confirmación de respuesta intermedia ─────────────────────────────────
  if (estado === 'respondido') {
    const msg = respTipo === 'llamada'
      ? 'Recibimos tu pedido de contacto. Te contactamos en el horario que indicaste.'
      : respTipo === 'consulta'
        ? 'Recibimos tu consulta. Un asesor te responde a la brevedad.'
        : respTipo === 'modificar'
          ? 'Recibimos tu pedido de cambios. Preparamos una propuesta ajustada y te la reenviamos.'
          : 'Recibimos tu respuesta. Nos ponemos en contacto para acompañarte en tu decisión.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-sm w-full text-center">
          <div className="px-6 py-8 flex flex-col items-center" style={{ background: NAVY }}>
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
              <CheckCircle2 size={36} className="text-white" />
            </div>
            <h2 className="text-white font-bold text-xl">¡Gracias por tu respuesta!</h2>
            <p className="text-blue-200 text-sm mt-1">{pres?.numero}</p>
          </div>
          <div className="px-6 py-6">
            <p className="text-sm text-gray-600 leading-relaxed">{msg}</p>
            {waLink(pres?.empresa?.telefono ?? null) && (
              <a href={waLink(pres!.empresa.telefono)!} target="_blank" rel="noopener noreferrer"
                className="mt-5 flex items-center justify-center gap-2 w-full py-3 text-white rounded-xl text-sm font-semibold"
                style={{ background: '#25D366' }}>
                <WaIcon /> Escribinos por WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Menú de intención (2do nivel del CTA) ─────────────────────────────────
  if (estado === 'menu') {
    const opciones = [
      { key: 'form_mas_tiempo', Icon: Clock,        color: '#0284c7', titulo: 'Necesito más tiempo',       sub: 'Todavía lo estoy pensando' },
      { key: 'form_modificar',  Icon: Pencil,       color: '#7c3aed', titulo: 'Quiero modificar la propuesta', sub: 'Cambiar medidas, color, cantidad…' },
      { key: 'form_consulta',   Icon: MessageCircle,color: '#0891b2', titulo: 'Tengo una consulta',        sub: 'Escribinos tu duda' },
      { key: 'form_llamada',    Icon: Phone,        color: '#16a34a', titulo: 'Quiero que me contacten',   sub: 'Elegí día y horario' },
      { key: 'encuesta',        Icon: X,            color: '#e31e24', titulo: 'No voy a avanzar',          sub: 'Prefiero no continuar' },
    ] as const;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-gray-800">¿Cómo querés continuar?</h2>
            <p className="text-sm text-gray-400 mt-1">Elegí la opción que mejor te represente</p>
          </div>
          <div className="space-y-2.5">
            {opciones.map(({ key, Icon, color, titulo, sub }) => (
              <button key={key} onClick={() => { setMotivoSel(null); setComentario(''); setEstado(key as Estado); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${color}18`, color }}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{titulo}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
          <button onClick={() => setEstado('data')}
            className="w-full mt-4 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
            <ArrowLeft size={14} /> Volver al presupuesto
          </button>
        </div>
      </div>
    );
  }

  // ── Form: Necesito más tiempo ─────────────────────────────────────────────
  if (estado === 'form_mas_tiempo' || (estado === 'respondiendo' && respTipo === 'mas_tiempo')) {
    const enviando = estado === 'respondiendo';
    return (
      <FormWrap Icon={Clock} color="#0284c7" titulo="Necesito más tiempo"
        sub="¿Qué te está frenando? Nos ayuda a acompañarte mejor" onBack={() => setEstado('menu')}>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {MOTIVOS_TIEMPO.map(m => (
            <button key={m} onClick={() => setMotivoSel(m)}
              className={`text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                motivoSel === m ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}>
              {motivoSel === m && <span className="mr-1">✓</span>}{m}
            </button>
          ))}
        </div>
        <textarea value={comentario} onChange={e => setComentario(e.target.value)}
          placeholder="Comentario (opcional)" rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-sky-200 mb-4" />
        <button onClick={() => responder('mas_tiempo')} disabled={!motivoSel || enviando}
          className="w-full py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: '#0284c7' }}>
          {enviando ? <Loader2 size={15} className="animate-spin" /> : null}{enviando ? 'Enviando...' : 'Enviar respuesta'}
        </button>
      </FormWrap>
    );
  }

  // ── Form: Tengo una consulta ──────────────────────────────────────────────
  if (estado === 'form_consulta' || (estado === 'respondiendo' && respTipo === 'consulta')) {
    const enviando = estado === 'respondiendo';
    return (
      <FormWrap Icon={MessageCircle} color="#0891b2" titulo="Tengo una consulta"
        sub="Escribinos tu duda y te respondemos a la brevedad" onBack={() => setEstado('menu')}>
        <textarea value={comentario} onChange={e => setComentario(e.target.value)}
          placeholder="Escribí tu consulta…" rows={4} autoFocus
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-200 mb-4" />
        <button onClick={() => responder('consulta')} disabled={!comentario.trim() || enviando}
          className="w-full py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: '#0891b2' }}>
          {enviando ? <Loader2 size={15} className="animate-spin" /> : null}{enviando ? 'Enviando...' : 'Enviar consulta'}
        </button>
      </FormWrap>
    );
  }

  // ── Form: Quiero que me llamen ────────────────────────────────────────────
  if (estado === 'form_llamada' || (estado === 'respondiendo' && respTipo === 'llamada')) {
    const enviando = estado === 'respondiendo';
    return (
      <FormWrap Icon={Phone} color="#16a34a" titulo="Quiero que me contacten"
        sub="Elegí cuándo te viene bien y te contactamos" onBack={() => setEstado('menu')}>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Día preferido</label>
        <input type="date" value={llamadaFecha} onChange={e => setLlamadaFecha(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-200 mb-3" />
        <label className="block text-xs font-semibold text-gray-500 mb-1">Franja horaria</label>
        <select value={llamadaHorario} onChange={e => setLlamadaHorario(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-200 mb-3">
          <option value="">Cualquier horario</option>
          <option value="Mañana (9 a 12 hs)">Mañana (9 a 12 hs)</option>
          <option value="Mediodía (12 a 15 hs)">Mediodía (12 a 15 hs)</option>
          <option value="Tarde (15 a 19 hs)">Tarde (15 a 19 hs)</option>
        </select>
        <textarea value={comentario} onChange={e => setComentario(e.target.value)}
          placeholder="Comentario (opcional)" rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-200 mb-4" />
        <button onClick={() => responder('llamada')} disabled={enviando}
          className="w-full py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: '#16a34a' }}>
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />}{enviando ? 'Enviando...' : 'Pedir llamado'}
        </button>
      </FormWrap>
    );
  }

  // ── Form: Quiero modificar la propuesta ───────────────────────────────────
  if (estado === 'form_modificar' || (estado === 'respondiendo' && respTipo === 'modificar')) {
    const enviando = estado === 'respondiendo';
    const toggleCambio = (c: string) =>
      setCambiosSel(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    return (
      <FormWrap Icon={Pencil} color="#7c3aed" titulo="Quiero modificar la propuesta"
        sub="Marcá qué querés cambiar y te reenviamos una nueva versión" onBack={() => setEstado('menu')}>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {CAMBIOS.map(c => (
            <button key={c} onClick={() => toggleCambio(c)}
              className={`text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-all leading-snug ${
                cambiosSel.includes(c) ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}>
              {cambiosSel.includes(c) && <span className="mr-1">✓</span>}{c}
            </button>
          ))}
        </div>
        <textarea value={comentario} onChange={e => setComentario(e.target.value)}
          placeholder="Contanos qué necesitás cambiar…" rows={3}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 mb-4" />
        <button onClick={() => responder('modificar')} disabled={(cambiosSel.length === 0 && !comentario.trim()) || enviando}
          className="w-full py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: '#7c3aed' }}>
          {enviando ? <Loader2 size={15} className="animate-spin" /> : null}{enviando ? 'Enviando...' : 'Pedir cambios'}
        </button>
      </FormWrap>
    );
  }

  // ── Pantalla de encuesta (No voy a avanzar) ───────────────────────────────
  if (estado === 'encuesta' || estado === 'rechazando') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: `${RED}18` }}>
            <X size={22} style={{ color: RED }} />
          </div>
          <h2 className="text-lg font-bold text-gray-800">¿Por qué no vas a avanzar?</h2>
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

        <button onClick={() => { setMotivoSel(null); setComentario(''); setEstado('menu'); }}
          className="w-full py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
          <ArrowLeft size={14} /> Volver
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
    <>
    <div className="min-h-screen bg-gray-100 py-4 px-2 sm:py-8 sm:px-4">
      <div className="max-w-[740px] mx-auto">

        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div className="rounded-t-2xl overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 px-4 sm:px-5 pt-5 pb-5 bg-white">

            {/* Empresa */}
            <div style={{ flex: 1 }}>
              {/* Logo centrado — mismo que PDF */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <img src="/logo2.png" alt="Logo" style={{ height: 64, display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <div style={{ height: 1, background: '#e5e7eb', marginBottom: 6 }} />
              {/* Contacto en línea horizontal */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px 6px', fontSize: 11, color: '#555' }}>
                {pres.empresa.cuit && (
                  <span>🪪 CUIT: {pres.empresa.cuit}</span>
                )}
                {pres.empresa.telefono && (
                  <span>📞 {pres.empresa.telefono}</span>
                )}
                {pres.empresa.email && <span>✉️ {pres.empresa.email}</span>}
              </div>
              {pres.empresa.direccion && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                  📍 {pres.empresa.direccion}
                </div>
              )}
              {pres.empresa.instagram && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>📷 {pres.empresa.instagram}</div>
              )}
            </div>

            {/* PROFORMA + detalles */}
            <div className="sm:text-right w-full sm:w-auto">
              <div className="font-black tracking-widest leading-none mb-1"
                style={{ color: RED, fontFamily: 'Georgia, serif', fontSize: 28 }}>PROFORMA</div>
              <div className="font-bold text-sm" style={{ color: NAVY, fontFamily: 'Georgia, serif' }}>N°: {proformaNum}</div>
              <div className="text-xs mt-2 text-gray-500">📅 Fecha: {fechaEmision}</div>
              {pres.fecha_validez && (
                <div className={`text-xs mt-0.5 font-semibold ${vencido ? 'text-red-500' : 'text-amber-600'}`}>
                  ⏱ Válido hasta: {fmtFecha(pres.fecha_validez)}
                </div>
              )}
              {pres.tiempo_entrega && (
                <div className="text-xs mt-0.5 text-gray-500">
                  🚚 Entrega: {pres.tiempo_entrega} días hábiles
                </div>
              )}
            </div>
          </div>
          {/* Separador doble navy — igual que PDF */}
          <div style={{ height: 4, background: NAVY }} />
          <div style={{ height: 1, background: '#3a5fad' }} />
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
          {/* Encabezado tabla — solo visible en sm+ */}
          <div className="hidden sm:grid text-xs font-bold uppercase tracking-wider px-4 py-2.5 border-b-2"
            style={{
              color: NAVY,
              borderColor: NAVY,
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
              item.tipo_abertura_nombre ? `${item.tipo_abertura_nombre}` : null,
              item.sistema_nombre       ? item.sistema_nombre : null,
              item.color                ? item.color : null,
              (item.medida_ancho || item.medida_alto)
                ? `${item.medida_ancho ?? '?'} × ${item.medida_alto ?? '?'} m`
                : null,
            ].filter(Boolean).join(' · ');

            const pUnit = Number(item.precio_unitario) +
              (item.incluye_instalacion ? Number(item.precio_instalacion) : 0);

            const thumbnail = item.producto_imagen_url ? (
              <img src={item.producto_imagen_url} alt=""
                className="w-11 h-11 object-cover rounded-md border border-gray-200"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-11 h-11 bg-gray-100 rounded-md flex items-center justify-center text-xl">🪟</div>
            );

            return (
              <div key={i} style={{ borderBottom: i < pres.items.length - 1 ? '1px solid #f3f4f6' : 'none' }}>

                {/* Mobile card (xs) */}
                <div className="sm:hidden px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="text-gray-300 font-bold text-xs w-4 shrink-0 mt-1">{i + 1}</span>
                    <div className="shrink-0">{thumbnail}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm leading-snug">{item.descripcion}</div>
                      {specs && <div className="text-xs text-gray-400 mt-0.5">{specs}</div>}
                      {item.incluye_instalacion && (
                        <span className="text-xs text-emerald-600 font-medium">✓ Incluye instalación</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 ml-7 pl-3"
                    style={{ borderTop: '1px solid #f9fafb' }}>
                    <span className="text-xs text-gray-500">Cantidad: <strong className="text-gray-700">{item.cantidad}</strong></span>
                    <span className="font-bold text-gray-900 text-sm">{fmtM(Number(item.precio_total))}</span>
                  </div>
                </div>

                {/* Desktop row (sm+) */}
                <div className="hidden sm:grid items-center px-4 py-3 text-sm"
                  style={{ gridTemplateColumns: '28px 56px 1fr 52px 88px 88px' }}>
                  <span className="text-gray-300 font-bold text-xs">{i + 1}</span>
                  <div className="pr-2">{thumbnail}</div>
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
              </div>
            );
          })}
        </div>

        {/* ── TOTAL ─────────────────────────────────────────────────────── */}
        <div className="bg-white px-4 py-4 mt-px">
          <div className="rounded-xl border-2 p-4 flex flex-col sm:flex-row items-start sm:justify-between gap-3" style={{ borderColor: NAVY }}>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#9ca3af', letterSpacing: 2 }}>Total Final</div>
              <div className="text-3xl font-black tabular-nums" style={{ color: NAVY }}>{fmtM(total)}</div>
              {costoEnvio > 0 && (
                <div className="text-gray-500 text-xs mt-0.5">
                  (productos {fmtM(total - costoEnvio)} + envío {fmtM(costoEnvio)})
                </div>
              )}
              <div className="text-gray-400 text-xs mt-1 italic">Son: {numToWords(total)}</div>
              {esCuotas && (
                <span className="inline-block mt-1.5 bg-violet-100 text-violet-700 text-xs px-2.5 py-1 rounded-lg font-semibold">
                  3 cuotas de {fmtM(total / 3)}
                </span>
              )}
            </div>
            {pres.forma_pago && (
              <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-gray-100 pt-2 sm:pt-0 sm:pl-4 w-full sm:w-auto">
                <div className="text-xs uppercase tracking-wider text-gray-400">Forma de pago</div>
                <div className="font-bold text-sm mt-0.5 break-words" style={{ color: NAVY }}>{pres.forma_pago}</div>
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
        <div className="bg-white mt-px">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 border border-gray-200 rounded-xl mx-4 my-3 overflow-hidden">
            {/* Col 1: Condiciones importantes */}
            <div className="p-4">
              <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: NAVY }}>
                Condiciones importantes
              </div>
              {[
                pres.fecha_validez
                  ? `Precio válido hasta ${fmtFecha(pres.fecha_validez)}`
                  : 'Consultar vigencia del precio',
                'Productos sujetos a disponibilidad de stock',
                'Las medidas deben ser verificadas antes de confirmar',
                'La garantía aplica según condiciones comerciales',
                'Los reclamos deben informarse dentro de las 48 hs de recibido el producto',
              ].map((cond, i) => (
                <div key={i} className="flex gap-2 mb-2 text-xs text-gray-600 leading-snug">
                  <span className="text-green-500 font-bold shrink-0">✓</span>
                  <span>{cond}</span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setShowTerminos(true)}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold underline"
                style={{ color: NAVY }}
              >
                <ScrollText size={12} />
                Ver términos y condiciones completos
              </button>
            </div>
            {/* Col 2: Tu compra protegida */}
            <div className="p-4 bg-gray-50 text-center">
              <div className="text-2xl mb-2">🛡️</div>
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: NAVY }}>
                Tu compra está protegida
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Trabajamos con materiales de calidad y garantía de fabricación en todos nuestros productos.
              </p>
            </div>
            {/* Col 3: Badges */}
            <div className="p-4 flex flex-col justify-center gap-3">
              {[
                { Icon: Package, color: 'text-green-600', bg: 'bg-green-100', title: 'EN STOCK',           desc: 'Productos listos para entrega' },
                { Icon: Truck,   color: 'text-blue-600',  bg: 'bg-blue-100',  title: 'ENTREGA RÁPIDA',     desc: 'De 2 a 5 días hábiles' },
                { Icon: Shield,  color: 'text-amber-600', bg: 'bg-amber-100', title: 'CALIDAD GARANTIZADA', desc: '12 meses en todos los productos' },
              ].map(({ Icon, color, bg, title, desc }) => (
                <div key={title} className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon size={13} className={color} />
                  </div>
                  <div>
                    <div className="text-xs font-bold" style={{ color: NAVY }}>{title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
            <div className="flex flex-col gap-3">
              {/* Nivel 1 — CTA principal, baja fricción al sí */}
              <button onClick={aprobar} disabled={estado === 'aprobando'}
                className="w-full py-4 rounded-xl text-white font-bold text-base flex flex-col items-center justify-center gap-0.5 disabled:opacity-60 transition-all"
                style={{ background: GREEN, boxShadow: '0 6px 18px rgba(22,163,74,0.32)' }}>
                <span className="flex items-center gap-2">
                  {estado === 'aprobando'
                    ? <Loader2 size={17} className="animate-spin" />
                    : <CheckCircle2 size={17} />}
                  {estado === 'aprobando' ? 'Procesando...' : 'QUIERO AVANZAR'}
                </span>
                <span className="text-green-200 text-xs font-normal">
                  Acepto la proforma y los términos y condiciones
                </span>
              </button>

              {/* Nivel 2 — respuesta matizada, secundario pero visible */}
              <button onClick={() => setEstado('menu')}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 border-amber-400 bg-amber-50 text-amber-800 hover:border-amber-500 hover:bg-amber-100 transition-all">
                Todavía no / Tengo otra respuesta
                <ChevronRight size={16} className="text-amber-500" />
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-3">
            ¿Dudas? Elegí "Tengo otra respuesta" y contanos cómo seguir.
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

    {/* ── Modal Términos y Condiciones ───────────────────────────────── */}
    {showTerminos && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={() => setShowTerminos(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#031d49' }}>
              <ScrollText size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">Términos y Condiciones de Venta</p>
              <p className="text-[11px] text-gray-400">{pres.empresa.nombre}</p>
            </div>
            <button onClick={() => setShowTerminos(false)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          {/* Contenido scrollable */}
          <div className="overflow-y-auto px-5 py-4 text-xs text-gray-600 space-y-4 leading-relaxed">

            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-1.5">1. Vigencia y validez del presupuesto</h3>
              <p>El presente presupuesto tiene validez según la fecha indicada en la proforma. Transcurrido dicho plazo, los precios y condiciones podrán ser revisados sin previo aviso, sujetos a variaciones en costos de materiales, tipo de cambio o disponibilidad de stock.</p>
            </section>

            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-1.5">2. Condiciones de pago</h3>
              <p>La seña o pago inicial confirma el pedido e inicia la fabricación. El saldo deberá abonarse según lo acordado en el presupuesto, previo a la entrega o instalación. En caso de pago financiado, se aplican las condiciones vigentes de la modalidad seleccionada (tarjeta, cuotas, transferencia).</p>
            </section>

            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-1.5">3. Fabricación y plazos de entrega</h3>
              <p>Los plazos de entrega son estimativos y se computan a partir de la confirmación del pedido con la seña correspondiente. Demoras por causas ajenas a la empresa (fuerza mayor, faltante de materiales, condiciones climáticas para instalación) no darán lugar a penalidades.</p>
            </section>

            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-1.5">4. Medidas y especificaciones</h3>
              <p>El cliente es responsable de verificar las medidas y especificaciones técnicas antes de confirmar el pedido. Las aberturas fabricadas a medida no admiten devolución ni cambio una vez iniciada la producción. Ante dudas sobre medidas, se recomienda solicitar una visita de medición previa.</p>
            </section>

            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-1.5">5. Garantía</h3>
              <p>Los productos cuentan con garantía sobre defectos de fabricación por un período de 12 meses desde la fecha de entrega. La garantía no cubre daños por uso inadecuado, instalación incorrecta realizada por terceros ajenos a la empresa, ni deterioro por factores ambientales (humedad excesiva, salinidad, etc.).</p>
            </section>

            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-1.5">6. Instalación</h3>
              <p>Cuando el presupuesto incluye instalación, el cliente debe garantizar el acceso al lugar y condiciones seguras de trabajo. Si en el momento de la instalación se detectan imprevistos estructurales (mampostería, contramarco fuera de escuadra, etc.), podrán generar costos adicionales que se acordarán previamente.</p>
            </section>

            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-1.5">7. Cancelaciones y modificaciones</h3>
              <p>Las modificaciones posteriores a la confirmación pueden implicar ajuste de precios y plazos. La cancelación de un pedido en producción no da derecho a la devolución de la seña abonada, dado que los materiales ya fueron comprometidos y/o fabricados.</p>
            </section>

            <section>
              <h3 className="font-bold text-gray-800 text-sm mb-1.5">8. Aceptación</h3>
              <p>Al aprobar esta proforma, el cliente declara haber leído, comprendido y aceptado la totalidad de estos términos y condiciones, así como las especificaciones técnicas detalladas en el presupuesto.</p>
            </section>

          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-200 shrink-0">
            <button onClick={() => setShowTerminos(false)}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: '#031d49' }}>
              Entendido — volver a la proforma
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
