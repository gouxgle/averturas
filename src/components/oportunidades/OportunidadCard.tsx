import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Clock, Check, X as XIcon, Ban, Loader2, CalendarClock, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn, TZ_AR } from '@/lib/utils';
import { AccionesContacto } from './AccionesContacto';
import { INTERES_CFG, nombreClienteOportunidad, type Oportunidad } from './types';

function fmtFecha(iso: string): string {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', timeZone: TZ_AR });
}

const ATAJOS = [
  { label: '1 mes', meses: 1 },
  { label: '3 meses', meses: 3 },
  { label: '6 meses', meses: 6 },
];
function fechaMasMeses(meses: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Accion = null | 'posponer' | 'concretar' | 'descartar';

export function OportunidadCard({ oportunidad, onUpdate, onEdit }: {
  oportunidad: Oportunidad;
  onUpdate: (op: Oportunidad) => void;
  onEdit: (op: Oportunidad) => void;
}) {
  const navigate = useNavigate();
  const [accion, setAccion] = useState<Accion>(null);
  const [fechaPosponer, setFechaPosponer] = useState(fechaMasMeses(1));
  const [motivoDescarte, setMotivoDescarte] = useState('');
  const [procesando, setProcesando] = useState(false);

  const o = oportunidad;
  const cliente = o.cliente;
  const dias = o.dias_atraso ?? 0;
  const vencida = o.estado === 'pendiente' && dias > 0;
  const esHoy = o.estado === 'pendiente' && dias === 0;

  // Recotizar: si la oportunidad viene de un presupuesto rechazado/vencido,
  // reabre ESE presupuesto (con los ítems ya cargados) en modo edición. Si es
  // una oportunidad "suelta" (sin origen), arranca un presupuesto nuevo con el
  // cliente ya prefijado. En ambos casos, al guardar el presupuesto la
  // oportunidad queda marcada "convertida" y vinculada (ver NuevoPresupuesto.tsx).
  function recotizar() {
    const qs = `oportunidad_id=${o.id}`;
    if (o.operacion_id_origen) navigate(`/presupuestos/${o.operacion_id_origen}/editar?${qs}`);
    else navigate(`/presupuestos/nuevo?cliente_id=${o.cliente_id}&${qs}`);
  }

  async function posponer() {
    setProcesando(true);
    try {
      const actualizada = await api.patch<Oportunidad>(`/oportunidades/${o.id}/posponer`, { fecha_recontacto: fechaPosponer });
      toast.success('Oportunidad pospuesta');
      onUpdate(actualizada);
      setAccion(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo posponer');
    } finally {
      setProcesando(false);
    }
  }

  async function concretar() {
    setProcesando(true);
    try {
      const actualizada = await api.patch<Oportunidad>(`/oportunidades/${o.id}/estado`, { estado: 'convertida' });
      toast.success('¡Oportunidad concretada!');
      onUpdate(actualizada);
      setAccion(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo actualizar');
    } finally {
      setProcesando(false);
    }
  }

  async function descartar() {
    setProcesando(true);
    try {
      const actualizada = await api.patch<Oportunidad>(`/oportunidades/${o.id}/estado`, {
        estado: 'descartada', motivo_cierre: motivoDescarte.trim() || null,
      });
      toast.success('Oportunidad descartada');
      onUpdate(actualizada);
      setAccion(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo actualizar');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className={cn(
      'rounded-xl border p-3 transition-colors',
      vencida ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white hover:border-fuchsia-200'
    )}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center text-[11px] font-bold shrink-0">
          {cliente ? nombreClienteOportunidad(cliente).split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?'}
        </div>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(o)}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-bold text-gray-800 truncate">{cliente ? nombreClienteOportunidad(cliente) : '—'}</p>
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border', INTERES_CFG[o.interes].cls)}>
              {INTERES_CFG[o.interes].emoji} {INTERES_CFG[o.interes].label}
            </span>
            <span className="text-[9px] font-bold text-gray-600">{o.probabilidad}%</span>
          </div>
          <p className="text-[11px] text-gray-600 leading-snug line-clamp-2 mt-0.5">{o.motivo}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <CalendarClock size={10} className={vencida ? 'text-red-500' : esHoy ? 'text-amber-500' : 'text-gray-600'} />
            <span className={cn(
              'text-[10px] font-semibold',
              vencida ? 'text-red-600' : esHoy ? 'text-amber-600' : 'text-gray-600'
            )}>
              {vencida ? `Vencida hace ${dias}d` : esHoy ? 'Hoy' : fmtFecha(o.fecha_recontacto)}
            </span>
            {o.veces_pospuesta > 0 && (
              <span className="text-[9px] text-gray-600">· pospuesta {o.veces_pospuesta}x</span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-0.5">
          <AccionesContacto oportunidad={o} onContactado={onUpdate} />
          <button type="button" onClick={() => onEdit(o)} title="Editar"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
            <Pencil size={13} />
          </button>
        </div>
      </div>

      {accion === null && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-200">
          <button type="button" onClick={() => setAccion('posponer')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-gray-600 hover:bg-gray-100">
            <Clock size={11} /> Posponer
          </button>
          <button type="button" onClick={recotizar}
            title={o.operacion_id_origen ? 'Reabrir el presupuesto original con los mismos ítems' : 'Armar un presupuesto nuevo para este cliente'}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-fuchsia-600 hover:bg-fuchsia-50">
            <RefreshCw size={11} /> Recotizar
          </button>
          <button type="button" onClick={() => setAccion('concretar')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50">
            <Check size={11} /> Se concretó
          </button>
          <button type="button" onClick={() => setAccion('descartar')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-gray-600 hover:bg-red-50 hover:text-red-500">
            <Ban size={11} /> Descartar
          </button>
        </div>
      )}

      {accion === 'posponer' && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input type="date" value={fechaPosponer} onChange={e => setFechaPosponer(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-fuchsia-300" />
            {ATAJOS.map(a => (
              <button key={a.label} type="button" onClick={() => setFechaPosponer(fechaMasMeses(a.meses))}
                className="px-1.5 py-1 rounded-lg border border-gray-200 text-[9px] font-semibold text-gray-600 hover:border-fuchsia-300">
                {a.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setAccion(null)} disabled={procesando}
              className="flex-1 py-1.5 rounded-lg border border-gray-200 text-[10px] font-semibold text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="button" onClick={posponer} disabled={procesando}
              className="flex-1 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 disabled:opacity-50">
              {procesando ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Confirmar
            </button>
          </div>
        </div>
      )}

      {accion === 'concretar' && (
        <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-1.5">
          <p className="flex-1 text-[10px] text-emerald-700 font-semibold">¿Confirmar que se concretó la venta? 🎉</p>
          <button type="button" onClick={() => setAccion(null)} disabled={procesando}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><XIcon size={11} /></button>
          <button type="button" onClick={concretar} disabled={procesando}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
            {procesando ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Confirmar
          </button>
        </div>
      )}

      {accion === 'descartar' && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
          <input value={motivoDescarte} onChange={e => setMotivoDescarte(e.target.value)}
            placeholder="Motivo (opcional)"
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-red-300" />
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setAccion(null)} disabled={procesando}
              className="flex-1 py-1.5 rounded-lg border border-gray-200 text-[10px] font-semibold text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="button" onClick={descartar} disabled={procesando}
              className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold flex items-center justify-center gap-1 disabled:opacity-50">
              {procesando ? <Loader2 size={11} className="animate-spin" /> : <Ban size={11} />} Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
