import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Plus, CalendarClock, Building2, CheckCheck, Sun, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { SectionHero } from '@/components/SectionHero';
import { CompactStatsBar } from '@/components/CompactStatsBar';
import { HelpButton } from '@/components/HelpButton';
import { ItemTarea } from '@/components/agenda/ItemTarea';
import { ModalTareaInterna } from '@/components/agenda/ModalTareaInterna';
import { completar, reprogramar } from '@/components/agenda/acciones';
import { type TareaAgenda, type Categoria, CATEGORIAS, EVENTO_AGENDA, fechaCorta, diaAR } from '@/lib/agenda';

type Tab = 'hoy' | 'proximas' | 'internas' | 'hechas';

// Agenda completa: lo de hoy (clientes e internas), lo que viene, las tareas internas de la
// empresa y el historial de lo hecho. El aviso del día (AgendaDelDia) se apoya en lo mismo.
export default function Agenda() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const soloLectura = user?.rol === 'consulta';
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'hoy';
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [deHoy, setDeHoy] = useState<TareaAgenda[]>([]);
  const [hoy, setHoy] = useState(diaAR(0));
  // La lista se guarda con la vista que la pidió: al cambiar de pestaña se muestra el spinner
  // hasta que llega la nueva, y al refrescar la misma vista no parpadea.
  const [res, setRes] = useState<{ vista: string; filas: TareaAgenda[] } | null>(null);
  const [modal, setModal] = useState<{ tarea: TareaAgenda | null } | null>(null);
  const [refresh, setRefresh] = useState(0);

  const recargar = useCallback(() => setRefresh(r => r + 1), []);
  useEffect(() => {
    window.addEventListener(EVENTO_AGENDA, recargar);
    return () => window.removeEventListener(EVENTO_AGENDA, recargar);
  }, [recargar]);

  useEffect(() => {
    api.get<{ hoy: string; tareas: TareaAgenda[] }>('/agenda/hoy').then(r => { setDeHoy(r.tareas); setHoy(r.hoy); }).catch(() => {});
  }, [refresh]);

  const vista = `${tab}|${categoria}`;
  useEffect(() => {
    if (tab === 'hoy') return;
    const q = new URLSearchParams({ vista: tab, ...(categoria ? { categoria } : {}) });
    api.get<TareaAgenda[]>(`/agenda/tareas?${q}`)
      .then(filas => setRes({ vista: `${tab}|${categoria}`, filas }))
      .catch(() => setRes({ vista: `${tab}|${categoria}`, filas: [] }));
  }, [tab, categoria, refresh]);
  const cargando = tab !== 'hoy' && res?.vista !== vista;
  const lista = res?.vista === vista ? res.filas : [];

  const setTab = (t: Tab) => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }); };

  const onHecho = async (t: TareaAgenda) => { await completar(t.id); };
  const onReprogramar = async (t: TareaAgenda, fecha: string, hora: string | null | undefined) => { await reprogramar([t.id], fecha, hora); };
  const onIr = (_t: TareaAgenda, destino: string) => navigate(destino);

  const atrasadas = deHoy.filter(t => t.atrasada).length;
  const internasHoy = deHoy.filter(t => t.ambito === 'interna').length;
  const TABS: { value: Tab; label: string; icon: typeof Sun; count?: number }[] = [
    { value: 'hoy',      label: 'Hoy',       icon: Sun,           count: deHoy.length || undefined },
    { value: 'proximas', label: 'Próximas',  icon: CalendarClock },
    { value: 'internas', label: 'Internas',  icon: Building2 },
    { value: 'hechas',   label: 'Hechas',    icon: CheckCheck },
  ];

  const filas = tab === 'hoy' ? deHoy : lista;
  // Próximas e internas, agrupadas por día
  const grupos: { titulo: string; tareas: TareaAgenda[] }[] = [];
  if (tab === 'proximas' || tab === 'internas') {
    for (const t of filas) {
      const titulo = t.vencimiento === hoy ? 'Hoy' : t.vencimiento && t.vencimiento < hoy ? 'Atrasadas' : fechaCorta(t.vencimiento);
      const g = grupos[grupos.length - 1];
      if (g && g.titulo === titulo) g.tareas.push(t); else grupos.push({ titulo, tareas: [t] });
    }
  } else {
    grupos.push({ titulo: '', tareas: filas });
  }

  const item = (t: TareaAgenda) => (
    <ItemTarea key={t.id} t={t} hoy={hoy} soloLectura={soloLectura} conRecordar={false}
      onHecho={onHecho} onReprogramar={onReprogramar} onIr={onIr} onEditar={x => setModal({ tarea: x })} />
  );

  return (
    <div className="p-3 sm:p-4 xl:p-6 space-y-4 max-w-[1440px] mx-auto" data-section="agenda">
      <SectionHero
        section="agenda"
        icon={CalendarDays}
        title="Agenda"
        sub="Lo que hay que hacer hoy: clientes y tareas internas de la empresa"
        actions={<>
          <HelpButton topic="agenda" />
          {!soloLectura && (
            <button onClick={() => setModal({ tarea: null })}
              className="flex items-center gap-2 bg-orange-600 text-white text-sm font-semibold px-4 h-11 sm:h-10 rounded-xl hover:bg-orange-700 transition-colors shadow-md">
              <Plus size={16} /> Tarea interna
            </button>
          )}
        </>}
      />

      <CompactStatsBar items={[
        { value: deHoy.length, label: 'pendientes hoy', color: '#fdba74' },
        { value: atrasadas, label: 'atrasadas', color: atrasadas ? '#f87171' : '#ffffff' },
        { value: internasHoy, label: 'internas de hoy', color: '#ffffff' },
      ]} />

      <div className="flex gap-1 flex-wrap">
        {TABS.map(x => (
          <button key={x.value} onClick={() => setTab(x.value)}
            className={cn('flex items-center gap-1.5 px-3 h-10 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
              tab === x.value ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 hover:text-orange-700')}>
            <x.icon size={14} /> {x.label}
            {x.count !== undefined && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold', tab === x.value ? 'bg-white/20' : 'bg-orange-100 text-orange-800')}>{x.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'internas' && (
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCategoria('')}
            className={cn('h-9 px-3 rounded-full text-xs font-semibold border', !categoria ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-700')}>
            Todas
          </button>
          {(Object.keys(CATEGORIAS) as Categoria[]).map(k => {
            const m = CATEGORIAS[k];
            const Icono = m.icon;
            return (
              <button key={k} onClick={() => setCategoria(k)}
                className={cn('h-9 px-3 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5',
                  categoria === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-700')}>
                <Icono size={13} className={categoria === k ? '' : m.color} /> {m.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-gray-300 bg-white shadow-sm overflow-hidden">
        {cargando ? (
          <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : filas.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCheck size={28} className="mx-auto text-emerald-500" />
            <p className="mt-2 text-sm font-semibold text-gray-700">
              {tab === 'hoy' ? 'Al día: nada pendiente para hoy' : tab === 'hechas' ? 'Todavía no hay tareas hechas' : 'No hay tareas'}
            </p>
          </div>
        ) : grupos.map(g => (
          <section key={g.titulo || 'todo'}>
            {g.titulo && (
              <div className={cn('px-4 py-2 border-b text-xs font-extrabold uppercase tracking-wide',
                g.titulo === 'Atrasadas' ? 'bg-red-100 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-700')}>
                {g.titulo} <span className="font-semibold normal-case">({g.tareas.length})</span>
              </div>
            )}
            <div className="divide-y divide-gray-100">{g.tareas.map(item)}</div>
          </section>
        ))}
      </div>

      {modal && <ModalTareaInterna tarea={modal.tarea} onClose={() => setModal(null)} onGuardada={recargar} />}
    </div>
  );
}
