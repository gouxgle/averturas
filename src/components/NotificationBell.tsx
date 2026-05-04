import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Notif {
  id: string; numero: string; aprobado_online_at: string; precio_total: number;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
}

function nombreCliente(c: Notif['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.nombre, c.apellido].filter(Boolean).join(' ') || '—';
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

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await api.get<Notif[]>('/notificaciones');
      setNotifs(data);
    } catch {
      // silencioso
    }
  }, []);

  // Poll cada 30s
  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(t);
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

  function irAPresupuesto(id: string) {
    setOpen(false);
    navigate(`/presupuestos?id=${id}`);
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
              notifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => irAPresupuesto(n.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  {/* Icono */}
                  <div className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  </div>
                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white leading-snug">
                      {nombreCliente(n.cliente)}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.50)' }}>
                      Aprobó el presupuesto <span className="font-mono text-emerald-400">{n.numero}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
                        {formatCurrency(Number(n.precio_total))}
                      </span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
                        {fmtRelativo(n.aprobado_online_at)}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
