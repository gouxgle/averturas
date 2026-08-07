import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, AlertTriangle, Target, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface Notif {
  tipo: 'presupuesto' | 'remito' | 'oportunidad';
  id: string; numero: string | null; precio_total: number | null;
  aprobado_online_at: string | null;
  respuesta_cliente: 'mas_tiempo' | 'consulta' | 'llamada' | 'modificar' | null;
  recepcion_estado: 'con_observaciones' | 'no_conforme' | null;
  recepcion_obs: string | null;
  detalle: string | null;
  evento_at: string;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
}

const OPORTUNIDAD_NOTIF = { texto: 'volvió la fecha de recontacto', color: '#f0abfc', bg: 'rgba(217,70,239,0.15)' };

const IR_A_NOTIF: Record<Notif['tipo'], (n: Notif) => string> = {
  remito:       () => '/remitos',
  oportunidad:  () => '/crm?foco=oportunidades',
  presupuesto:  n  => `/presupuestos?id=${n.id}`,
};

const RESP_NOTIF: Record<string, { texto: string; color: string; bg: string }> = {
  mas_tiempo: { texto: 'pidió más tiempo',        color: '#7dd3fc', bg: 'rgba(56,189,248,0.15)' },
  consulta:   { texto: 'hizo una consulta',       color: '#67e8f9', bg: 'rgba(34,211,238,0.15)' },
  llamada:    { texto: 'pidió que lo llamen',     color: '#86efac', bg: 'rgba(34,197,94,0.15)' },
  modificar:  { texto: 'pidió modificar la propuesta', color: '#c4b5fd', bg: 'rgba(139,92,246,0.15)' },
};

const REMITO_NOTIF: Record<string, { texto: string; color: string; bg: string }> = {
  con_observaciones: { texto: 'recibió el remito con observaciones', color: '#fcd34d', bg: 'rgba(251,191,36,0.15)' },
  no_conforme:        { texto: 'rechazó la recepción del remito',     color: '#fca5a5', bg: 'rgba(248,113,113,0.15)' },
};

function nombreCliente(c: Notif['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(' ') || '—';
}

function fmtRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'Ahora mismo';
  if (min < 60) return `Hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24)  return `Hace ${hs} h`;
  const ds = Math.floor(hs / 24);
  return `Hace ${ds} d`;
}

export function NotificationBell() {
  const navigate  = useNavigate();
  const [notifs, setNotifs]   = useState<Notif[]>([]);
  const [open, setOpen]       = useState(false);
  const [marcando, setMarcando] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevIdsRef   = useRef<Set<string>>(new Set());
  const inicializado = useRef(false);

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await api.get<Notif[]>('/notificaciones');
      setNotifs(data);
      const claveDe = (n: Notif) => `${n.tipo}-${n.id}`;
      if (!inicializado.current) {
        // Primera carga: solo registrar claves actuales sin disparar evento
        prevIdsRef.current = new Set(data.map(claveDe));
        inicializado.current = true;
      } else {
        // Cargas siguientes: detectar claves genuinamente nuevas
        const nuevas = data.filter(n => !prevIdsRef.current.has(claveDe(n)));
        const nuevosPresupuestos = nuevas.filter(n => n.tipo === 'presupuesto');
        const nuevosRemitos = nuevas.filter(n => n.tipo === 'remito');
        const nuevasOportunidades = nuevas.filter(n => n.tipo === 'oportunidad');
        if (nuevosPresupuestos.length > 0) {
          window.dispatchEvent(new CustomEvent('presupuesto:aprobado-online', {
            detail: { nuevas: nuevosPresupuestos }
          }));
        }
        nuevosRemitos.forEach(n => {
          const rm = n.recepcion_estado ? REMITO_NOTIF[n.recepcion_estado] : null;
          toast.warning(`Remito ${n.numero}${rm ? ` — ${rm.texto}` : ' con novedades en la recepción'}`, {
            description: 'Revisalo en Remitos',
            duration: 6000,
          });
        });
        nuevasOportunidades.forEach(n => {
          toast.info(`Oportunidad futura: ${nombreCliente(n.cliente)}`, {
            description: n.detalle ?? 'Llegó la fecha de recontacto',
            duration: 6000,
          });
        });
        prevIdsRef.current = new Set(data.map(claveDe));
      }
    } catch {
      // silencioso
    }
  }, []);

  // Poll cada 10s + recargar al volver al tab
  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, 10_000);
    function handleVisibility() { if (document.visibilityState === 'visible') fetchNotifs(); }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [fetchNotifs]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleOpen() {
    setOpen(v => !v);
  }

  async function marcarLeidas() {
    if (marcando || notifs.length === 0) return;
    setMarcando(true);
    try {
      await api.patch('/notificaciones/marcar-leidas');
      setNotifs([]);
    } finally {
      setMarcando(false);
    }
  }

  function irANotif(n: Notif) {
    setOpen(false);
    navigate(IR_A_NOTIF[n.tipo](n));
  }

  const count = notifs.length;

  return (
    <div ref={panelRef} className="relative">
      {/* Botón campanita */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl transition-colors hover:bg-white/10"
        title="Notificaciones"
        aria-label="Notificaciones"
      >
        <Bell size={18} style={{ color: count > 0 ? '#fbbf24' : 'rgba(255,255,255,0.55)' }} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: '#e31e24' }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Panel dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl overflow-hidden border border-white/10"
          style={{ backgroundColor: '#0a2761', zIndex: 100 }}>

          {/* Header panel */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-amber-400" />
              <span className="text-xs font-bold text-white">Notificaciones</span>
              {count > 0 && (
                <span className="text-[10px] font-semibold text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                  {count} nueva{count > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button
                  onClick={marcarLeidas}
                  disabled={marcando}
                  className="text-[10px] text-white/40 hover:text-white/70 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Marcar leídas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <X size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto">
            {count === 0 ? (
              <div className="px-4 py-10 text-center">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500/60" />
                <p className="text-xs text-white/40">Sin notificaciones pendientes</p>
              </div>
            ) : (
              notifs.map(n => {
                const esRemito = n.tipo === 'remito';
                const esOportunidad = n.tipo === 'oportunidad';
                const rm = esRemito && n.recepcion_estado ? REMITO_NOTIF[n.recepcion_estado] : null;
                const esRespuesta = !esRemito && !esOportunidad && !n.aprobado_online_at && n.respuesta_cliente && RESP_NOTIF[n.respuesta_cliente];
                const rc = esRespuesta ? RESP_NOTIF[n.respuesta_cliente!] : null;
                const acento = rm ?? rc ?? (esOportunidad ? OPORTUNIDAD_NOTIF : null);
                return (
                <button
                  key={`${n.tipo}-${n.id}`}
                  onClick={() => irANotif(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  {/* Icono */}
                  <div className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: acento ? acento.bg : 'rgba(34,197,94,0.15)' }}>
                    {rm
                      ? <AlertTriangle size={16} style={{ color: rm.color }} />
                      : esOportunidad
                      ? <Target size={16} style={{ color: OPORTUNIDAD_NOTIF.color }} />
                      : <CheckCircle2 size={16} style={{ color: acento ? acento.color : '#34d399' }} />}
                  </div>
                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white leading-snug">
                      {nombreCliente(n.cliente)}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.50)' }}>
                      {rm ? <>{rm.texto} — <span className="font-mono" style={{ color: rm.color }}>{n.numero}</span></>
                       : esOportunidad ? <>{OPORTUNIDAD_NOTIF.texto}</>
                       : rc ? <>{rc.texto} — <span className="font-mono" style={{ color: rc.color }}>{n.numero}</span></>
                          : <>Aprobó el presupuesto <span className="font-mono text-emerald-400">{n.numero}</span></>}
                    </p>
                    {rm && n.recepcion_obs && (
                      <p className="text-[10px] mt-1 italic line-clamp-2" style={{ color: 'rgba(255,255,255,0.40)' }}>
                        "{n.recepcion_obs}"
                      </p>
                    )}
                    {esOportunidad && n.detalle && (
                      <p className="text-[10px] mt-1 italic line-clamp-2" style={{ color: 'rgba(255,255,255,0.40)' }}>
                        "{n.detalle}"
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {!acento && (
                        <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
                          {formatCurrency(Number(n.precio_total))}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
                        {fmtRelativo(n.evento_at)}
                      </span>
                    </div>
                  </div>
                </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
