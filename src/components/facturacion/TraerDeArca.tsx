import { useEffect, useMemo, useState } from 'react';
import { X, RefreshCw, Landmark, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CONDICION_IVA_LABEL } from '@/lib/condicionIva';

// Diálogo "Traer de ARCA": consulta el padrón por CUIT y muestra, campo por campo, lo que
// hay en la ficha y lo que informa ARCA. Lo vacío viene marcado para completar; lo que es
// distinto se muestra pero hay que marcarlo a mano (nunca se pisa un dato sin querer).
// Los cambios elegidos vuelven al formulario: se guardan recién con "Guardar".

export interface PersonaArca {
  cuit: string;
  tipo_persona: 'fisica' | 'juridica';
  nombre_completo: string;
  estado_clave: string | null;
  domicilio: { direccion: string | null; localidad: string | null; cp: string | null; provincia: string | null } | null;
  domicilio_texto: string | null;
  condicion_iva: string;
  monotributo_categoria: string | null;
  actividad: string | null;
  avisos: string[];
}

export interface DatosFichaArca {
  tipo_persona: 'fisica' | 'juridica';
  nombre_completo: string;
  documento_nro: string;
  condicion_iva: string;
  domicilio_fiscal: string;
  direccion: string;
  localidad: string;
  codigo_postal: string;
}

const CAMPOS: { campo: keyof DatosFichaArca; label: string }[] = [
  { campo: 'tipo_persona',     label: 'Tipo de persona' },
  { campo: 'nombre_completo',  label: 'Nombre / razón social' },
  { campo: 'condicion_iva',    label: 'Condición frente al IVA' },
  { campo: 'domicilio_fiscal', label: 'Domicilio fiscal' },
  { campo: 'direccion',        label: 'Dirección' },
  { campo: 'localidad',        label: 'Localidad' },
  { campo: 'codigo_postal',    label: 'Código postal' },
  { campo: 'documento_nro',    label: 'DNI' },
];

const titulo = (s: string | null | undefined) => (s ?? '').toLowerCase()
  .replace(/(^|[\s.'-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase())
  .replace(/\b(De|Del|La|Las|Los|Y)\b/g, m => m.toLowerCase()).replace(/^./, m => m.toUpperCase());

const mostrar = (campo: keyof DatosFichaArca, v: string) =>
  campo === 'tipo_persona' ? (v === 'juridica' ? 'Empresa (jurídica)' : 'Persona física')
    : campo === 'condicion_iva' ? CONDICION_IVA_LABEL[v] ?? v
      : v;

const normal = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');

function desdeArca(p: PersonaArca): DatosFichaArca {
  return {
    tipo_persona: p.tipo_persona,
    nombre_completo: p.nombre_completo,
    // DNI = los 8 dígitos del medio del CUIT (solo tiene sentido para personas físicas).
    documento_nro: p.tipo_persona === 'fisica' ? String(Number(p.cuit.slice(2, 10))) : '',
    condicion_iva: p.condicion_iva,
    domicilio_fiscal: p.domicilio_texto ?? '',
    direccion: titulo(p.domicilio?.direccion),
    localidad: titulo(p.domicilio?.localidad),
    codigo_postal: p.domicilio?.cp ?? '',
  };
}

export function TraerDeArca({ cuit, actual, onAplicar, onClose }: {
  cuit: string;
  actual: DatosFichaArca;
  onAplicar: (cambios: Partial<DatosFichaArca>, persona: PersonaArca) => void;
  onClose: () => void;
}) {
  const [persona, setPersona] = useState<PersonaArca | null>(null);
  const [consultado, setConsultado] = useState<{ desde_cache: boolean; at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [marcados, setMarcados] = useState<Set<keyof DatosFichaArca>>(new Set());

  const arca = useMemo(() => (persona ? desdeArca(persona) : null), [persona]);

  const filas = useMemo(() => {
    if (!arca) return [];
    return CAMPOS
      .filter(({ campo }) => arca[campo] !== '')
      .map(({ campo, label }) => {
        const a = actual[campo] ?? '';
        const n = arca[campo];
        const tipo: 'completar' | 'distinto' | 'igual' =
          campo === 'condicion_iva'
            ? ((a || 'consumidor_final') === n ? 'igual' : a ? 'distinto' : 'completar')
            : normal(a) === normal(n) ? 'igual' : a.trim() ? 'distinto' : 'completar';
        return { campo, label, actual: a, arca: n, tipo };
      });
  }, [arca, actual]);

  // Sin setState sincrónico: se llama desde el efecto de montaje y desde "Actualizar".
  function pedir(forzar: boolean) {
    return api.get<{ persona: PersonaArca; desde_cache: boolean; consultado_at: string }>(
      `/facturacion/padron/${cuit.replace(/\D/g, '')}${forzar ? '?forzar=1' : ''}`)
      .then(r => {
        setPersona(r.persona);
        setConsultado({ desde_cache: r.desde_cache, at: r.consultado_at });
        // Por defecto: completar lo vacío. Lo distinto queda a criterio del usuario.
        const d = desdeArca(r.persona);
        setMarcados(new Set(CAMPOS.map(c => c.campo).filter(c => {
          const a = (actual[c] ?? '').trim();
          if (!d[c]) return false;
          if (c === 'condicion_iva') return !a && d[c] !== 'consumidor_final';
          // El tipo de persona de ARCA es firme (un CUIT 30- es una empresa) y en un cliente
          // nuevo el "física" del formulario es solo el valor por defecto.
          if (c === 'tipo_persona') return a !== d[c];
          return !a;
        })));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }
  function consultar(forzar: boolean) {
    setCargando(true);
    setError(null);
    pedir(forzar);
  }
  // Se monta una vez por consulta (el padre lo abre con el CUIT ya escrito).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { pedir(false); }, []);

  function alternar(c: keyof DatosFichaArca) {
    setMarcados(prev => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c); else n.add(c);
      return n;
    });
  }

  function aplicar() {
    if (!arca || !persona) return;
    const cambios: Partial<DatosFichaArca> = {};
    for (const c of marcados) (cambios as Record<string, string>)[c] = arca[c];
    onAplicar(cambios, persona);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onMouseDown={onClose}>
      <div className="w-full sm:max-w-2xl max-h-[90dvh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onMouseDown={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-5 py-3 flex items-center gap-3">
          <Landmark size={18} className="text-fuchsia-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Datos de ARCA</p>
            <p className="text-xs text-gray-600">CUIT {cuit}{consultado && ` · ${consultado.desde_cache ? 'consultado' : 'actualizado'} ${new Date(consultado.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}`}</p>
          </div>
          <button onClick={() => consultar(true)} disabled={cargando} className="h-9 px-2 flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50" title="Volver a consultar a ARCA">
            <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center text-gray-500 hover:text-gray-900" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          {cargando && !persona && <p className="text-sm text-gray-600">Consultando a ARCA…</p>}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {persona && (
            <>
              {persona.estado_clave && persona.estado_clave !== 'ACTIVO' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  ARCA informa la clave como <b>{persona.estado_clave}</b>: revisá antes de facturarle.
                </div>
              )}
              {persona.avisos.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {persona.avisos.join(' · ')}
                </div>
              )}
              {(persona.actividad || persona.monotributo_categoria) && (
                <p className="text-xs text-gray-600">
                  {[persona.actividad && `Actividad: ${persona.actividad}`,
                    persona.monotributo_categoria && `Monotributo ${persona.monotributo_categoria}`].filter(Boolean).join(' · ')}
                </p>
              )}

              <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                {filas.map(f => (
                  <li key={f.campo} className={cn('px-3 py-2.5 flex gap-3', f.tipo === 'distinto' && 'bg-amber-50/60')}>
                    {f.tipo === 'igual'
                      ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                      : <input type="checkbox" checked={marcados.has(f.campo)} onChange={() => alternar(f.campo)}
                          className="w-5 h-5 mt-0.5 shrink-0 accent-fuchsia-700" aria-label={`Usar dato de ARCA para ${f.label}`} />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{f.label}</p>
                      <p className="text-sm text-gray-900 break-words">{mostrar(f.campo, f.arca)}</p>
                      {f.tipo === 'distinto' && (
                        <p className="text-xs text-amber-800 break-words">En la ficha: {mostrar(f.campo, f.actual)}</p>
                      )}
                      {f.tipo === 'igual' && <p className="text-xs text-emerald-700">Coincide con la ficha</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-5 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button onClick={onClose} className="h-11 sm:h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={aplicar} disabled={!persona || marcados.size === 0}
            className="h-11 sm:h-10 px-4 rounded-lg bg-fuchsia-700 text-sm font-semibold text-white hover:bg-fuchsia-800 disabled:opacity-50">
            Usar {marcados.size || ''} dato{marcados.size === 1 ? '' : 's'} de ARCA
          </button>
        </div>
      </div>
    </div>
  );
}
