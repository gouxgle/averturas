import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { cn, fechaDiaAR } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { AdjuntosGrid, DropzoneAdjuntos } from '@/components/Adjuntos';
import {
  TRABAJO_TIPO, ENDPOINT_ADJUNTOS_SERVICIO, ACCEPT_ADJUNTOS_SERVICIO, type Intervencion, type TrabajoTipo, type TipoServicio,
} from '@/lib/servicios';
import { ModalBase } from './ModalBase';
import { areaCls, btnPrim, btnSec, campoCls, etiquetaCls } from './estilos';

type Resultado = Intervencion['resultado'];
const RESULTADOS: { v: Resultado; l: string; cls: string }[] = [
  { v: 'resuelto', l: 'Quedó resuelto', cls: 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-emerald-400' },
  { v: 'nueva_visita', l: 'Hace falta otra visita', cls: 'border-orange-500 bg-orange-50 text-orange-900 ring-orange-400' },
  { v: 'pendiente_repuesto', l: 'Falta un repuesto', cls: 'border-orange-500 bg-orange-50 text-orange-900 ring-orange-400' },
];
const OTRO = '__otro__';

// Lo que hizo el técnico en una visita. Al guardar, si el cliente está ahí, se ofrece firmar en el momento.
export function ModalIntervencion({ servicioId, tipoServicio, responsableId, responsableNombre, visita, onClose, onGuardada }: {
  servicioId: string; tipoServicio: TipoServicio; responsableId: string | null; responsableNombre: string | null;
  visita?: Intervencion; onClose: () => void; onGuardada: (id: string) => void;
}) {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([]);
  useEffect(() => { api.get<{ id: string; nombre: string }[]>('/usuarios/activos').then(setUsuarios).catch(() => {}); }, []);
  const tecIni = visita ? (visita.tecnico_id ?? (visita.tecnico_nombre ? OTRO : ''))
    : (responsableId ?? (responsableNombre ? OTRO : user?.id ?? ''));
  const [tecnico, setTecnico] = useState(tecIni);
  const [tecnicoNombre, setTecnicoNombre] = useState(visita?.tecnico_nombre ?? (visita ? '' : responsableNombre ?? ''));
  const [fecha, setFecha] = useState(visita?.fecha ?? fechaDiaAR(new Date()));
  const [encontrado, setEncontrado] = useState(visita?.problema_encontrado ?? '');
  const [trabajoTipo, setTrabajoTipo] = useState<TrabajoTipo | null>(visita?.trabajo_tipo ?? null);
  const [detalle, setDetalle] = useState(visita?.trabajo_detalle ?? '');
  const [materiales, setMateriales] = useState<{ descripcion: string; cantidad: string }[]>(
    visita?.materiales.map(m => ({ descripcion: m.descripcion, cantidad: String(m.cantidad) })) ?? []);
  const [antes, setAntes] = useState<string[]>(visita?.fotos_antes ?? []);
  const [despues, setDespues] = useState<string[]>(visita?.fotos_despues ?? []);
  const [observaciones, setObservaciones] = useState(visita?.observaciones ?? '');
  const [pendientes, setPendientes] = useState(visita?.pendientes ?? '');
  const [conCargo, setConCargo] = useState(visita?.con_cargo ?? tipoServicio !== 'garantia');
  const [resultado, setResultado] = useState<Resultado | null>(visita?.resultado ?? null);
  const [guardando, setGuardando] = useState(false);

  const matsValidos = materiales.filter(m => m.descripcion.trim());
  const completo = !!trabajoTipo && detalle.trim().length >= 3 && !!resultado && !!fecha
    && matsValidos.every(m => Number(m.cantidad) > 0) && (tecnico !== OTRO || tecnicoNombre.trim().length > 0);

  async function guardar() {
    if (!completo || guardando) return;
    setGuardando(true);
    const body = {
      fecha, tecnico_id: tecnico && tecnico !== OTRO ? tecnico : null, tecnico_nombre: tecnico === OTRO ? tecnicoNombre.trim() : null,
      problema_encontrado: encontrado.trim() || null, trabajo_tipo: trabajoTipo, trabajo_detalle: detalle.trim(),
      materiales: matsValidos.map(m => ({ descripcion: m.descripcion.trim(), cantidad: Number(m.cantidad) })),
      fotos_antes: antes, fotos_despues: despues, observaciones: observaciones.trim() || null, pendientes: pendientes.trim() || null,
      con_cargo: conCargo, resultado,
    };
    try {
      if (visita) {
        await api.put(`/servicios-tecnicos/${servicioId}/intervenciones/${visita.id}`, body);
        toast.success('Visita actualizada');
        onGuardada(visita.id);
      } else {
        const r = await api.post<{ id: string }>(`/servicios-tecnicos/${servicioId}/intervenciones`, body);
        toast.success('Visita registrada');
        onGuardada(r.id);
      }
    } catch (e) {
      toastApiError(e, { fallback: 'No se pudo guardar la visita' });
    } finally {
      setGuardando(false);
    }
  }

  const fotosZona = (urls: string[], set: (f: (a: string[]) => string[]) => void, texto: string) => (
    <div className="space-y-2">
      <AdjuntosGrid urls={urls} size="sm" onRemove={u => set(a => a.filter(x => x !== u))} />
      <DropzoneAdjuntos compacto endpoint={ENDPOINT_ADJUNTOS_SERVICIO} accept={ACCEPT_ADJUNTOS_SERVICIO} textoCompacto={texto}
        onAdd={u => set(a => [...a, u])} />
    </div>
  );

  return (
    <ModalBase titulo={visita ? `Editar visita ${visita.orden}` : 'Registrar visita'} icono={<ClipboardCheck size={18} className="text-teal-700" />}
      onClose={onClose} ancho="sm:max-w-2xl" testId="modal-intervencion"
      pie={<>
        <button onClick={onClose} className={btnSec}>Cancelar</button>
        <button onClick={guardar} disabled={!completo || guardando} className={btnPrim} data-testid="guardar-intervencion">
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />} {visita ? 'Guardar cambios' : 'Guardar visita'}
        </button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={etiquetaCls} htmlFor="iv-fecha">Fecha</label>
          <input id="iv-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={cn(campoCls, 'mt-1')} />
        </div>
        <div>
          <label className={etiquetaCls} htmlFor="iv-tec">Técnico</label>
          <select id="iv-tec" value={tecnico} onChange={e => setTecnico(e.target.value)} className={cn(campoCls, 'mt-1')}>
            <option value="">Sin indicar</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            <option value={OTRO}>Otra persona (escribir)</option>
          </select>
          {tecnico === OTRO && <input value={tecnicoNombre} onChange={e => setTecnicoNombre(e.target.value)} maxLength={120} placeholder="Nombre" aria-label="Nombre del técnico" className={cn(campoCls, 'mt-2')} />}
        </div>
      </div>

      <div>
        <label className={etiquetaCls} htmlFor="iv-enc">Problema encontrado</label>
        <textarea id="iv-enc" value={encontrado} onChange={e => setEncontrado(e.target.value)} rows={2} maxLength={4000}
          placeholder="Qué se encontró al revisar (puede diferir de lo que contó el cliente)" className={cn(areaCls, 'mt-1')} />
      </div>

      <div>
        <p className={etiquetaCls}>Trabajo realizado</p>
        <div className="mt-1 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {(Object.keys(TRABAJO_TIPO) as TrabajoTipo[]).map(k => (
            <button key={k} type="button" onClick={() => setTrabajoTipo(k)} aria-pressed={trabajoTipo === k} data-testid={`trabajo-${k}`}
              className={cn('h-11 sm:h-10 px-2 rounded-lg border text-xs font-semibold', trabajoTipo === k ? 'border-teal-600 bg-teal-50 text-teal-900 ring-1 ring-teal-500' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
              {TRABAJO_TIPO[k]}
            </button>
          ))}
        </div>
        <textarea value={detalle} onChange={e => setDetalle(e.target.value)} rows={3} maxLength={4000} aria-label="Detalle del trabajo"
          placeholder="Ej.: Se cambiaron las ruedas inferiores y se reguló la hoja" className={cn(areaCls, 'mt-2')} />
      </div>

      <div>
        <p className={etiquetaCls}>Repuestos o materiales usados</p>
        <div className="mt-1 space-y-2">
          {materiales.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input value={m.descripcion} onChange={e => setMateriales(a => a.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))}
                maxLength={200} placeholder="Repuesto o material" aria-label="Repuesto" className={cn(campoCls, 'flex-1')} />
              <input value={m.cantidad} onChange={e => setMateriales(a => a.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))}
                type="number" min="0.01" step="0.01" aria-label="Cantidad" className={cn(campoCls, 'w-20 sm:w-24')} />
              <button type="button" onClick={() => setMateriales(a => a.filter((_, j) => j !== i))} aria-label="Quitar"
                className="h-11 sm:h-10 w-11 sm:w-10 shrink-0 rounded-lg border border-gray-300 text-gray-500 hover:text-red-600 flex items-center justify-center"><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setMateriales(a => [...a, { descripcion: '', cantidad: '1' }])}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:underline"><Plus size={14} /> Agregar repuesto</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><p className={cn(etiquetaCls, 'mb-1')}>Fotos de antes</p>{fotosZona(antes, setAntes, 'Foto o video de antes')}</div>
        <div><p className={cn(etiquetaCls, 'mb-1')}>Fotos de después</p>{fotosZona(despues, setDespues, 'Foto o video de después')}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={etiquetaCls} htmlFor="iv-obs">Observaciones</label>
          <textarea id="iv-obs" value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} maxLength={4000} className={cn(areaCls, 'mt-1')} />
        </div>
        <div>
          <label className={etiquetaCls} htmlFor="iv-pend">Trabajos pendientes</label>
          <textarea id="iv-pend" value={pendientes} onChange={e => setPendientes(e.target.value)} rows={2} maxLength={4000} className={cn(areaCls, 'mt-1')} />
        </div>
      </div>

      <div>
        <p className={etiquetaCls}>Cargo</p>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {([[false, 'Sin cargo (garantía)'], [true, 'Con cargo al cliente']] as const).map(([v, l]) => (
            <button key={String(v)} type="button" onClick={() => setConCargo(v)} aria-pressed={conCargo === v}
              className={cn('h-11 sm:h-10 px-2 rounded-lg border text-sm font-semibold', conCargo === v ? 'border-teal-600 bg-teal-50 text-teal-900 ring-1 ring-teal-500' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={etiquetaCls}>¿Cómo quedó?</p>
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {RESULTADOS.map(r => (
            <button key={r.v} type="button" onClick={() => setResultado(r.v)} aria-pressed={resultado === r.v} data-testid={`resultado-${r.v}`}
              className={cn('h-11 sm:h-10 px-2 rounded-lg border text-sm font-semibold', resultado === r.v ? cn(r.cls, 'ring-1') : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
              {r.l}
            </button>
          ))}
        </div>
        {resultado && resultado !== 'resuelto' && (
          <p className="mt-1.5 text-xs text-orange-800">El servicio queda en "Repuesto o nueva visita". Desde la ficha se programa la próxima visita o se reclama el repuesto al proveedor.</p>
        )}
      </div>
    </ModalBase>
  );
}
