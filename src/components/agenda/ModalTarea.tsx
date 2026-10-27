import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Building2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  CATEGORIAS, TIPO_META, TIPOS_TAREA_CLIENTE, type Categoria, type TareaAgenda, type TipoTareaCliente,
  diaAR, horaCorta, nombreClienteDe,
} from '@/lib/agenda';
import { avisarCambio } from './acciones';
import { BuscadorContacto, type Contacto } from './BuscadorContacto';

interface Props {
  tarea?: TareaAgenda | null;   // editar
  onClose: () => void;
  onGuardada?: () => void;
}

// Alta y edición de una tarea cargada a mano: interna de la empresa (comprar insumos, llamar a un
// proveedor, pagar un servicio…) o de un cliente elegido del buscador (llamarlo, visitarlo…). El
// cliente y el proveedor se eligen de la agenda de contactos, nunca escritos a mano. Entra sola en
// el aviso del día el día que vence.
export function ModalTarea({ tarea, onClose, onGuardada }: Props) {
  const [ambito, setAmbito] = useState<'interna' | 'cliente'>(tarea?.ambito ?? 'interna');
  const [cliente, setCliente] = useState<Contacto | null>(tarea?.cliente_id
    ? { id: tarea.cliente_id, nombre: nombreClienteDe(tarea), detalle: tarea.telefono ?? '' } : null);
  const [tipoAccion, setTipoAccion] = useState<TipoTareaCliente>(
    (TIPOS_TAREA_CLIENTE as readonly string[]).includes(tarea?.tipo_accion ?? '') ? tarea!.tipo_accion as TipoTareaCliente : 'llamada');
  const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? '');
  const [vencimiento, setVencimiento] = useState(tarea?.vencimiento ?? diaAR(0));
  const [hora, setHora] = useState(horaCorta(tarea?.hora));
  const [prioridad, setPrioridad] = useState<'alta' | 'normal' | 'baja'>(tarea?.prioridad ?? 'normal');
  const [categoria, setCategoria] = useState<Categoria>(tarea?.categoria ?? 'compras');
  const [proveedor, setProveedor] = useState<Contacto | null>(tarea?.proveedor_id
    ? { id: tarea.proveedor_id, nombre: tarea.proveedor_nombre ?? 'Proveedor', detalle: tarea.proveedor_telefono ?? '' } : null);
  const [notas, setNotas] = useState(tarea?.notas ?? '');
  const [repetir, setRepetir] = useState<string>(tarea?.repetir ?? '');
  const [cadaDias, setCadaDias] = useState(tarea?.repetir_cada_dias ?? 15);
  const [guardando, setGuardando] = useState(false);
  const deCliente = ambito === 'cliente';
  const completa = !!descripcion.trim() && !!vencimiento && (!deCliente || !!cliente);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function guardar() {
    if (!completa || guardando) return;
    setGuardando(true);
    const body = {
      ambito, cliente_id: deCliente ? cliente!.id : null, tipo_accion: deCliente ? tipoAccion : null,
      descripcion: descripcion.trim(), vencimiento, hora: hora || null, prioridad, categoria: deCliente ? null : categoria,
      proveedor_id: proveedor?.id ?? null, notas: notas.trim() || null,
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
    if (!tarea || guardando || !window.confirm('¿Borrar esta tarea?')) return;
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
        role="dialog" aria-modal="true" aria-label={tarea ? 'Editar tarea' : 'Nueva tarea'}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          {deCliente ? <UserRound size={18} className="text-orange-600" /> : <Building2 size={18} className="text-orange-600" />}
          <h2 className="text-base font-bold text-gray-900">{tarea ? 'Editar tarea' : 'Nueva tarea'}</h2>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">¿Para quién es?</p>
            <div className="grid grid-cols-2 gap-1.5">
              {([['interna', 'La empresa', Building2], ['cliente', 'Un cliente', UserRound]] as const).map(([v, l, Icono]) => (
                <button key={v} type="button" onClick={() => setAmbito(v)} aria-pressed={ambito === v} data-testid={`ambito-${v}`}
                  className={cn('flex items-center justify-center gap-1.5 h-10 px-2.5 rounded-lg border text-sm font-semibold transition-colors',
                    ambito === v ? 'border-orange-500 bg-orange-50 text-orange-900 ring-1 ring-orange-400' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
                  <Icono size={15} /> {l}
                </button>
              ))}
            </div>
          </div>

          {deCliente && (
            <div>
              <label className="text-xs font-semibold text-gray-700" htmlFor="ti-cli">Cliente</label>
              <div className="mt-1"><BuscadorContacto id="ti-cli" tipo="cliente" valor={cliente} onChange={setCliente} autoFocus={!tarea} /></div>
              <p className="text-[11px] text-gray-600 mt-1">Si todavía no está cargado, dalo de alta en Clientes y volvé.</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-700" htmlFor="ti-desc">¿Qué hay que hacer?</label>
            <input id="ti-desc" autoFocus={!deCliente} value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={500}
              placeholder={deCliente ? 'Ej.: Llamarlo para confirmar las medidas' : 'Ej.: Comprar burletes y tornillos'} className={cn(campo, 'mt-1')}
              onKeyDown={e => { if (e.key === 'Enter') guardar(); }} />
          </div>

          {deCliente ? (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Tipo</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {TIPOS_TAREA_CLIENTE.map(k => {
                  const m = TIPO_META[k];
                  const Icono = m.icon;
                  return (
                    <button key={k} type="button" onClick={() => setTipoAccion(k)} aria-pressed={tipoAccion === k}
                      className={cn('flex items-center gap-1.5 h-10 px-2.5 rounded-lg border text-xs font-semibold text-left transition-colors',
                        tipoAccion === k ? 'border-orange-500 bg-orange-50 text-orange-900 ring-1 ring-orange-400' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
                      <Icono size={14} className={m.color} /> <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
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
          )}

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
            <div className="mt-1"><BuscadorContacto id="ti-prov" tipo="proveedor" valor={proveedor} onChange={setProveedor} /></div>
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
          <button onClick={guardar} disabled={!completa || guardando}
            className="h-10 px-5 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2">
            {guardando && <Loader2 size={15} className="animate-spin" />} {tarea ? 'Guardar' : 'Agendar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
