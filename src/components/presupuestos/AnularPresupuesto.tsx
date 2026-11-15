import { useState } from 'react';
import { Ban, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';
import { MOTIVOS_ANULACION } from '@/lib/anulacion';

const labelMotivo = (v: string | null | undefined) => MOTIVOS_ANULACION.find(m => m.valor === v)?.label ?? 'Sin motivo registrado';

const ESTADO_TXT: Record<string, string> = {
  presupuesto: 'Pendiente de Aprobación', enviado: 'Enviado', aprobado: 'Aprobado', rechazado: 'Rechazado',
  en_produccion: 'En producción', listo: 'Listo',
};

/** Cartel del presupuesto anulado: quién, cuándo, motivo y detalle. */
export function BannerAnulado({ op }: {
  op: { anulado_at?: string | null; anulado_por_nombre?: string | null; anulacion_motivo?: string | null;
        anulacion_detalle?: string | null; anulado_desde?: string | null };
}) {
  return (
    <div data-testid="banner-anulado" className="mx-5 my-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3">
      <div className="flex items-center gap-2 text-red-700">
        <Ban size={16} />
        <p className="text-sm font-bold">Presupuesto anulado</p>
      </div>
      {op.anulado_at ? (
        <div className="mt-1.5 space-y-0.5 text-xs text-red-800">
          <p>
            {new Date(op.anulado_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {op.anulado_por_nombre ? ` · por ${op.anulado_por_nombre}` : ''}
            {op.anulado_desde ? ` · estaba ${ESTADO_TXT[op.anulado_desde] ?? op.anulado_desde}` : ''}
          </p>
          <p><span className="font-semibold">Motivo:</span> {labelMotivo(op.anulacion_motivo)}</p>
          {op.anulacion_detalle && <p className="whitespace-pre-wrap"><span className="font-semibold">Detalle:</span> {op.anulacion_detalle}</p>}
        </div>
      ) : (
        <p className="mt-1 text-xs text-red-700">Cancelado antes de que existiera el registro de anulación (sin motivo guardado).</p>
      )}
    </div>
  );
}

/** Botón + confirmación con motivo y detalle. */
export function AnularPresupuesto({ id, numero, onAnulado }: { id: string; numero: string; onAnulado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const faltaDetalle = motivo === 'otro' && detalle.trim().length < 5;

  async function anular() {
    setEnviando(true);
    try {
      const r = await api.post<{ visitas_liberadas: string[] }>(`/operaciones/${id}/anular`, { motivo, detalle: detalle.trim() || undefined });
      toast.success(`${numero} anulado` + (r.visitas_liberadas.length ? ` · visita ${r.visitas_liberadas.join(', ')} liberada para otro presupuesto` : ''));
      setAbierto(false);
      onAnulado();
    } catch (e) {
      toastApiError(e, { fallback: 'No se pudo anular el presupuesto' });
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button data-testid="btn-anular" onClick={() => setAbierto(true)}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium transition-colors">
        <Ban size={11} /> Anular presupuesto
      </button>
    );
  }
  return (
    <div className="w-full p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
      <div className="flex items-center gap-2 text-red-700">
        <AlertTriangle size={16} />
        <p className="text-sm font-semibold">¿Anular {numero}?</p>
      </div>
      <p className="text-xs text-red-600">
        Queda como <b>Anulado</b> con el motivo y no se puede aprobar ni enviar. Se libera el stock reservado, se cierran sus
        tareas pendientes y, si salió de una visita de relevamiento, la visita queda libre para armar el presupuesto correcto.
        No se puede si tiene recibos, pedidos al proveedor, remitos o facturas: primero hay que anular esos documentos.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {MOTIVOS_ANULACION.map(m => (
          <button key={m.valor} type="button" onClick={() => setMotivo(m.valor)}
            className={cn('h-11 sm:h-9 px-3 text-left text-sm rounded-lg border transition-colors',
              motivo === m.valor ? 'bg-red-600 text-white border-red-600 font-semibold' : 'bg-white text-gray-700 border-gray-300 hover:border-red-300')}>
            {m.label}
          </button>
        ))}
      </div>
      <textarea value={detalle} onChange={e => setDetalle(e.target.value)} rows={3} maxLength={1000}
        placeholder={motivo === 'otro' ? 'Contá por qué se anula (obligatorio)' : 'Detalle (opcional): qué pasó, con qué presupuesto se reemplaza, etc.'}
        className="w-full text-base sm:text-sm rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-200" />
      <div className="flex gap-2">
        <button onClick={anular} disabled={!motivo || faltaDetalle || enviando} data-testid="confirmar-anular"
          className="flex-1 h-11 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
          {enviando ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Sí, anular'}
        </button>
        <button onClick={() => { setAbierto(false); setMotivo(''); setDetalle(''); }}
          className="flex-1 h-11 border border-gray-200 bg-white text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">
          No, volver
        </button>
      </div>
    </div>
  );
}
