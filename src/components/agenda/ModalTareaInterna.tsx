import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CATEGORIAS, type Categoria, type TareaAgenda, diaAR, horaCorta } from '@/lib/agenda';
import { avisarCambio } from './acciones';

interface Proveedor { id: string; nombre: string; activo?: boolean }

interface Props {
  tarea?: TareaAgenda | null;   // editar
  onClose: () => void;
  onGuardada?: () => void;
}

// Alta y edición de una tarea interna de la empresa (comprar insumos, llamar a un proveedor,
// pagar un servicio…). Entra sola en el aviso del día el día que vence.
export function ModalTareaInterna({ tarea, onClose, onGuardada }: Props) {
  const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? '');
  const [vencimiento, setVencimiento] = useState(tarea?.vencimiento ?? diaAR(0));
  const [hora, setHora] = useState(horaCorta(tarea?.hora));
  const [prioridad, setPrioridad] = useState<'alta' | 'normal' | 'baja'>(tarea?.prioridad ?? 'normal');
  const [categoria, setCategoria] = useState<Categoria>(tarea?.categoria ?? 'compras');
  const [proveedorId, setProveedorId] = useState(tarea?.proveedor_id ?? '');
  const [notas, setNotas] = useState(tarea?.notas ?? '');
  const [repetir, setRepetir] = useState<string>(tarea?.repetir ?? '');
  const [cadaDias, setCadaDias] = useState(tarea?.repetir_cada_dias ?? 15);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get<Proveedor[]>('/catalogo/proveedores').then(ps => setProveedores(ps.filter(p => p.activo !== false))).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function guardar() {
    if (!descripcion.trim() || !vencimiento || guardando) return;
    setGuardando(true);
    const body = {
      descripcion: descripcion.trim(), vencimiento, hora: hora || null, prioridad, categoria,
      proveedor_id: proveedorId || null, notas: notas.trim() || null,
      repetir: repetir || null, repetir_cada_dias: repetir === 'dias' ? Number(cadaDias) : null,
    };
    try {
      if (tarea) await api.put(`/agenda/tareas/${tarea.id}`, body);
      else await api.post('/agenda/tareas', body);
      toast.success(tarea ? 'Tarea actualizada' : 'Tarea agendada');
      avisarCambio();
      onGuardada?.();
      onClose();
    } catch (e) {
      toast.error('No se pudo guardar la tarea', { description: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!tarea || guardando || !window.confirm('¿Borrar esta tarea interna?')) return;
    setGuardando(true);
    try {
      await api.delete(`/agenda/tareas/${tarea.id}`);
      toast.success('Tarea borrada');
      avisarCambio();
      onGuardada?.();
      onClose();
    } catch (e) {
      toast.error('No se pudo borrar', { description: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  const campo = 'w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400';
  const diaMes = Number(vencimiento.slice(8, 10));

  // Portal al body: abierto desde una página, quedaría dentro del contexto de apilamiento del
  // contenido y la barra lateral o el buzón le pasarían por encima.
  return createPortal(
    <div className="fixed inset-0 z-[9100] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={tarea ? 'Editar tarea interna' : 'Nueva tarea interna'}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          <Building2 size={18} className="text-orange-600" />
          <h2 className="text-base font-bold text-gray-900">{tarea ? 'Editar tarea interna' : 'Nueva tarea interna'}</h2>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-gray-700" htmlFor="ti-desc">¿Qué hay que hacer?</label>
            <input id="ti-desc" autoFocus value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={500}
              placeholder="Ej.: Comprar burletes y tornillos" className={cn(campo, 'mt-1')}
              onKeyDown={e => { if (e.key === 'Enter') guardar(); }} />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Categoría</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(Object.keys(CATEGORIAS) as Categoria[]).map(k => {
                const m = CATEGORIAS[k];
                const Icono = m.icon;
                return (
                  <button key={k} type="button" onClick={() => setCategoria(k)} aria-pressed={categoria === k}
                    className={cn('flex items-center gap-1.5 h-10 px-2.5 rounded-lg border text-xs font-semibold text-left transition-colors',
                      categoria === k ? 'border-orange-500 bg-orange-50 text-orange-900 ring-1 ring-orange-400' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
                    <Icono size={14} className={m.color} /> <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700" htmlFor="ti-fecha">Fecha</label>
              <input id="ti-fecha" type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} className={cn(campo, 'mt-1')} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700" htmlFor="ti-hora">Hora <span className="font-normal text-gray-500">(opcional)</span></label>
              <input id="ti-hora" type="time" value={hora} onChange={e => setHora(e.target.value)} className={cn(campo, 'mt-1')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700" htmlFor="ti-prio">Prioridad</label>
              <select id="ti-prio" value={prioridad} onChange={e => setPrioridad(e.target.value as typeof prioridad)} className={cn(campo, 'mt-1')}>
                <option value="alta">Urgente</option>
                <option value="normal">Normal</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700" htmlFor="ti-rep">Se repite</label>
              <select id="ti-rep" value={repetir} onChange={e => setRepetir(e.target.value)} className={cn(campo, 'mt-1')}>
                <option value="">No se repite</option>
                <option value="semanal">Cada semana</option>
                <option value="mensual">Cada mes (día {diaMes})</option>
                <option value="dias">Cada N días</option>
              </select>
            </div>
          </div>
          {repetir === 'dias' && (
            <div className="flex items-center gap-2 text-sm">
              <span>Cada</span>
              <input type="number" min={1} max={365} value={cadaDias} onChange={e => setCadaDias(Number(e.target.value))}
                aria-label="Cada cuántos días" className={cn(campo, 'w-24')} />
              <span>días</span>
            </div>
          )}
          {repetir && <p className="text-[11px] text-gray-600 -mt-2">Al marcarla como hecha, el sistema agenda sola la próxima.</p>}

          <div>
            <label className="text-xs font-semibold text-gray-700" htmlFor="ti-prov">Proveedor <span className="font-normal text-gray-500">(opcional)</span></label>
            <select id="ti-prov" value={proveedorId} onChange={e => setProveedorId(e.target.value)} className={cn(campo, 'mt-1')}>
              <option value="">— Ninguno —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700" htmlFor="ti-notas">Nota <span className="font-normal text-gray-500">(opcional)</span></label>
            <textarea id="ti-notas" value={notas} onChange={e => setNotas(e.target.value)} rows={2} maxLength={2000}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex gap-2 justify-end">
          {tarea && (
            <button onClick={borrar} disabled={guardando}
              className="mr-auto h-10 px-3 rounded-lg text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Borrar
            </button>
          )}
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} disabled={!descripcion.trim() || !vencimiento || guardando}
            className="h-10 px-5 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2">
            {guardando && <Loader2 size={15} className="animate-spin" />} {tarea ? 'Guardar' : 'Agendar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
