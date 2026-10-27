import { useState } from 'react';
import { GitBranch, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { descripcionSugerida, diferenciasFicha, desdeFichaVieja } from '@/lib/configuradorAbertura';
import { ConfiguradorAbertura } from './ConfiguradorAbertura';
import { AdjuntosGrid, DropzoneAdjuntos, inpCls, lblCls, btnPrimario, btnSecundario } from './ui';
import type { Especificaciones, SolicitudItem } from './tipos';

// "Nueva versión" de un ítem ya cotizado o por cotizar: se parte de la ficha actual, se cambia lo que haga falta y se
// guarda como V2, V3… La versión de partida queda intacta con sus cotizaciones (lo que se le pidió a cada proveedor).
export function PanelNuevaVersion({ solicitudId, item, version, onCancelar, onGuardada }: {
  solicitudId: string;
  item: SolicitudItem;
  /** Número que va a tener la versión nueva. */
  version: number;
  onCancelar: () => void;
  onGuardada: () => void;
}) {
  const [ficha, setFicha] = useState<Especificaciones>(() => desdeFichaVieja(item.especificaciones));
  const [descripcion, setDescripcion] = useState(item.descripcion);
  const [cantidad, setCantidad] = useState(String(item.cantidad));
  const [adjuntos, setAdjuntos] = useState<string[]>(item.adjuntos ?? []);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambios = diferenciasFicha(item.especificaciones, ficha);
  const sinCambios = cambios.length === 0 && descripcion.trim() === item.descripcion && Number(cantidad) === Number(item.cantidad)
    && JSON.stringify(adjuntos) === JSON.stringify(item.adjuntos ?? []);

  async function guardar() {
    if (guardando || sinCambios || !descripcion.trim() || !(Number(cantidad) > 0)) return;
    setGuardando(true);
    try {
      await api.post(`/compras/solicitudes/${solicitudId}/items/${item.id}/nueva-version`, {
        descripcion: descripcion.trim(), cantidad: Number(cantidad), especificaciones: ficha, adjuntos, motivo: motivo.trim() || null,
      });
      toast.success(`Versión ${version} guardada`, { description: 'Seleccionala y pedí cotización. La anterior conserva lo que se cotizó.' });
      onGuardada();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo guardar la versión' }); }
    finally { setGuardando(false); }
  }

  return (
    <div className="pt-3 border-t border-gray-200 space-y-3" data-testid="panel-nueva-version">
      <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
        <GitBranch size={16} className="text-violet-700" /> Nueva versión (V{version}) de «{item.descripcion}»
      </p>
      <p className="text-xs text-gray-600">Cambiá lo que pidió el cliente. La versión anterior no se modifica: queda con sus cotizaciones como historial.</p>
      <ConfiguradorAbertura ficha={ficha} onChange={f => {
        setFicha(f);
        if (descripcion === descripcionSugerida(ficha) || descripcion === item.descripcion) setDescripcion(descripcionSugerida(f) || descripcion);
      }} />
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
        <div><label className={lblCls}>Descripción</label><input value={descripcion} onChange={e => setDescripcion(e.target.value)} className={inpCls} maxLength={500} /></div>
        <div><label className={lblCls}>Cantidad</label><input type="number" min="0.01" step="0.01" value={cantidad} onChange={e => setCantidad(e.target.value)} className={inpCls} /></div>
      </div>
      <div>
        <label className={lblCls}>Croquis, fotos o PDF</label>
        <AdjuntosGrid urls={adjuntos} size="sm" onRemove={u => setAdjuntos(a => a.filter(x => x !== u))} />
        <div className="mt-1"><DropzoneAdjuntos compacto onAdd={u => setAdjuntos(a => [...a, u])} /></div>
      </div>
      <div><label className={lblCls}>Motivo del cambio (opcional)</label><input value={motivo} onChange={e => setMotivo(e.target.value)} className={inpCls} maxLength={300} placeholder="Ej.: el cliente prefiere vidrio opalino" /></div>
      {cambios.length > 0 && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
          <p className="font-semibold mb-0.5">Cambios respecto de la versión actual</p>
          {cambios.map(c => <p key={c.label}>{c.label}: <s className="opacity-70">{c.antes}</s> → <b>{c.despues}</b></p>)}
        </div>
      )}
      <div className="flex gap-2 justify-end flex-wrap">
        <button onClick={onCancelar} className={btnSecundario}>Cancelar</button>
        <button onClick={guardar} disabled={guardando || sinCambios || !descripcion.trim()} className={btnPrimario}
          title={sinCambios ? 'No cambiaste nada todavía' : undefined}>
          <Save size={14} /> {guardando ? 'Guardando…' : `Guardar versión ${version}`}
        </button>
      </div>
    </div>
  );
}
