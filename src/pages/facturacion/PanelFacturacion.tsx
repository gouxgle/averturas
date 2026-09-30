import { useEffect, useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Circle, RefreshCw, Save, Plus, Trash2, Download, Upload,
  KeyRound, Power, ShieldCheck, ChevronDown, Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

// Configuración > Facturación electrónica (solo admin). Todo lo necesario para la puesta en
// marcha con ARCA: datos del emisor, puntos de venta, certificado y el semáforo de "Probar
// conexión". La facturación queda apagada hasta que el semáforo da verde y se habilita a mano.

type Ambiente = 'homologacion' | 'produccion';
type Semaforo = 'ok' | 'aviso' | 'error' | 'pendiente';

interface Config {
  habilitada: boolean; ambiente: Ambiente; cuit: string | null; razon_social: string | null;
  iibb: string | null; inicio_actividades: string | null; domicilio_fiscal: string | null;
  leyenda_pie: string | null; cert_estado: 'sin_clave' | 'csr_generado' | 'activo';
  cert_ambiente: Ambiente | null; cert_subject: string | null; cert_vencimiento: string | null;
  csr_generado_at: string | null; ultima_prueba_at: string | null; ultima_prueba_ok: boolean | null;
}
interface PuntoVenta { id: string; numero: number; modo: 'CAE' | 'CAEA'; domicilio: string | null; activo: boolean }
interface ItemChecklist { clave: string; titulo: string; estado: Semaforo; detalle: string; obligatorio: boolean }
interface Respuesta { config: Config; puntos_venta: PuntoVenta[]; checklist: ItemChecklist[]; listo: boolean }
interface Evento {
  id: number; tipo: string; metodo: string | null; ok: boolean | null; duracion_ms: number | null;
  error_mensaje: string | null; created_at: string; usuario_nombre: string | null;
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400 bg-white';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnSec = 'inline-flex items-center justify-center gap-2 h-11 sm:h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const btnPri = 'inline-flex items-center justify-center gap-2 h-11 sm:h-9 px-4 rounded-lg bg-fuchsia-700 text-sm font-semibold text-white hover:bg-fuchsia-800 disabled:opacity-50';

const AMBIENTE_LABEL: Record<Ambiente, string> = { homologacion: 'Homologación (pruebas)', produccion: 'Producción' };

const SEMAFORO: Record<Semaforo, { icon: typeof CheckCircle2; cls: string }> = {
  ok:        { icon: CheckCircle2,  cls: 'text-emerald-600' },
  aviso:     { icon: AlertTriangle, cls: 'text-amber-500' },
  error:     { icon: XCircle,       cls: 'text-red-600' },
  pendiente: { icon: Circle,        cls: 'text-gray-400' },
};

const fechaHora = (iso: string | null) => iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

function Bloque({ titulo, icon: Icon, children, extra }: { titulo: string; icon: typeof Store; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800"><Icon size={16} className="text-fuchsia-700" />{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function PanelFacturacion() {
  const [data, setData] = useState<Respuesta | null>(null);
  const [probando, setProbando] = useState(false);

  function cargar() {
    return api.get<Respuesta>('/facturacion/config').then(setData).catch(e => toastApiError(e));
  }
  useEffect(() => { cargar(); }, []);

  if (!data) return <p className="text-sm text-gray-600 py-4">Cargando...</p>;
  const { config } = data;

  async function probar() {
    setProbando(true);
    try {
      const r = await api.post<{ checklist: ItemChecklist[]; listo: boolean }>('/facturacion/probar', {});
      setData(d => d && { ...d, checklist: r.checklist, listo: r.listo });
      await cargar();
      if (r.listo) toast.success('Conexión con ARCA verificada');
      else toast.error('Hay puntos para resolver antes de facturar');
    } catch (e) { toastApiError(e); } finally { setProbando(false); }
  }

  async function habilitar(v: boolean) {
    try {
      await api.patch('/facturacion/habilitar', { habilitada: v });
      toast.success(v ? 'Facturación habilitada' : 'Facturación deshabilitada');
      cargar();
    } catch (e) { toastApiError(e); }
  }

  return (
    <div className="space-y-4">
      {/* Estado general */}
      <div className={cn('rounded-xl border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3',
        config.habilitada ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-bold', config.habilitada ? 'text-emerald-800' : 'text-amber-800')}>
            {config.habilitada ? 'Facturación habilitada' : 'Facturación apagada'} · {AMBIENTE_LABEL[config.ambiente]}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {config.habilitada
              ? 'El sistema puede emitir comprobantes con ARCA.'
              : 'Completá los pasos de abajo, usá "Probar conexión" y cuando todo esté en verde habilitala.'}
            {config.ultima_prueba_at && ` Última prueba: ${fechaHora(config.ultima_prueba_at)}.`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={probar} disabled={probando} className={btnSec}>
            <RefreshCw size={15} className={probando ? 'animate-spin' : ''} /> {probando ? 'Probando…' : 'Probar conexión'}
          </button>
          {config.habilitada
            ? <button onClick={() => habilitar(false)} className={btnSec}><Power size={15} /> Deshabilitar</button>
            : <button onClick={() => habilitar(true)} disabled={!data.listo || !config.ultima_prueba_ok} className={btnPri}
                title={!data.listo ? 'Primero resolvé los puntos en rojo' : undefined}><Power size={15} /> Habilitar</button>}
        </div>
      </div>

      {/* Checklist */}
      <Bloque titulo="Puesta en marcha" icon={ShieldCheck}>
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {data.checklist.map(i => {
            const s = SEMAFORO[i.estado];
            return (
              <li key={i.clave} className="flex items-start gap-3 px-3 py-2.5">
                <s.icon size={18} className={cn('shrink-0 mt-0.5', s.cls)} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {i.titulo}{!i.obligatorio && <span className="ml-1.5 text-[11px] font-normal text-gray-500">(recomendado)</span>}
                  </p>
                  <p className="text-xs text-gray-600 break-words">{i.detalle}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Bloque>

      <DatosFiscales config={config} onGuardado={cargar} />
      <PuntosVenta puntos={data.puntos_venta} onCambio={cargar} />
      <Certificado config={config} onCambio={cargar} />
      <Registro />
    </div>
  );
}

function DatosFiscales({ config, onGuardado }: { config: Config; onGuardado: () => void }) {
  const [form, setForm] = useState({
    cuit: config.cuit ?? '', razon_social: config.razon_social ?? '', domicilio_fiscal: config.domicilio_fiscal ?? '',
    iibb: config.iibb ?? '', inicio_actividades: config.inicio_actividades?.slice(0, 10) ?? '',
    leyenda_pie: config.leyenda_pie ?? '', ambiente: config.ambiente,
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function guardar() {
    setGuardando(true);
    try {
      const vacioANull = (v: string) => v.trim() || null;
      await api.put('/facturacion/config', {
        cuit: vacioANull(form.cuit), razon_social: vacioANull(form.razon_social),
        domicilio_fiscal: vacioANull(form.domicilio_fiscal), iibb: vacioANull(form.iibb),
        inicio_actividades: vacioANull(form.inicio_actividades), leyenda_pie: vacioANull(form.leyenda_pie),
        ambiente: form.ambiente,
      });
      toast.success('Datos fiscales guardados');
      onGuardado();
    } catch (e) { toastApiError(e); } finally { setGuardando(false); }
  }

  return (
    <Bloque titulo="Datos fiscales del emisor" icon={Store}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>CUIT *</label>
          <input value={form.cuit} onChange={e => set('cuit', e.target.value)} className={inputCls} placeholder="23-25889760-9" inputMode="numeric" />
        </div>
        <div>
          <label className={labelCls}>Razón social (como figura en ARCA) *</label>
          <input value={form.razon_social} onChange={e => set('razon_social', e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Domicilio fiscal / comercial *</label>
          <input value={form.domicilio_fiscal} onChange={e => set('domicilio_fiscal', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Ingresos Brutos *</label>
          <input value={form.iibb} onChange={e => set('iibb', e.target.value)} className={inputCls} placeholder="N° o Convenio Multilateral" />
        </div>
        <div>
          <label className={labelCls}>Inicio de actividades *</label>
          <input type="date" value={form.inicio_actividades} onChange={e => set('inicio_actividades', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Condición frente al IVA</label>
          <input value="Responsable Inscripto" disabled className={cn(inputCls, 'bg-gray-100 text-gray-600')} />
        </div>
        <div>
          <label className={labelCls}>Ambiente de ARCA</label>
          <select value={form.ambiente} onChange={e => set('ambiente', e.target.value)} className={inputCls} disabled={config.habilitada}>
            <option value="homologacion">{AMBIENTE_LABEL.homologacion}</option>
            <option value="produccion">{AMBIENTE_LABEL.produccion}</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Leyenda al pie de los comprobantes (opcional)</label>
          <textarea value={form.leyenda_pie} onChange={e => set('leyenda_pie', e.target.value)} rows={2} className={inputCls} />
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={guardar} disabled={guardando} className={btnPri}><Save size={15} /> {guardando ? 'Guardando…' : 'Guardar datos'}</button>
      </div>
    </Bloque>
  );
}

function PuntosVenta({ puntos, onCambio }: { puntos: PuntoVenta[]; onCambio: () => void }) {
  const [numero, setNumero] = useState('');
  const [modo, setModo] = useState<'CAE' | 'CAEA'>('CAE');

  async function agregar() {
    const n = Number(numero);
    if (!Number.isInteger(n) || n < 1) { toast.error('Número de punto de venta inválido'); return; }
    try {
      await api.post('/facturacion/puntos-venta', { numero: n, modo });
      setNumero('');
      onCambio();
    } catch (e) { toastApiError(e); }
  }
  async function toggle(p: PuntoVenta) {
    try { await api.put(`/facturacion/puntos-venta/${p.id}`, { activo: !p.activo }); onCambio(); } catch (e) { toastApiError(e); }
  }
  async function borrar(p: PuntoVenta) {
    try { await api.delete(`/facturacion/puntos-venta/${p.id}`); onCambio(); } catch (e) { toastApiError(e); }
  }

  return (
    <Bloque titulo="Puntos de venta" icon={Store}>
      <p className="text-xs text-gray-600">
        Se crean en ARCA ("Administración de puntos de venta y domicilios") con sistema <b>web service</b>.
        Tiene que ser uno <b>nuevo</b>, distinto del que se usa en Comprobantes en línea. El de <b>CAEA</b> es
        para facturar cuando ARCA no responde (contingencia).
      </p>
      {puntos.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {puntos.map(p => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className="font-mono text-sm font-bold text-gray-900">{String(p.numero).padStart(5, '0')}</span>
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-md',
                p.modo === 'CAE' ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-sky-100 text-sky-800')}>
                {p.modo === 'CAE' ? 'Online (CAE)' : 'Contingencia (CAEA)'}
              </span>
              {!p.activo && <span className="text-[11px] text-gray-500">inactivo</span>}
              <div className="ml-auto flex gap-1">
                <button onClick={() => toggle(p)} className="h-9 px-2 text-xs font-semibold text-gray-600 hover:text-gray-900">
                  {p.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => borrar(p)} className="h-9 w-9 flex items-center justify-center text-gray-400 hover:text-red-600" aria-label="Eliminar">
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, ''))} placeholder="N° de punto de venta"
          className={cn(inputCls, 'sm:w-44')} inputMode="numeric" />
        <select value={modo} onChange={e => setModo(e.target.value as 'CAE' | 'CAEA')} className={cn(inputCls, 'sm:w-56')}>
          <option value="CAE">Online (CAE)</option>
          <option value="CAEA">Contingencia (CAEA)</option>
        </select>
        <button onClick={agregar} className={btnSec}><Plus size={15} /> Agregar</button>
      </div>
    </Bloque>
  );
}

function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/pkcs10' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  a.click();
  URL.revokeObjectURL(url);
}

function Certificado({ config, onCambio }: { config: Config; onCambio: () => void }) {
  const [alias, setAlias] = useState('aberturas');
  const [confirmarNueva, setConfirmarNueva] = useState(false);
  const [ambienteCert, setAmbienteCert] = useState<Ambiente>(config.ambiente);
  const [trabajando, setTrabajando] = useState(false);

  async function generarCsr() {
    if (config.cert_estado === 'activo' && !confirmarNueva) { setConfirmarNueva(true); return; }
    setTrabajando(true);
    try {
      const r = await api.post<{ csr: string }>('/facturacion/certificado/csr', { alias, confirmar: confirmarNueva });
      descargar(`solicitud-arca-${alias}.csr`, r.csr);
      toast.success('Solicitud generada y descargada: subila a ARCA');
      setConfirmarNueva(false);
      onCambio();
    } catch (e) { toastApiError(e); } finally { setTrabajando(false); }
  }

  async function subirCrt(archivo: File | undefined) {
    if (!archivo) return;
    setTrabajando(true);
    try {
      const pem = await archivo.text();
      await api.post('/facturacion/certificado', { ambiente: ambienteCert, pem });
      toast.success('Certificado cargado');
      onCambio();
    } catch (e) { toastApiError(e); } finally { setTrabajando(false); }
  }

  const paso = (n: number, hecho: boolean, texto: React.ReactNode) => (
    <div className="flex gap-3">
      <span className={cn('w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold',
        hecho ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700')}>{hecho ? '✓' : n}</span>
      <div className="text-sm text-gray-700 min-w-0 flex-1">{texto}</div>
    </div>
  );

  return (
    <Bloque titulo="Certificado digital de ARCA" icon={KeyRound}>
      <div className="space-y-3">
        {paso(1, config.cert_estado !== 'sin_clave', (
          <div className="space-y-2">
            <p><b>Generar la solicitud.</b> La clave privada se crea y queda solo en el servidor; se descarga un archivo <code>.csr</code>.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={alias} onChange={e => setAlias(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} className={cn(inputCls, 'sm:w-48')} placeholder="alias" />
              <button onClick={generarCsr} disabled={trabajando} className={btnSec}><Download size={15} /> Generar y descargar solicitud</button>
            </div>
            {confirmarNueva && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                Ya hay un certificado activo. Una solicitud nueva cambia la clave y ese certificado <b>deja de servir</b>:
                habrá que pedir otro a ARCA. Tocá de nuevo el botón para confirmar.
              </div>
            )}
          </div>
        ))}
        {paso(2, config.cert_estado === 'activo', (
          <p><b>Subir la solicitud a ARCA</b> con clave fiscal: en homologación, "WSASS – Autogestión certificados homologación";
            en producción, "Administración de certificados digitales". Después, en "Administrador de relaciones de clave fiscal",
            asociar el certificado a los servicios <b>Facturación electrónica (wsfe)</b> y <b>Consulta de constancia de inscripción</b>.</p>
        ))}
        {paso(3, config.cert_estado === 'activo', (
          <div className="space-y-2">
            <p><b>Cargar el certificado</b> (<code>.crt</code>) que devuelve ARCA.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={ambienteCert} onChange={e => setAmbienteCert(e.target.value as Ambiente)} className={cn(inputCls, 'sm:w-56')}>
                <option value="homologacion">{AMBIENTE_LABEL.homologacion}</option>
                <option value="produccion">{AMBIENTE_LABEL.produccion}</option>
              </select>
              <label className={cn(btnSec, 'cursor-pointer', (trabajando || config.cert_estado === 'sin_clave') && 'opacity-50 pointer-events-none')}>
                <Upload size={15} /> Elegir archivo .crt
                <input type="file" accept=".crt,.pem,.cer" className="hidden" onChange={e => { subirCrt(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        ))}
      </div>
      {config.cert_estado === 'activo' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 break-words">
          <b>Certificado activo ({config.cert_ambiente && AMBIENTE_LABEL[config.cert_ambiente]})</b> · vence {fechaHora(config.cert_vencimiento)}
          <br />{config.cert_subject}
        </div>
      )}
    </Bloque>
  );
}

function Registro() {
  const [abierto, setAbierto] = useState(false);
  const [eventos, setEventos] = useState<Evento[] | null>(null);

  function alternar() {
    const v = !abierto;
    setAbierto(v);
    if (v) api.get<Evento[]>('/facturacion/eventos?limite=40').then(setEventos).catch(e => toastApiError(e));
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <button onClick={alternar} className="w-full flex items-center justify-between px-3 sm:px-4 h-11 text-sm font-bold text-gray-800">
        Registro de actividad con ARCA
        <ChevronDown size={16} className={cn('transition-transform', abierto && 'rotate-180')} />
      </button>
      {abierto && (
        <div className="border-t border-gray-200 max-h-80 overflow-y-auto">
          {!eventos ? <p className="p-3 text-sm text-gray-600">Cargando…</p>
            : eventos.length === 0 ? <p className="p-3 text-sm text-gray-600">Sin actividad todavía.</p>
            : (
              <ul className="divide-y divide-gray-100">
                {eventos.map(ev => (
                  <li key={ev.id} className="px-3 py-2 text-xs flex gap-2">
                    {ev.ok === false ? <XCircle size={14} className="text-red-600 shrink-0 mt-0.5" /> : <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-gray-800">
                        <b>{ev.tipo === 'config' ? 'Configuración' : ev.metodo ?? ev.tipo}</b>
                        {ev.duracion_ms != null && <span className="text-gray-500"> · {ev.duracion_ms} ms</span>}
                        {ev.error_mensaje && <span className={ev.ok === false ? 'text-red-700' : 'text-gray-700'}> · {ev.error_mensaje}</span>}
                      </p>
                      <p className="text-gray-500">{fechaHora(ev.created_at)}{ev.usuario_nombre && ` · ${ev.usuario_nombre}`}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </section>
  );
}
