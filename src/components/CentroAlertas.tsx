import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRing, Check, Phone, MessageCircle, Package, Zap, ShoppingBag,
  Cake, RefreshCw, Users, Target, Clock, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TareaAgenda {
  id: string;
  descripcion: string;
  tipo_accion: string | null;
  hora: string | null;
  prioridad: 'alta' | 'normal' | 'baja';
  vencimiento: string;
  operacion_id: string | null;
  cliente_id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  telefono: string | null;
}

interface Agenda { vencidas: TareaAgenda[]; hoy: TareaAgenda[] }

const TIPO_ICON: Record<string, React.ReactNode> = {
  llamada:     <Phone size={13} className="text-sky-600" />,
  whatsapp:    <MessageCircle size={13} className="text-green-600" />,
  entrega:     <Package size={13} className="text-violet-600" />,
  instalacion: <Zap size={13} className="text-amber-600" />,
  cobranza:    <ShoppingBag size={13} className="text-rose-600" />,
  cumpleanos:  <Cake size={13} className="text-pink-600" />,
  seguimiento: <RefreshCw size={13} className="text-gray-600" />,
  visita:      <Users size={13} className="text-indigo-600" />,
  oportunidad: <Target size={13} className="text-fuchsia-600" />,
};

function nombreCliente(t: TareaAgenda): string {
  if (t.tipo_persona === 'juridica') return t.razon_social ?? '—';
  return [t.apellido, t.nombre].filter(Boolean).join(' ') || '—';
}

// Centro de alertas del Dashboard: junta en un solo lugar, bien visible, todo lo
// que hay programado y que si no se tiene presente se pasa — contactos, entregas,
// visitas, cobranzas, etc. Se apoya 100% en `tareas` (GET /tareas/agenda), que ya
// es la agenda unificada: oportunidades futuras y entregas programadas ya se
// reflejan ahí como tareas espejo (tipo_accion='oportunidad'/'entrega'), así que
// no hace falta agregar ninguna fuente de datos nueva — solo darle visibilidad.
export function CentroAlertas() {
  const navigate = useNavigate();
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [completando, setCompletando] = useState<string | null>(null);

  useEffect(() => {
    api.get<Agenda>('/tareas/agenda')
      .then(r => setAgenda({ vencidas: r.vencidas, hoy: r.hoy }))
      .catch(() => setAgenda({ vencidas: [], hoy: [] }))
      .finally(() => setLoading(false));
  }, []);

  async function completar(t: TareaAgenda) {
    setCompletando(t.id);
    try {
      await api.patch(`/tareas/${t.id}/completar`, { completada: true });
      setAgenda(prev => prev && {
        vencidas: prev.vencidas.filter(x => x.id !== t.id),
        hoy: prev.hoy.filter(x => x.id !== t.id),
      });
    } catch {
      toast.error('No se pudo marcar como hecho');
    } finally {
      setCompletando(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-400 shadow-lg p-4 bg-white flex items-center justify-center h-16">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const total = (agenda?.vencidas.length ?? 0) + (agenda?.hoy.length ?? 0);

  if (!agenda || total === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 shadow-md px-5 py-3.5 flex items-center gap-3">
        <Check size={18} className="text-emerald-600 shrink-0" />
        <p className="text-sm font-semibold text-emerald-700">Al día — nada programado pendiente para hoy</p>
      </div>
    );
  }

  const filas = [
    ...agenda.vencidas.map(t => ({ ...t, vencida: true })),
    ...agenda.hoy.map(t => ({ ...t, vencida: false })),
  ];

  return (
    <div className="rounded-2xl border-2 border-red-300 shadow-xl overflow-hidden">
      <div className="px-5 py-3 flex items-center gap-2.5"
        style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ea580c 100%)' }}>
        <BellRing size={18} className="text-white shrink-0" />
        <h2 className="text-sm font-extrabold text-white uppercase tracking-wide">Centro de alertas</h2>
        <span className="text-[11px] font-bold text-white/90 bg-white/20 px-2 py-0.5 rounded-full">
          {total} pendiente{total !== 1 ? 's' : ''}
        </span>
        {agenda.vencidas.length > 0 && (
          <span className="ml-auto text-[11px] font-extrabold text-white bg-black/25 px-2.5 py-1 rounded-full animate-pulse">
            {agenda.vencidas.length} vencida{agenda.vencidas.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="bg-white divide-y divide-gray-200 max-h-[340px] overflow-y-auto">
        {filas.map(t => (
          <div key={t.id}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 transition-colors',
              t.vencida ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-amber-50/50'
            )}>
            <div className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
              t.vencida ? 'bg-red-100' : 'bg-amber-100'
            )}>
              {t.tipo_accion ? (TIPO_ICON[t.tipo_accion] ?? <Clock size={13} className="text-gray-500" />) : <Clock size={13} className="text-gray-500" />}
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/clientes/${t.cliente_id}`)}>
              <p className="text-xs font-bold text-gray-800 truncate">{nombreCliente(t)}</p>
              <p className="text-[11px] text-gray-600 truncate">{t.descripcion}</p>
            </div>
            <div className="shrink-0 text-right">
              {t.vencida ? (
                <span className="text-[10px] font-bold text-red-600 uppercase">Vencida</span>
              ) : t.hora ? (
                <span className="text-[11px] font-bold text-amber-700 tabular-nums">{t.hora.slice(0, 5)}hs</span>
              ) : (
                <span className="text-[10px] font-semibold text-amber-600">Hoy</span>
              )}
            </div>
            <button type="button" onClick={() => completar(t)} disabled={completando === t.id}
              title="Marcar como hecho"
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors">
              {completando === t.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
