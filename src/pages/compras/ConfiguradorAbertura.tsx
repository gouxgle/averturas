import { useEffect, useState, type ReactNode } from 'react';
import { Plus, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  TIPOS_ABERTURA, SENTIDOS, ABRE_HACIA, COMPOSICIONES, VIDRIO_ESPESORES, VIDRIO_COLORES, PANELES, OTRO,
  tipologiasDe, hojasDe, accesoriosDe, herrajesDe, camposVisibles, normalizarFicha, desdeFichaVieja,
  esFichaConfigurada, faltantesFicha, divisionesDe, sectoresDe, type Ficha, type Opcion, type Division,
} from '@/lib/configuradorAbertura';
import { esquemaAberturaSVG } from '@/lib/esquemaAbertura';
import { inpCls, lblCls } from './ui';

interface ItemCatalogo { id: string; nombre: string }
type Catalogos = { sistemas: string[]; colores: string[]; vidrios: string[] };
let cacheCatalogos: Promise<Catalogos> | null = null;
function cargarCatalogos(): Promise<Catalogos> {
  cacheCatalogos ??= Promise.all(['sistemas', 'colores', 'vidrios'].map(k =>
    api.get<ItemCatalogo[]>(`/catalogo/${k}`).then(r => r.map(x => x.nombre)).catch(() => [] as string[]),
  )).then(([sistemas, colores, vidrios]) => ({ sistemas, colores, vidrios: vidrios.filter(v => !/sin vidrio/i.test(v)) }));
  return cacheCatalogos;
}

interface Props {
  ficha: Ficha;
  onChange: (f: Ficha) => void;
  disabled?: boolean;
}

// Configurador de una abertura a medida: muestra solo las características que corresponden al tipo y
// tipología elegidos (las reglas viven en lib/configuradorAbertura.ts) y el esquema que se arma en vivo.
export function ConfiguradorAbertura({ ficha, onChange, disabled }: Props) {
  const f = esFichaConfigurada(ficha) ? ficha : desdeFichaVieja(ficha);
  const [cat, setCat] = useState<Catalogos>({ sistemas: [], colores: [], vidrios: [] });
  useEffect(() => { cargarCatalogos().then(setCat).catch(() => {}); }, []);

  const set = (cambios: Ficha) => onChange(normalizarFicha({ ...f, ...cambios }));
  const visibles = camposVisibles(f);
  const faltan = faltantesFicha(f);
  const tipo = typeof f.tipo_abertura === 'string' ? f.tipo_abertura : '';
  const tipologia = typeof f.tipologia === 'string' ? f.tipologia : '';
  const mm = (m: unknown) => (Number(m) > 0 ? String(Math.round(Number(m) * 1000)) : '');
  const toggle = (k: string, v: string) => {
    const actual = Array.isArray(f[k]) ? f[k] as string[] : [];
    set({ [k]: actual.includes(v) ? actual.filter(x => x !== v) : [...actual, v] });
  };

  return (
    <fieldset disabled={disabled} className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4" data-testid="configurador-abertura">
      <div className="space-y-3 min-w-0">
        <Paso titulo="Tipo de abertura">
          <Chips opciones={TIPOS_ABERTURA} valor={tipo} onElegir={v => set({ tipo_abertura: v })} />
          {tipo === OTRO && <OtroTexto valor={f.tipo_abertura_otro} onChange={t => set({ tipo_abertura_otro: t })} placeholder="¿Qué abertura?" />}
        </Paso>

        {tipo && (
          <Paso titulo="Tipología">
            <Chips opciones={tipologiasDe(tipo)} valor={tipologia} onElegir={v => set({ tipologia: v })} />
            {tipologia === OTRO && <OtroTexto valor={f.tipologia_otro} onChange={t => set({ tipologia_otro: t })} placeholder="¿Cómo abre?" />}
          </Paso>
        )}

        {tipo && tipologia && (
          <>
            <Paso titulo="Medidas (mm)">
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                <NumeroMm label="Ancho" valor={mm(f.ancho_m)} onCommit={v => set({ ancho_m: v ? v / 1000 : undefined })} />
                <NumeroMm label="Alto" valor={mm(f.alto_m)} onCommit={v => set({ alto_m: v ? v / 1000 : undefined })} />
              </div>
            </Paso>

            {(visibles.has('hojas') || visibles.has('sentido')) && (
              <Paso titulo="Hojas y apertura">
                {visibles.has('hojas') && (
                  <Chips opciones={hojasDe(tipologia).map(h => ({ v: String(h), l: h === 1 ? '1 hoja' : `${h} hojas` }))}
                    valor={f.hojas ? String(f.hojas) : ''} onElegir={v => set({ hojas: Number(v) })} />
                )}
                {visibles.has('sentido') && (
                  <div className="mt-2 space-y-2">
                    <Chips opciones={SENTIDOS} valor={String(f.sentido ?? '')} onElegir={v => set({ sentido: v })} />
                    <Chips opciones={ABRE_HACIA} valor={String(f.abre_hacia ?? '')} onElegir={v => set({ abre_hacia: v })} />
                    <p className="text-[11px] text-gray-500">Visto desde adentro del ambiente.</p>
                  </div>
                )}
              </Paso>
            )}

            <Paso titulo="Carpintería">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ListaConOtro label="Sistema" opciones={cat.sistemas} valor={String(f.sistema ?? '')} onChange={v => set({ sistema: v })} />
                <ListaConOtro label="Color de perfilería" opciones={cat.colores} valor={String(f.color ?? '')} onChange={v => set({ color: v })} />
              </div>
              {visibles.has('composicion') && (
                <div className="mt-2">
                  <p className={lblCls}>Composición</p>
                  <Chips opciones={COMPOSICIONES} valor={String(f.composicion ?? '')} onElegir={v => set({ composicion: v })} />
                </div>
              )}
            </Paso>

            {visibles.has('vidrio') && (
              <Paso titulo="Vidrio">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <ListaConOtro label="Tipo" opciones={cat.vidrios} valor={String(f.vidrio_tipo ?? '')} onChange={v => set({ vidrio_tipo: v })} />
                  <SelectConOtro label="Espesor / composición" opciones={VIDRIO_ESPESORES} valor={String(f.vidrio_espesor ?? '')} otro={f.vidrio_espesor_otro}
                    onChange={(v, o) => set({ vidrio_espesor: v, vidrio_espesor_otro: o })} />
                  <SelectConOtro label="Color" opciones={VIDRIO_COLORES} valor={String(f.vidrio_color ?? '')} otro={f.vidrio_color_otro}
                    onChange={(v, o) => set({ vidrio_color: v, vidrio_color_otro: o })} />
                </div>
              </Paso>
            )}

            {visibles.has('panel') && (
              <Paso titulo="Revestimiento / panel">
                <Chips opciones={PANELES} valor={String(f.panel ?? '')} onElegir={v => set({ panel: v })} />
                {f.panel === OTRO && <OtroTexto valor={f.panel_otro} onChange={t => set({ panel_otro: t })} placeholder="¿Qué panel?" />}
              </Paso>
            )}

            {visibles.has('divisiones') && (
              <Paso titulo="Divisiones / travesaños">
                <Divisiones ficha={f} onChange={divisiones => set({ divisiones })} />
                {f.composicion === 'combinado' && (
                  <div className="mt-2">
                    <p className={lblCls}>Sectores (de abajo hacia arriba)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sectoresDe(f).map((s, i, todos) => (
                        <button key={i} type="button"
                          onClick={() => set({ sectores: todos.map((x, j) => (j === i ? (x === 'ciego' ? 'vidrio' : 'ciego') : x)) })}
                          className={cn('h-9 px-3 rounded-lg border text-xs font-semibold',
                            s === 'ciego' ? 'bg-gray-200 border-gray-400 text-gray-800' : 'bg-sky-50 border-sky-300 text-sky-800')}>
                          {i + 1}: {s === 'ciego' ? 'Ciego' : 'Vidrio'}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Tocá un sector para cambiarlo. Con un travesaño horizontal quedan dos sectores.</p>
                  </div>
                )}
              </Paso>
            )}

            {(visibles.has('accesorios') || visibles.has('herrajes')) && (
              <Paso titulo="Accesorios y herrajes">
                {visibles.has('accesorios') && (<>
                  <p className={lblCls}>Accesorios</p>
                  <ChipsMulti opciones={accesoriosDe(tipo)} valores={f.accesorios_lista} onToggle={v => toggle('accesorios_lista', v)} />
                </>)}
                {visibles.has('herrajes') && (
                  <div className={visibles.has('accesorios') ? 'mt-2' : ''}>
                    <p className={lblCls}>Herrajes</p>
                    <ChipsMulti opciones={herrajesDe(tipo, tipologia)} valores={f.herrajes_lista} onToggle={v => toggle('herrajes_lista', v)} />
                  </div>
                )}
              </Paso>
            )}

            <Paso titulo="Observaciones de fabricación">
              <TextoDiferido valor={String(f.obs_fabricacion ?? '')} onCommit={t => set({ obs_fabricacion: t })}
                placeholder="Ej.: manija a 1,05 m, vidrio con logo arenado, colocar con burlete doble…" />
            </Paso>
          </>
        )}
      </div>

      <div className="order-first lg:order-none lg:sticky lg:top-2 self-start space-y-2 w-full max-w-[200px] lg:max-w-[280px] mx-auto lg:mx-0">
        <div className="rounded-xl border border-gray-300 bg-white p-2 flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
          // El SVG se arma en lib/esquemaAbertura.ts solo con números y textos escapados
          dangerouslySetInnerHTML={{ __html: esquemaAberturaSVG(f, { ancho: 250 }) }} />
        {faltan.length ? (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 flex gap-1.5">
            <AlertTriangle size={13} className="shrink-0 mt-px" /> Para cotizar falta {faltan.join(', ')}.
          </p>
        ) : (
          <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 flex gap-1.5">
            <CheckCircle2 size={13} className="shrink-0 mt-px" /> Ficha lista para cotizar.
          </p>
        )}
      </div>
    </fieldset>
  );
}

function Paso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs font-bold text-gray-800 mb-2">{titulo}</p>
      {children}
    </div>
  );
}

const chip = (activo: boolean) => cn('h-9 px-3 rounded-lg border text-xs font-semibold transition-colors',
  activo ? 'bg-lime-600 border-lime-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-lime-500');

function Chips({ opciones, valor, onElegir }: { opciones: Opcion[]; valor: string; onElegir: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map(o => (
        <button key={o.v} type="button" aria-pressed={valor === o.v} onClick={() => onElegir(o.v)} className={chip(valor === o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

function ChipsMulti({ opciones, valores, onToggle }: { opciones: Opcion[]; valores: unknown; onToggle: (v: string) => void }) {
  const sel = Array.isArray(valores) ? valores as string[] : [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map(o => (
        <button key={o.v} type="button" aria-pressed={sel.includes(o.v)} onClick={() => onToggle(o.v)} className={chip(sel.includes(o.v))}>{o.l}</button>
      ))}
    </div>
  );
}

/** Texto que se guarda al salir del campo (normalizar en cada tecla movería el cursor y borraría espacios). */
function TextoDiferido({ valor, onCommit, placeholder, multilinea = true }: { valor: string; onCommit: (t: string) => void; placeholder?: string; multilinea?: boolean }) {
  const [t, setT] = useState(valor);
  const [base, setBase] = useState(valor);
  if (valor !== base) { setBase(valor); setT(valor); }
  const props = { value: t, placeholder, onChange: (e: { target: { value: string } }) => setT(e.target.value), onBlur: () => { if (t !== valor) onCommit(t.trim()); } };
  return multilinea
    ? <textarea {...props} rows={2} maxLength={1000} className={cn(inpCls, 'resize-y')} />
    : <input {...props} maxLength={200} className={inpCls} />;
}

function OtroTexto({ valor, onChange, placeholder }: { valor: unknown; onChange: (t: string) => void; placeholder: string }) {
  return <div className="mt-2 max-w-sm"><TextoDiferido valor={String(valor ?? '')} onCommit={onChange} placeholder={placeholder} multilinea={false} /></div>;
}

function NumeroMm({ label, valor, onCommit }: { label: string; valor: string; onCommit: (v: number | null) => void }) {
  const [t, setT] = useState(valor);
  const [base, setBase] = useState(valor);
  if (valor !== base) { setBase(valor); setT(valor); }
  const commit = () => { const n = Math.round(Number(t)); if (String(n > 0 ? n : '') !== valor) onCommit(n > 0 ? n : null); };
  return (
    <div>
      <label className={lblCls}>{label}</label>
      <input type="number" inputMode="numeric" min={1} step={1} value={t} onChange={e => setT(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }} className={inpCls} placeholder="mm" />
    </div>
  );
}

/** Opciones del catálogo (Configuración) como lista; "Otro" deja escribir. */
function ListaConOtro({ label, opciones, valor, onChange }: { label: string; opciones: string[]; valor: string; onChange: (v: string) => void }) {
  const enLista = !valor || opciones.includes(valor);
  const [otro, setOtro] = useState(!enLista);
  const mostrarOtro = otro || !enLista;
  return (
    <div>
      <label className={lblCls}>{label}</label>
      <select value={mostrarOtro ? OTRO : valor} onChange={e => {
        if (e.target.value === OTRO) { setOtro(true); return; }
        setOtro(false); onChange(e.target.value);
      }} className={inpCls}>
        <option value="">—</option>
        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
        <option value={OTRO}>Otro…</option>
      </select>
      {mostrarOtro && <div className="mt-1"><TextoDiferido valor={enLista ? '' : valor} onCommit={onChange} placeholder={`Escribí el ${label.toLowerCase()}`} multilinea={false} /></div>}
    </div>
  );
}

function SelectConOtro({ label, opciones, valor, otro, onChange }: {
  label: string; opciones: Opcion[]; valor: string; otro: unknown; onChange: (v: string, otro?: string) => void;
}) {
  return (
    <div>
      <label className={lblCls}>{label}</label>
      <select value={valor} onChange={e => onChange(e.target.value, typeof otro === 'string' ? otro : undefined)} className={inpCls}>
        <option value="">—</option>
        {opciones.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      {valor === OTRO && <div className="mt-1"><TextoDiferido valor={String(otro ?? '')} onCommit={t => onChange(OTRO, t)} placeholder="Detalle" multilinea={false} /></div>}
    </div>
  );
}

function Divisiones({ ficha, onChange }: { ficha: Ficha; onChange: (d: Division[]) => void }) {
  const divs = divisionesDe(ficha);
  const altoMm = Math.round(Number(ficha.alto_m) * 1000) || 0;
  const anchoMm = Math.round(Number(ficha.ancho_m) * 1000) || 0;
  const agregar = (orientacion: Division['orientacion']) => {
    const max = orientacion === 'horizontal' ? altoMm : anchoMm;
    onChange([...divs, { orientacion, posicion_mm: max ? Math.round(max / 2) : 1000 }]);
  };
  return (
    <div className="space-y-1.5">
      {divs.map((d, i) => (
        <div key={`${d.orientacion}-${i}`} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-gray-700 w-24">{d.orientacion === 'horizontal' ? 'Horizontal' : 'Vertical'}</span>
          <span className="text-gray-600">a</span>
          <div className="w-28">
            <NumeroMm label="" valor={String(d.posicion_mm)}
              onCommit={v => onChange(v ? divs.map((x, j) => (j === i ? { ...x, posicion_mm: v } : x)) : divs.filter((_, j) => j !== i))} />
          </div>
          <span className="text-gray-600">mm {d.orientacion === 'horizontal' ? 'desde abajo' : 'desde la izquierda'}</span>
          <button type="button" onClick={() => onChange(divs.filter((_, j) => j !== i))} aria-label="Quitar división"
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50"><X size={14} /></button>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => agregar('horizontal')} className={chip(false)}><Plus size={12} className="inline -mt-0.5" /> Travesaño horizontal</button>
        <button type="button" onClick={() => agregar('vertical')} className={chip(false)}><Plus size={12} className="inline -mt-0.5" /> Parante vertical</button>
      </div>
    </div>
  );
}
