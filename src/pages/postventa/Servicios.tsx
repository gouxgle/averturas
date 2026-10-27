import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Wrench, Plus, Loader2, Search, Phone, CalendarClock, UserRound, Inbox, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { SectionHero } from '@/components/SectionHero';
import { HelpButton } from '@/components/HelpButton';
import { VistasPostventa } from '@/components/servicios/VistasPostventa';
import { NuevoServicio } from '@/components/servicios/NuevoServicio';
import { ESTADO_SERVICIO, TIPO_SERVICIO, fechaCortaServicio, type ServicioFila, type TipoServicio } from '@/lib/servicios';

type Tab = 'pendientes' | 'programados' | 'en_proceso' | 'repuesto' | 'reconsultar' | 'finalizados' | 'cancelados';
const TABS: { v: Tab; l: string }[] = [
  { v: 'pendientes', l: 'Por coordinar' }, { v: 'programados', l: 'Programados' }, { v: 'en_proceso', l: 'En proceso' },
  { v: 'repuesto', l: 'Repuesto / nueva visita' }, { v: 'reconsultar', l: 'Para reconsultar' },
  { v: 'finalizados', l: 'Finalizados' }, { v: 'cancelados', l: 'Cancelados' },
];

// Garantías y servicios técnicos: la lista de fichas por estado. La ficha se abre en su propia página
// (/postventa/servicios/:id) porque el técnico la usa desde el celular.
export default function Servicios() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const puede = user?.rol !== 'consulta';
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some(t => t.v === params.get('tab')) ? params.get('tab') : 'pendientes') as Tab;
  const [tipo, setTipo] = useState<TipoServicio | ''>('');
  const [q, setQ] = useState('');
  const [qDiferida, setQDiferida] = useState('');
  const [res, setRes] = useState<{ clave: string; servicios: ServicioFila[]; conteos: Record<Tab, number> } | null>(null);
  const [error, setError] = useState(false);
  const [nuevo, setNuevo] = useState(false);

  useEffect(() => { const h = setTimeout(() => setQDiferida(q.trim()), 300); return () => clearTimeout(h); }, [q]);
  const clave = `${tab}|${tipo}|${qDiferida}`;
  const cargar = useCallback(() => {
    const p = new URLSearchParams({ tab, ...(tipo ? { tipo } : {}), ...(qDiferida ? { q: qDiferida } : {}) });
    api.get<{ servicios: ServicioFila[]; conteos: Record<Tab, number> }>(`/servicios-tecnicos?${p}`)
      .then(r => { setRes({ clave: `${tab}|${tipo}|${qDiferida}`, ...r }); setError(false); })
      .catch(() => setError(true));
  }, [tab, tipo, qDiferida]);
  useEffect(() => { cargar(); }, [cargar]);
  const lista = res?.clave === clave ? res.servicios : null;
  const conteos = res?.conteos;

  const setTab = (t: Tab) => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }); };
  const abrir = (id: string) => navigate(`/postventa/servicios/${id}`);

  return (
    <div className="p-3 sm:p-4 xl:p-6 space-y-4 max-w-[1200px] mx-auto" data-section="crm">
      <SectionHero section="crm" icon={Wrench} title="Garantías y servicios"
        sub="Reclamos, reparaciones y mantenimientos: desde el aviso del cliente hasta su firma de conformidad"
        actions={<>
          <HelpButton topic="postventa" />
          {puede && (
            <button onClick={() => setNuevo(true)} data-testid="nuevo-servicio"
              className="flex items-center gap-2 bg-teal-700 text-white text-sm font-semibold px-4 h-11 sm:h-10 rounded-xl hover:bg-teal-800 shadow-md">
              <Plus size={16} /> Nuevo servicio
            </button>
          )}
        </>} />

      <VistasPostventa />
      <PlazoGarantia esAdmin={user?.rol === 'admin'} />

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)} data-testid={`tab-st-${t.v}`} aria-pressed={tab === t.v}
            className={cn('flex items-center gap-1.5 px-3 h-10 rounded-lg text-xs font-medium border whitespace-nowrap',
              tab === t.v ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-800')}>
            {t.l}
            {conteos && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold', tab === t.v ? 'bg-white/20' : 'bg-teal-100 text-teal-800')}>{conteos[t.v]}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente, número, producto o problema"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 bg-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([['', 'Todos'], ...Object.entries(TIPO_SERVICIO).map(([k, v]) => [k, v.corto])] as [TipoServicio | '', string][]).map(([k, l]) => (
            <button key={k || 'todos'} onClick={() => setTipo(k)} aria-pressed={tipo === k}
              className={cn('h-10 px-3 rounded-full text-xs font-semibold border', tipo === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-700')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && !lista && <p className="text-sm text-red-700">No se pudo cargar. Probá de nuevo en un momento.</p>}
      {!lista && !error && <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>}
      {lista && lista.length === 0 && (
        <div className="rounded-2xl border border-gray-300 bg-white py-10 text-center">
          <Inbox className="mx-auto text-gray-400" />
          <p className="text-sm text-gray-600 mt-2">
            {qDiferida || tipo ? 'Ningún servicio coincide con el filtro.' : tab === 'pendientes' ? 'No hay servicios por coordinar.' : 'No hay servicios en esta lista.'}
          </p>
        </div>
      )}
      {lista && lista.length > 0 && <ListaServicios servicios={lista} onAbrir={abrir} />}

      {nuevo && <NuevoServicio onClose={() => setNuevo(false)} onGuardado={id => { setNuevo(false); abrir(id); }} />}
    </div>
  );
}

/** Meses de garantía desde la entrega: solo para sugerir "Garantía" al abrir un servicio (no bloquea nada). */
function PlazoGarantia({ esAdmin }: { esAdmin: boolean }) {
  const [meses, setMeses] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  useEffect(() => { api.get<{ garantia_meses?: number } | null>('/empresa').then(e => setMeses(Number(e?.garantia_meses ?? 12))).catch(() => {}); }, []);
  async function guardar() {
    try {
      await api.put('/empresa', { garantia_meses: Number(valor) });
      setMeses(Number(valor)); setEditando(false);
      toast.success(`Garantía: ${valor} meses desde la entrega`);
    } catch (e) { toastApiError(e, { fallback: 'No se pudo guardar' }); }
  }
  if (meses === null) return null;
  return (
    <p className="text-xs text-gray-700 flex flex-wrap items-center gap-x-2 gap-y-1">
      <ShieldCheck size={13} className="text-gray-500" /> Garantía:
      {editando ? (
        <>
          <input type="number" min={0} max={120} value={valor} onChange={e => setValor(e.target.value)} className="h-9 w-16 px-2 rounded-lg border border-gray-300 text-sm" aria-label="Meses de garantía" />
          meses <button onClick={guardar} className="h-9 px-3 rounded-lg bg-teal-700 text-white font-bold">Guardar</button>
          <button onClick={() => setEditando(false)} className="h-9 px-3 rounded-lg border border-gray-300 bg-white">Cancelar</button>
        </>
      ) : (
        <>
          <b>{meses} meses</b> desde la entrega (sirve para sugerir el tipo al abrir un servicio).
          {esAdmin && <button onClick={() => { setValor(String(meses)); setEditando(true); }} className="text-teal-800 font-semibold hover:underline">Cambiar</button>}
        </>
      )}
    </p>
  );
}

/** Tabla en desktop, tarjetas en el celular (mismo componente). La usa también la ficha del cliente. */
export function ListaServicios({ servicios, onAbrir }: { servicios: ServicioFila[]; onAbrir: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-gray-300 bg-white overflow-hidden" data-testid="lista-servicios">
      <table className="hidden md:table w-full text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-600">
          <tr>
            <th className="text-left px-3 py-2">Servicio</th><th className="text-left px-3 py-2">Cliente</th>
            <th className="text-left px-3 py-2">Producto y problema</th><th className="text-left px-3 py-2">Visita</th>
            <th className="text-left px-3 py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {servicios.map(s => (
            <tr key={s.id} onClick={() => onAbrir(s.id)} className="border-t border-gray-100 hover:bg-teal-50/50 cursor-pointer align-top">
              <td className="px-3 py-2.5 whitespace-nowrap">
                <p className="font-bold text-gray-900">{s.numero}</p>
                <span className={cn('inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', TIPO_SERVICIO[s.tipo].cls)}>{TIPO_SERVICIO[s.tipo].corto}</span>
                <p className="text-[11px] text-gray-500 mt-0.5">Reclamo {fechaCortaServicio(s.fecha_reclamo)}</p>
              </td>
              <td className="px-3 py-2.5 max-w-[14rem]">
                <p className="font-semibold text-gray-900 truncate">{s.cliente_nombre}</p>
                {s.cliente_telefono && <p className="text-[11px] text-gray-600">{s.cliente_telefono}</p>}
                {s.cliente_localidad && <p className="text-[11px] text-gray-500 truncate">{s.cliente_localidad}</p>}
              </td>
              <td className="px-3 py-2.5">
                {s.producto_descripcion && <p className="font-medium text-gray-900 line-clamp-1">{s.producto_descripcion}</p>}
                <p className="text-xs text-gray-700 line-clamp-2">{s.problema}</p>
              </td>
              <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                {s.fecha_visita ? <p className="font-semibold text-gray-900">{fechaCortaServicio(s.fecha_visita)}{s.hora_visita ? ` ${s.hora_visita}` : ''}</p> : <p className="text-gray-500">Sin fecha</p>}
                {s.responsable && <p className="text-gray-600">{s.responsable}</p>}
                {s.intervenciones > 0 && <p className="text-gray-500">{s.intervenciones} visita{s.intervenciones > 1 ? 's' : ''} hecha{s.intervenciones > 1 ? 's' : ''}</p>}
              </td>
              <td className="px-3 py-2.5">
                <span className={cn('inline-block text-[11px] font-bold text-white px-2 py-1 rounded-md', ESTADO_SERVICIO[s.estado].solido)}>{ESTADO_SERVICIO[s.estado].label}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="md:hidden divide-y divide-gray-100">
        {servicios.map(s => (
          <button key={s.id} onClick={() => onAbrir(s.id)} className="w-full text-left p-3 space-y-1.5 hover:bg-teal-50/50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{s.cliente_nombre}</p>
                <p className="text-[11px] text-gray-600">{s.numero} · reclamo {fechaCortaServicio(s.fecha_reclamo)}</p>
              </div>
              <span className={cn('shrink-0 text-[10px] font-bold text-white px-1.5 py-1 rounded-md', ESTADO_SERVICIO[s.estado].solido)}>{ESTADO_SERVICIO[s.estado].label}</span>
            </div>
            <span className={cn('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', TIPO_SERVICIO[s.tipo].cls)}>{TIPO_SERVICIO[s.tipo].corto}</span>
            {s.producto_descripcion && <p className="text-xs font-semibold text-gray-900">{s.producto_descripcion}</p>}
            <p className="text-xs text-gray-700 line-clamp-2">{s.problema}</p>
            <p className="text-[11px] text-gray-600 flex flex-wrap gap-x-3 gap-y-0.5">
              {s.fecha_visita && <span className="inline-flex items-center gap-1"><CalendarClock size={11} />{fechaCortaServicio(s.fecha_visita)}{s.hora_visita ? ` ${s.hora_visita}` : ''}</span>}
              {s.responsable && <span className="inline-flex items-center gap-1"><UserRound size={11} />{s.responsable}</span>}
              {s.cliente_telefono && <span className="inline-flex items-center gap-1"><Phone size={11} />{s.cliente_telefono}</span>}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
