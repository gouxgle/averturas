import { useCallback, useEffect, useState } from 'react';
import { StickyNote, Send, Check, RotateCcw, Archive, ArchiveRestore, Trash2, Search, Loader2, Inbox, ArrowDownUp } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';
import { CompactStatsBar } from '@/components/CompactStatsBar';
import { type Comentario, EVENTO_COMENTARIOS, avisarCambioComentarios, fmtFechaComentario } from '@/lib/comentarios';

type Tab = 'pendientes' | 'resueltos' | 'archivados';

function haceCuanto(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
}

// Buzón de comentarios en grande: el globito flotante queda como aviso y anotador rápido; acá se lee todo el
// texto, se busca y se trabaja cada comentario con espacio.
export default function Comentarios() {
  const [activos, setActivos] = useState<Comentario[] | null>(null);
  const [archivados, setArchivados] = useState<Comentario[] | null>(null);
  const [tab, setTab] = useState<Tab>('pendientes');
  const [buscar, setBuscar] = useState('');
  const [viejosPrimero, setViejosPrimero] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aBorrar, setABorrar] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api.get<Comentario[]>('/comentarios').then(setActivos).catch(() => setActivos(a => a ?? []));
    api.get<Comentario[]>('/comentarios?archivados=1').then(setArchivados).catch(() => setArchivados(a => a ?? []));
  }, []);
  useEffect(() => {
    cargar();
    window.addEventListener(EVENTO_COMENTARIOS, cargar);
    return () => window.removeEventListener(EVENTO_COMENTARIOS, cargar);
  }, [cargar]);

  const pendientes = activos?.filter(c => !c.resuelto) ?? [];
  const resueltos = activos?.filter(c => c.resuelto) ?? [];
  const deTab = tab === 'pendientes' ? pendientes : tab === 'resueltos' ? resueltos : (archivados ?? []);
  const cargando = tab === 'archivados' ? !archivados : !activos;
  const q = buscar.trim().toLowerCase();
  const filas = deTab
    .filter(c => !q || c.texto.toLowerCase().includes(q) || (c.created_by_nombre ?? '').toLowerCase().includes(q))
    .sort((a, b) => (viejosPrimero ? 1 : -1) * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

  async function accion(fn: () => Promise<unknown>, error: string) {
    try { await fn(); avisarCambioComentarios(); } catch { toast.error(error); }
  }

  async function agregar() {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      await api.post('/comentarios', { texto: texto.trim() });
      setTexto('');
      setTab('pendientes');
      avisarCambioComentarios();
    } catch { toast.error('No se pudo guardar el comentario'); }
    finally { setEnviando(false); }
  }

  const TABS: { value: Tab; label: string; count?: number }[] = [
    { value: 'pendientes', label: 'Pendientes', count: pendientes.length },
    { value: 'resueltos',  label: 'Resueltos',  count: resueltos.length },
    { value: 'archivados', label: 'Archivados', count: archivados?.length },
  ];
  const btn = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-semibold transition-colors';

  return (
    <div className="p-3 sm:p-4 xl:p-6 space-y-4 max-w-[1100px] mx-auto" data-section="buzon">
      <SectionHero section="buzon" icon={StickyNote} title="Buzón de comentarios"
        sub="Pendientes, ideas y avisos del equipo. El globito de abajo a la izquierda queda como aviso rápido." />

      <CompactStatsBar items={[
        { value: pendientes.length, label: 'pendientes', color: pendientes.length ? '#fcd34d' : '#ffffff' },
        { value: resueltos.length, label: 'resueltos', color: '#ffffff' },
        { value: archivados?.length ?? 0, label: 'archivados', color: '#ffffff' },
      ]} />

      <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4 space-y-2">
        <label htmlFor="nuevo-comentario" className="text-xs font-bold text-gray-700">Nuevo comentario</label>
        <textarea id="nuevo-comentario" value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) agregar(); }}
          rows={4} placeholder="Escribí lo que haya que revisar, corregir o recordar…"
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-300 resize-y" />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] text-gray-500 hidden sm:block">Ctrl + Enter para guardar</p>
          <button onClick={agregar} disabled={enviando || !texto.trim()}
            className="ml-auto inline-flex items-center gap-2 h-11 sm:h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold">
            <Send size={15} /> {enviando ? 'Guardando…' : 'Guardar comentario'}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex gap-1 flex-wrap">
          {TABS.map(x => (
            <button key={x.value} onClick={() => { setTab(x.value); setABorrar(null); }} aria-pressed={tab === x.value}
              className={cn('flex items-center gap-1.5 px-3 h-10 rounded-lg text-xs font-semibold border whitespace-nowrap',
                tab === x.value ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-200 hover:border-amber-400')}>
              {x.label}
              {x.count !== undefined && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold', tab === x.value ? 'bg-white/25' : 'bg-amber-100 text-amber-800')}>{x.count}</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar texto o autor"
              className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-lg text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <button onClick={() => setViejosPrimero(v => !v)} title="Cambiar el orden"
            className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:border-amber-400">
            <ArrowDownUp size={14} /> {viejosPrimero ? 'Más viejos' : 'Más nuevos'}
          </button>
        </div>
      </div>

      <div className="space-y-3" data-testid="lista-comentarios">
        {cargando ? (
          <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : filas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-300 py-12 text-center">
            <Inbox size={28} className="mx-auto text-gray-400" />
            <p className="mt-2 text-sm font-semibold text-gray-700">
              {q ? 'Ningún comentario coincide con la búsqueda' : tab === 'pendientes' ? 'No hay comentarios pendientes' : tab === 'resueltos' ? 'No hay comentarios resueltos' : 'No hay comentarios archivados'}
            </p>
          </div>
        ) : filas.map(c => (
          <article key={c.id} className="bg-white rounded-2xl border border-gray-300 shadow-sm p-4 border-l-[6px]"
            style={{ borderLeftColor: c.archivado ? '#9ca3af' : c.resuelto ? '#10b981' : '#fbbf24' }}>
            <p className={cn('text-[15px] leading-relaxed whitespace-pre-wrap break-words', c.resuelto ? 'text-gray-600' : 'text-gray-900')}>{c.texto}</p>
            <div className="mt-3 flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="text-xs text-gray-600 space-y-0.5 flex-1 min-w-0">
                <p><span className="font-semibold text-gray-800">{c.created_by_nombre ?? 'Alguien'}</span> · {fmtFechaComentario(c.created_at, true)} · {haceCuanto(c.created_at)}</p>
                {c.resuelto && (
                  <p className="text-emerald-700">Resuelto por {c.resuelto_by_nombre ?? '—'}{c.resuelto_at ? ` · ${fmtFechaComentario(c.resuelto_at, true)}` : ''}</p>
                )}
                {c.archivado && c.archivado_at && <p>Archivado {fmtFechaComentario(c.archivado_at, true)}</p>}
              </div>
              {aBorrar === c.id ? (
                <div className="flex items-center gap-2 flex-wrap rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <span className="text-xs font-semibold text-red-800">¿Eliminar este comentario? No se puede deshacer.</span>
                  <button onClick={() => { setABorrar(null); accion(() => api.delete(`/comentarios/${c.id}`), 'No se pudo eliminar'); }}
                    className={cn(btn, 'bg-red-600 border-red-600 text-white hover:bg-red-700')}>Eliminar</button>
                  <button onClick={() => setABorrar(null)} className={cn(btn, 'bg-white border-gray-300 text-gray-700')}>Cancelar</button>
                </div>
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  {c.archivado ? (
                    <button onClick={() => accion(() => api.patch(`/comentarios/${c.id}/archivar`, { archivado: false }), 'No se pudo desarchivar')}
                      className={cn(btn, 'bg-white border-gray-300 text-gray-700 hover:border-amber-400')}><ArchiveRestore size={14} /> Desarchivar</button>
                  ) : (
                    <>
                      <button onClick={() => accion(() => api.patch(`/comentarios/${c.id}/resolver`, { resuelto: !c.resuelto }), 'No se pudo actualizar')}
                        className={cn(btn, c.resuelto ? 'bg-white border-gray-300 text-gray-700 hover:border-amber-400' : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700')}>
                        {c.resuelto ? <><RotateCcw size={14} /> Reabrir</> : <><Check size={14} /> Marcar resuelto</>}
                      </button>
                      <button onClick={() => accion(() => api.patch(`/comentarios/${c.id}/archivar`, { archivado: true }), 'No se pudo archivar')}
                        className={cn(btn, 'bg-white border-gray-300 text-gray-700 hover:border-slate-400')}><Archive size={14} /> Archivar</button>
                    </>
                  )}
                  <button onClick={() => setABorrar(c.id)} title="Eliminar"
                    className={cn(btn, 'bg-white border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300')}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
