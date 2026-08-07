import { useState, useEffect } from 'react';
import { X, Search, Target, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Cliente } from '@/types';
import { INTERES_CFG, nombreClienteOportunidad, type Oportunidad, type OportunidadInteres, type OportunidadOrigen } from './types';

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fechaMasMeses(meses: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ATAJOS = [
  { label: '1 mes', meses: 1 },
  { label: '3 meses', meses: 3 },
  { label: '6 meses', meses: 6 },
  { label: 'El año que viene', meses: 12 },
];

// Alta/edición de oportunidad — reusable desde los 4 puntos de entrada
// (ficha del cliente, presupuesto rechazado/vencido, panel del CRM y,
// indirectamente, la respuesta pública del cliente). Solo 5 campos.
export function ModalOportunidad({
  oportunidad, clienteId, clienteNombre, operacionId, motivoInicial, origen = 'crm', onClose, onSuccess,
}: {
  oportunidad?: Oportunidad;
  clienteId?: string;
  clienteNombre?: string;
  operacionId?: string | null;
  motivoInicial?: string;
  origen?: OportunidadOrigen;
  onClose: () => void;
  onSuccess: (op: Oportunidad) => void;
}) {
  const isEdit = !!oportunidad;

  const [selClienteId, setSelClienteId] = useState(oportunidad?.cliente_id ?? clienteId ?? '');
  const [selClienteNombre, setSelClienteNombre] = useState(
    oportunidad?.cliente ? nombreClienteOportunidad(oportunidad.cliente) : (clienteNombre ?? '')
  );
  const [clienteSearch, setClienteSearch] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showClienteList, setShowClienteList] = useState(false);

  const [motivo, setMotivo] = useState(oportunidad?.motivo ?? motivoInicial ?? '');
  const [fecha, setFecha] = useState(oportunidad?.fecha_recontacto?.slice(0, 10) ?? fechaMasMeses(3));
  const [interes, setInteres] = useState<OportunidadInteres>(oportunidad?.interes ?? 'medio');
  const [probabilidad, setProbabilidad] = useState(oportunidad?.probabilidad ?? 50);
  const [observaciones, setObservaciones] = useState(oportunidad?.observaciones ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = clienteSearch.trim();
    if (!q) { setClientes([]); return; }
    const t = setTimeout(() => {
      api.get<Cliente[]>(`/clientes?search=${encodeURIComponent(q)}`).then(setClientes).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [clienteSearch]);

  function nombreCli(c: Cliente) {
    return c.tipo_persona === 'juridica' ? (c.razon_social ?? '') : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim();
  }
  function seleccionarCliente(c: Cliente) {
    setSelClienteId(c.id);
    setSelClienteNombre(nombreCli(c));
    setClienteSearch('');
    setShowClienteList(false);
  }

  const fechaPasada = fecha < hoyISO();

  async function handleSubmit() {
    setError('');
    if (!selClienteId) { setError('Elegí el cliente'); return; }
    if (!motivo.trim() || motivo.trim().length < 3) { setError('Contá de qué se trata el proyecto'); return; }
    if (!fecha) { setError('Elegí una fecha de recontacto'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        const op = await api.patch<Oportunidad>(`/oportunidades/${oportunidad!.id}`, {
          motivo: motivo.trim(), fecha_recontacto: fecha, interes, probabilidad,
          observaciones: observaciones.trim() || null,
        });
        toast.success('Oportunidad actualizada');
        onSuccess(op);
      } else {
        const op = await api.post<Oportunidad>('/oportunidades', {
          cliente_id: selClienteId,
          operacion_id_origen: operacionId || null,
          motivo: motivo.trim(),
          fecha_recontacto: fecha,
          interes, probabilidad,
          observaciones: observaciones.trim() || null,
          origen,
        });
        toast.success('Oportunidad registrada');
        onSuccess(op);
      }
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-300';
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-fuchsia-600 to-violet-600 sticky top-0">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-white" />
            <h2 className="text-sm font-bold text-white">{isEdit ? 'Editar oportunidad' : 'Nueva oportunidad futura'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} className="text-white" /></button>
        </div>

        <div className="p-6 space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 text-red-700 rounded-xl text-xs">
              <AlertTriangle size={13} className="shrink-0" /> {error}
            </div>
          )}

          {!isEdit && !clienteId && (
            <div>
              <label className={lbl}>Cliente *</label>
              {selClienteId ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-fuchsia-50 border border-fuchsia-200">
                  <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{selClienteNombre}</span>
                  <button type="button" onClick={() => { setSelClienteId(''); setSelClienteNombre(''); }}
                    className="p-1 hover:bg-white rounded"><X size={13} className="text-gray-400" /></button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl">
                    <Search size={14} className="text-gray-300 shrink-0" />
                    <input value={clienteSearch}
                      onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
                      onFocus={() => setShowClienteList(true)}
                      onBlur={() => setTimeout(() => setShowClienteList(false), 150)}
                      placeholder="Buscar por nombre, teléfono o DNI..."
                      className="flex-1 text-sm focus:outline-none" />
                  </div>
                  {showClienteList && clienteSearch && (
                    <div className="absolute z-30 top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {clientes.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400">Sin resultados</div>
                      ) : clientes.slice(0, 8).map(c => (
                        <button key={c.id} type="button" onMouseDown={() => seleccionarCliente(c)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          <p className="text-sm font-medium text-gray-800">{nombreCli(c)}</p>
                          {c.telefono && <p className="text-xs text-gray-400">{c.telefono}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {clienteId && selClienteNombre && (
            <div>
              <label className={lbl}>Cliente</label>
              <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-700">
                {selClienteNombre}
              </div>
            </div>
          )}

          <div>
            <label className={lbl}>¿Qué proyecto tiene pendiente? *</label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
              placeholder='Ej: "El año que viene cambia las ventanas del frente"'
              className={inp} />
          </div>

          <div>
            <label className={lbl}>¿Cuándo lo contactamos? *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inp} />
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {ATAJOS.map(a => (
                <button key={a.label} type="button" onClick={() => setFecha(fechaMasMeses(a.meses))}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-[10px] font-semibold text-gray-500 hover:border-fuchsia-300 hover:text-fuchsia-600">
                  En {a.label}
                </button>
              ))}
            </div>
            {fechaPasada && (
              <p className="text-[11px] text-amber-600 mt-1">⚠ Es una fecha pasada — va a aparecer como vencida.</p>
            )}
          </div>

          <div>
            <label className={lbl}>Nivel de interés</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(INTERES_CFG) as OportunidadInteres[]).map(k => (
                <button key={k} type="button" onClick={() => setInteres(k)}
                  className={cn(
                    'py-2 rounded-xl text-xs font-semibold border transition-all',
                    interes === k ? INTERES_CFG[k].cls + ' ring-1 ring-inset' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}>
                  {INTERES_CFG[k].emoji} {INTERES_CFG[k].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={lbl + ' mb-0'}>Probabilidad de cierre</label>
              <span className="text-xs font-bold text-fuchsia-600">{probabilidad}%</span>
            </div>
            <input type="range" min={0} max={100} step={10} value={probabilidad}
              onChange={e => setProbabilidad(Number(e.target.value))}
              className="w-full accent-fuchsia-600" />
          </div>

          <div>
            <label className={lbl}>Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
              placeholder="Opcional" className={inp} />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isEdit ? 'Guardar cambios' : 'Guardar oportunidad'}
          </button>
        </div>
      </div>
    </div>
  );
}
