import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, AlertTriangle, Target, Truck, MessageSquare, Bell, CalendarClock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

/**
 * Avisos que NO se van solos.
 *
 * Los toast de sonner duran 6-8 segundos: si el usuario está en otra pestaña, en el
 * teléfono, o simplemente mirando para otro lado, la novedad se pierde y no queda
 * rastro visible salvo el contador de la campanita. Esto lo reemplaza para los avisos
 * que importan: una tarjeta por novedad, apilada abajo a la derecha, que se queda
 * hasta que alguien le da "Aceptar".
 *
 * No bloquea: no hay backdrop y el contenedor no captura clicks (pointer-events-none),
 * solo las tarjetas. Se puede seguir trabajando con los avisos en pantalla.
 */

export interface AvisoNotif {
  tipo: 'presupuesto' | 'remito' | 'oportunidad' | 'entrega_dia_antes' | 'entrega_hora_antes' | 'compra_demorada';
  id: string;
  numero: string | null;
  precio_total: number | null;
  aprobado_online_at: string | null;
  respuesta_cliente: 'mas_tiempo' | 'consulta' | 'llamada' | 'modificar' | null;
  recepcion_estado: 'con_observaciones' | 'no_conforme' | null;
  recepcion_obs: string | null;
  detalle: string | null;
  data: Record<string, unknown> | null;
  evento_at: string;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
}

type Tono = 'verde' | 'rojo' | 'ambar' | 'violeta' | 'celeste';

const TONOS: Record<Tono, { barra: string; icono: string; chip: string; boton: string }> = {
  verde:   { barra: 'bg-emerald-500', icono: 'text-emerald-600 bg-emerald-100', chip: 'text-emerald-700', boton: 'bg-emerald-600 hover:bg-emerald-700' },
  rojo:    { barra: 'bg-red-500',     icono: 'text-red-600 bg-red-100',         chip: 'text-red-700',     boton: 'bg-red-600 hover:bg-red-700' },
  ambar:   { barra: 'bg-amber-500',   icono: 'text-amber-600 bg-amber-100',     chip: 'text-amber-700',   boton: 'bg-amber-600 hover:bg-amber-700' },
  violeta: { barra: 'bg-violet-500',  icono: 'text-violet-600 bg-violet-100',   chip: 'text-violet-700',  boton: 'bg-violet-600 hover:bg-violet-700' },
  celeste: { barra: 'bg-sky-500',     icono: 'text-sky-600 bg-sky-100',         chip: 'text-sky-700',     boton: 'bg-sky-600 hover:bg-sky-700' },
};

const RESPUESTA_TXT: Record<string, string> = {
  mas_tiempo: 'pidió más tiempo para decidir',
  consulta:   'hizo una consulta sobre la proforma',
  llamada:    'pidió que lo llamen',
  modificar:  'pidió cambios en la proforma',
};

function nombreCliente(c: AvisoNotif['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(' ') || '—';
}

interface Presentacion {
  titulo: string;
  detalle: string;
  cita: string | null;
  tono: Tono;
  Icono: typeof CheckCircle2;
  ruta: string;
  /** Los avisos importantes (cliente respondiendo la proforma) van primero. */
  prioridad: number;
}

/** Traduce una notificación cruda a lo que se muestra en la tarjeta. */
export function presentar(n: AvisoNotif): Presentacion {
  const quien = nombreCliente(n.cliente);
  const proforma = n.numero?.replace(/^OP-/, 'PRO-') ?? '';

  if (n.tipo === 'presupuesto') {
    const rechazadoAt = n.data?.rechazado_online_at as string | null | undefined;
    if (n.aprobado_online_at) {
      return {
        titulo: '¡Proforma aprobada!',
        detalle: `${quien} aprobó ${proforma}${n.precio_total ? ` por ${formatCurrency(Number(n.precio_total))}` : ''}.`,
        cita: null, tono: 'verde', Icono: CheckCircle2,
        ruta: `/presupuestos?id=${n.id}`, prioridad: 0,
      };
    }
    if (rechazadoAt) {
      return {
        titulo: 'Proforma rechazada',
        detalle: `${quien} rechazó ${proforma}.`,
        cita: [n.detalle, n.data?.comentario_rechazo as string | null].filter(Boolean).join(' — ') || null,
        tono: 'rojo', Icono: XCircle,
        ruta: `/presupuestos?id=${n.id}`, prioridad: 0,
      };
    }
    return {
      titulo: 'Respuesta del cliente',
      detalle: `${quien} ${RESPUESTA_TXT[n.respuesta_cliente ?? ''] ?? 'respondió la proforma'} ${proforma}.`,
      cita: null, tono: 'celeste', Icono: MessageSquare,
      ruta: `/presupuestos?id=${n.id}`, prioridad: 1,
    };
  }

  if (n.tipo === 'remito') {
    const noConforme = n.recepcion_estado === 'no_conforme';
    return {
      titulo: noConforme ? 'Remito rechazado por el cliente' : 'Remito recibido con observaciones',
      detalle: `${quien} — ${n.numero ?? ''}`,
      cita: n.recepcion_obs,
      tono: noConforme ? 'rojo' : 'ambar',
      Icono: AlertTriangle, ruta: '/remitos', prioridad: 1,
    };
  }

  if (n.tipo === 'oportunidad') {
    return {
      titulo: 'Toca recontactar',
      detalle: `${quien} — llegó la fecha de recontacto.`,
      cita: n.detalle, tono: 'violeta', Icono: Target,
      ruta: '/crm?foco=oportunidades', prioridad: 2,
    };
  }

  if (n.tipo === 'compra_demorada') {
    const dias = Number(n.data?.dias_demora ?? 0);
    return {
      titulo: 'Compra demorada',
      detalle: `${n.data?.proveedor ?? 'El proveedor'} no entregó ${n.numero ?? ''} — ${dias} día${dias === 1 ? '' : 's'} de atraso.`,
      cita: null, tono: 'ambar', Icono: CalendarClock,
      ruta: `/compras?tab=ordenes&oc=${n.id}`, prioridad: 1,
    };
  }

  if (n.tipo === 'entrega_hora_antes') {
    return {
      titulo: 'Entrega en menos de 1 hora',
      detalle: `${quien}${n.detalle ? ` — programada a las ${n.detalle} hs` : ''} — ${n.numero ?? ''}`,
      cita: null, tono: 'ambar', Icono: Truck, ruta: '/remitos', prioridad: 1,
    };
  }

  return {
    titulo: 'Entrega mañana',
    detalle: `${quien} — preparar ${n.numero ?? ''}`,
    cita: null, tono: 'violeta', Icono: Truck, ruta: '/remitos', prioridad: 2,
  };
}

/** Tipos que abren aviso emergente. El resto queda solo en la campanita. */
const EMERGE: Record<AvisoNotif['tipo'], boolean> = {
  presupuesto:        true,   // aprobación, rechazo y devoluciones del cliente
  remito:             true,   // el cliente objetó la entrega
  entrega_hora_antes: true,
  compra_demorada:    true,   // el proveedor se pasó de la fecha prometida
  oportunidad:        false,
  entrega_dia_antes:  false,
};

const MAX_VISIBLES = 4;

export function AvisosEmergentes() {
  const navigate = useNavigate();
  const [cola, setCola] = useState<AvisoNotif[]>([]);
  const vistosRef = useRef<Set<string>>(new Set());

  const clave = (n: AvisoNotif) => `${n.tipo}-${n.id}`;

  const revisar = useCallback(async () => {
    try {
      const data = await api.get<AvisoNotif[]>('/notificaciones', { silent: true });
      setCola(prev => {
        const yaEnCola = new Set(prev.map(clave));
        let nuevos = data.filter(n =>
          EMERGE[n.tipo] && !yaEnCola.has(clave(n)) && !vistosRef.current.has(clave(n))
        );
        // Las compras demoradas se acumulan (cada OC vencida es una): de a una por vez, si
        // no tapan media pantalla —y los botones de cualquier modal abierto— con la misma
        // novedad repetida. Al aceptar una, la siguiente aparece en el próximo poll.
        if (prev.some(n => n.tipo === 'compra_demorada')) {
          nuevos = nuevos.filter(n => n.tipo !== 'compra_demorada');
        } else {
          const demoras = nuevos.filter(n => n.tipo === 'compra_demorada');
          nuevos = nuevos.filter(n => n.tipo !== 'compra_demorada').concat(demoras.slice(0, 1));
        }
        if (nuevos.length === 0) return prev;
        const orden = (n: AvisoNotif) => presentar(n).prioridad;
        return [...prev, ...nuevos].sort((a, b) => orden(a) - orden(b));
      });
    } catch {
      // silencioso: la campanita ya reporta los errores de red
    }
  }, []);

  useEffect(() => {
    revisar();
    const t = setInterval(revisar, 10_000);
    function alVolver() { if (document.visibilityState === 'visible') revisar(); }
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [revisar]);

  async function aceptar(n: AvisoNotif) {
    const k = clave(n);
    vistosRef.current.add(k);
    setCola(prev => prev.filter(x => clave(x) !== k));
    // Marca esa sola como leída para que no vuelva en el próximo poll ni quede
    // colgada en la campanita. Si falla, el guard de vistosRef evita que reaparezca
    // en esta sesión.
    try {
      await api.patch('/notificaciones/vista', { tipo: n.tipo, id: n.id });
      window.dispatchEvent(new CustomEvent('notificaciones:cambiaron'));
    } catch {
      // silencioso
    }
  }

  function verYAceptar(n: AvisoNotif) {
    const ruta = presentar(n).ruta;
    aceptar(n);
    navigate(ruta);
  }

  if (cola.length === 0) return null;

  const visibles = cola.slice(0, MAX_VISIBLES);
  const restantes = cola.length - visibles.length;

  return (
    // pointer-events-none en el contenedor: los clicks pasan de largo hacia la app.
    // Solo las tarjetas capturan (pointer-events-auto). Así los avisos no bloquean.
    <div
      className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 w-[22rem] max-w-[calc(100vw-2rem)] pointer-events-none print:hidden"
      role="region" aria-label="Avisos pendientes"
    >
      {restantes > 0 && (
        <div className="pointer-events-auto self-end flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-900 text-white text-[11px] font-bold shadow-lg">
          <Bell size={11} /> +{restantes} aviso{restantes > 1 ? 's' : ''} más
        </div>
      )}

      {visibles.map(n => {
        const p = presentar(n);
        const t = TONOS[p.tono];
        return (
          <div key={clave(n)}
            role="alert"
            className="pointer-events-auto rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex animate-in slide-in-from-right-4 fade-in duration-300"
          >
            <div className={cn('w-1.5 shrink-0', t.barra)} />
            <div className="flex-1 min-w-0 p-3">
              <div className="flex items-start gap-2.5">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', t.icono)}>
                  <p.Icono size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-[13px] font-bold leading-tight', t.chip)}>{p.titulo}</p>
                  <p className="text-xs text-gray-700 mt-0.5 leading-snug">{p.detalle}</p>
                  {p.cita && (
                    <p className="text-[11px] text-gray-600 italic mt-1 line-clamp-3">"{p.cita}"</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2.5 justify-end">
                <button type="button" onClick={() => verYAceptar(n)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                  Ver
                </button>
                <button type="button" onClick={() => aceptar(n)}
                  className={cn('px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition-colors', t.boton)}>
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
