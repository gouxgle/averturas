import { useState, useEffect, useCallback } from 'react';
import { Activity, Search, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, TZ_AR } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Evento {
  id: string;
  entidad: 'presupuesto' | 'recibo' | 'remito' | string;
  entidad_id: string | null;
  entidad_numero: string | null;
  accion: string;
  detalle: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  usuario_id: string | null;
  usuario_nombre: string;
}

interface Operador { id: string; nombre: string }

// ── Config visual ─────────────────────────────────────────────────────────────

const ENTIDAD_LABEL: Record<string, string> = {
  presupuesto: 'Presupuesto',
  recibo: 'Recibo',
  remito: 'Remito',
};

const ACCION_CFG: Record<string, { label: string; cls: string }> = {
  crear:         { label: 'Creó',           cls: 'bg-emerald-100 text-emerald-700' },
  editar:        { label: 'Editó',          cls: 'bg-sky-100 text-sky-700' },
  cambio_estado: { label: 'Cambió estado',  cls: 'bg-amber-100 text-amber-700' },
  emitir:        { label: 'Emitió',         cls: 'bg-indigo-100 text-indigo-700' },
  entregar:      { label: 'Entregó',        cls: 'bg-teal-100 text-teal-700' },
  anular:        { label: 'Anuló',          cls: 'bg-red-100 text-red-600' },
  cancelar:      { label: 'Canceló',        cls: 'bg-red-100 text-red-600' },
  eliminar:      { label: 'Eliminó',        cls: 'bg-red-100 text-red-600' },
  venta_rapida:  { label: 'Venta rápida',   cls: 'bg-emerald-100 text-emerald-700' },
  extender_validez: { label: 'Extendió validez', cls: 'bg-sky-100 text-sky-700' },
};

function accionCfg(a: string) {
  return ACCION_CFG[a] ?? { label: a.replace(/_/g, ' '), cls: 'bg-gray-100 text-gray-600' };
}

const ENTIDAD_FILTROS: { v: string; l: string }[] = [
  { v: '', l: 'Todo' },
  { v: 'presupuesto', l: 'Presupuestos' },
  { v: 'recibo', l: 'Recibos' },
  { v: 'remito', l: 'Remitos' },
];

const PAGE = 50;

function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: TZ_AR,
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Página ────────────────────────────────────────────────────────────────────

export function Actividad() {
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);

  // Filtros
  const [usuarioId, setUsuarioId] = useState('');
  const [entidad, setEntidad] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');

  useEffect(() => {
    api.get<Operador[]>('/actividad/operadores').then(setOperadores).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const construirQuery = useCallback((offset: number) => {
    const p = new URLSearchParams();
    if (usuarioId) p.set('usuario_id', usuarioId);
    if (entidad) p.set('entidad', entidad);
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    if (qDebounced) p.set('q', qDebounced);
    p.set('limit', String(PAGE));
    p.set('offset', String(offset));
    return p.toString();
  }, [usuarioId, entidad, desde, hasta, qDebounced]);

  useEffect(() => {
    setLoading(true);
    api.get<{ rows: Evento[]; total: number }>(`/actividad?${construirQuery(0)}`)
      .then(r => { setEventos(r.rows); setTotal(r.total); })
      .catch(() => { setEventos([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [construirQuery]);

  function cargarMas() {
    setCargandoMas(true);
    api.get<{ rows: Evento[]; total: number }>(`/actividad?${construirQuery(eventos.length)}`)
      .then(r => { setEventos(prev => [...prev, ...r.rows]); setTotal(r.total); })
      .catch(() => {})
      .finally(() => setCargandoMas(false));
  }

  const inputCls = 'px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400';

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-5xl mx-auto space-y-5" data-section="reportes">
      <SectionHero
        section="reportes"
        icon={Activity}
        title="Actividad de operadores"
        sub="Quién hizo qué en presupuestos, recibos y remitos — incluye cada modificación de presupuesto"
      />

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-600">Operador</label>
            <select value={usuarioId} onChange={e => setUsuarioId(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {operadores.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-600">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-600">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-[11px] font-medium text-gray-600">Buscar</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="N° o detalle..."
                className={cn(inputCls, 'w-full pl-7')} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ENTIDAD_FILTROS.map(f => (
            <button key={f.v} onClick={() => setEntidad(f.v)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors',
                entidad === f.v
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
              )}>
              {f.l}
            </button>
          ))}
          {(usuarioId || entidad || desde || hasta || q) && (
            <button onClick={() => { setUsuarioId(''); setEntidad(''); setDesde(''); setHasta(''); setQ(''); }}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 size={20} className="animate-spin text-gray-500" /></div>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-10">Sin actividad registrada para estos filtros.</p>
      ) : (
        <>
          <p className="text-xs text-gray-600">{total} {total === 1 ? 'movimiento' : 'movimientos'}</p>

          {/* Desktop: tabla */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-400 shadow-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="text-left font-semibold px-4 py-2.5">Fecha</th>
                  <th className="text-left font-semibold px-4 py-2.5">Operador</th>
                  <th className="text-left font-semibold px-4 py-2.5">Acción</th>
                  <th className="text-left font-semibold px-4 py-2.5">Documento</th>
                  <th className="text-left font-semibold px-4 py-2.5">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {eventos.map(ev => {
                  const cfg = accionCfg(ev.accion);
                  return (
                    <tr key={ev.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtFechaHora(ev.created_at)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{ev.usuario_nombre}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded', cfg.cls)}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-gray-500">{ENTIDAD_LABEL[ev.entidad] ?? ev.entidad}</span>{' '}
                        <span className="font-medium text-gray-800">{ev.entidad_numero ?? ''}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{ev.detalle ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <div className="md:hidden space-y-2">
            {eventos.map(ev => {
              const cfg = accionCfg(ev.accion);
              return (
                <div key={ev.id} className="bg-white rounded-xl border border-gray-300 shadow-sm p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded', cfg.cls)}>{cfg.label}</span>
                    <span className="text-[11px] text-gray-500">{fmtFechaHora(ev.created_at)}</span>
                  </div>
                  <p className="text-sm mt-1.5">
                    <span className="font-medium text-gray-800">{ev.usuario_nombre}</span>
                    <span className="text-gray-500"> · {ENTIDAD_LABEL[ev.entidad] ?? ev.entidad} </span>
                    <span className="font-medium text-gray-800">{ev.entidad_numero ?? ''}</span>
                  </p>
                  {ev.detalle && <p className="text-xs text-gray-600 mt-0.5">{ev.detalle}</p>}
                </div>
              );
            })}
          </div>

          {eventos.length < total && (
            <div className="flex justify-center pt-1">
              <button onClick={cargarMas} disabled={cargandoMas}
                className="flex items-center gap-1.5 text-sm px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-60">
                {cargandoMas && <Loader2 size={13} className="animate-spin" />}
                Cargar más ({total - eventos.length} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
