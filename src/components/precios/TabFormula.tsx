import { useEffect, useMemo, useState } from 'react';
import { Calculator, ChevronDown, ChevronRight, Save, Plus, Trash2, Loader2, ShoppingBag, FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  precioPorFormula, elegirFormula, clasificarContraFormula, type Formula, type ParametrosFormula, type GrupoFormula,
} from '@/lib/formulaPrecio';
import { type ProductoRevision, type Revision, fmt$, fmtPct, fmtFecha, colorDias } from './tipos';
import { Filtros, Casilla, HistorialPrecios } from './comunes';
import { aplicarFiltro, FILTRO_VACIO, type Filtro } from './filtros';
import { AsistenteActualizar, type CriterioInicial } from './AsistenteActualizar';

// Pestaña "Por fórmula": compara el precio de cada producto estándar con la fórmula del negocio
// (costo ÷ 0,60 + 15 % + 12 % del costo, terminado en 900) y deja decidir a cuáles aplicarla:
// se marcan solos los que están por debajo (dentro de un mínimo y un tope), lo demás se puede
// marcar o desmarcar a mano. Nada cambia hasta confirmar la vista previa.

const GRUPOS: { v: GrupoFormula; l: string; desc: string; cls: string; activo: string }[] = [
  { v: 'debajo', l: 'Debajo de la fórmula', desc: 'Conviene actualizar', cls: 'border-orange-300 bg-orange-50 text-orange-900', activo: 'ring-2 ring-orange-500' },
  { v: 'en', l: 'En la fórmula', desc: 'No hace falta cambiar', cls: 'border-emerald-300 bg-emerald-50 text-emerald-900', activo: 'ring-2 ring-emerald-500' },
  { v: 'encima', l: 'Encima de la fórmula', desc: 'No se baja salvo que lo marques', cls: 'border-sky-300 bg-sky-50 text-sky-900', activo: 'ring-2 ring-sky-500' },
  { v: 'error', l: 'Posible error de carga', desc: 'Corregí el producto primero', cls: 'border-red-300 bg-red-50 text-red-900', activo: 'ring-2 ring-red-500' },
  { v: 'excluido', l: 'Sin fórmula', desc: 'A medida o precio manual', cls: 'border-gray-300 bg-gray-50 text-gray-800', activo: 'ring-2 ring-gray-500' },
];

interface Fila {
  p: ProductoRevision;
  formula: Formula | null;
  costoUsado: number;
  precioFormula: number | null;
  grupo: GrupoFormula;
  difPct: number | null;
}

const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 4 });

export function TabFormula({ revision, soloLectura, onCambio }: { revision: Revision; soloLectura: boolean; onCambio: () => void }) {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const [formulas, setFormulas] = useState<Formula[]>(revision.formulas);
  const [selId, setSelId] = useState<string>(revision.formulas[0]?.id ?? '');
  const [borrador, setBorrador] = useState<Formula | null>(revision.formulas[0] ?? null);
  const [guardando, setGuardando] = useState(false);
  const [ejemplo, setEjemplo] = useState(100_000);
  const [nuevaExc, setNuevaExc] = useState<{ familia: string; proveedor: string } | null>(null);

  const [base, setBase] = useState<'cargado' | 'reposicion'>('cargado');
  const [actualizarCosto, setActualizarCosto] = useState(false);
  const [minDif, setMinDif] = useState(revision.config.umbral_pct);
  const [tope, setTope] = useState(30);
  const [grupoVer, setGrupoVer] = useState<GrupoFormula>('debajo');
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VACIO);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const [asistente, setAsistente] = useState<CriterioInicial | null>(null);

  useEffect(() => {
    setFormulas(revision.formulas);
  }, [revision.formulas]);

  const guardada = formulas.find(f => f.id === selId) ?? null;
  const sucio = !!borrador && !!guardada && (['divisor', 'recargo_pct', 'adicional_costo_pct', 'redondeo_paso', 'redondeo_terminacion', 'nombre'] as const)
    .some(k => borrador[k] !== guardada[k]);
  // Mientras se editan los números se ve el efecto en vivo (con el borrador en lugar de la guardada).
  const efectivas = useMemo(() => formulas.map(f => (borrador && f.id === borrador.id ? borrador : f)), [formulas, borrador]);
  const umbral = revision.config.umbral_pct;

  const filas: Fila[] = useMemo(() => revision.productos.map(p => {
    const formula = p.precio_manual ? null : elegirFormula(efectivas, p);
    const costoUsado = base === 'reposicion' ? p.analisis.costo_reposicion : p.costo;
    const precioFormula = formula && costoUsado > 0 ? precioPorFormula(costoUsado, formula).precio : null;
    const grupo = clasificarContraFormula({ precio: p.precio, costo: p.costo, precio_manual: p.precio_manual, formula: !!formula }, precioFormula, umbral);
    const difPct = precioFormula && p.precio > 0 ? (precioFormula / p.precio - 1) * 100 : null;
    return { p, formula, costoUsado, precioFormula, grupo, difPct };
  }), [revision.productos, efectivas, base, umbral]);

  // Marcado sugerido: los de abajo de la fórmula con un aumento entre el mínimo y el tope.
  const sugeridos = useMemo(() => new Set(filas
    .filter(f => f.grupo === 'debajo' && f.difPct !== null && f.difPct >= minDif && f.difPct <= tope)
    .map(f => f.p.id)), [filas, minDif, tope]);
  useEffect(() => {
    setElegidos(new Set(sugeridos));
  }, [sugeridos]);

  const porGrupo = useMemo(() => {
    const m = new Map<GrupoFormula, Fila[]>();
    for (const f of filas) m.set(f.grupo, [...(m.get(f.grupo) ?? []), f]);
    return m;
  }, [filas]);
  const visibles = useMemo(() => {
    const ids = new Set(aplicarFiltro((porGrupo.get(grupoVer) ?? []).map(f => f.p), filtro).map(p => p.id));
    return (porGrupo.get(grupoVer) ?? []).filter(f => ids.has(f.p.id))
      .sort((a, b) => Math.abs(b.difPct ?? 0) - Math.abs(a.difPct ?? 0) || a.p.nombre.localeCompare(b.p.nombre));
  }, [porGrupo, grupoVer, filtro]);

  const marcable = (f: Fila) => f.grupo !== 'error' && f.grupo !== 'excluido' && f.precioFormula !== null;
  const toggle = (id: string) => setElegidos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const marcablesVisibles = visibles.filter(marcable);
  const todosVisibles = marcablesVisibles.length > 0 && marcablesVisibles.every(f => elegidos.has(f.p.id));
  const toggleVisibles = () => setElegidos(prev => {
    const n = new Set(prev);
    marcablesVisibles.forEach(f => (todosVisibles ? n.delete(f.p.id) : n.add(f.p.id)));
    return n;
  });

  const resumen = useMemo(() => {
    const marcadas = filas.filter(f => elegidos.has(f.p.id) && f.precioFormula !== null);
    const suben = marcadas.filter(f => f.precioFormula! > f.p.precio);
    const bajan = marcadas.filter(f => f.precioFormula! < f.p.precio);
    const prom = suben.length ? suben.reduce((a, f) => a + (f.difPct ?? 0), 0) / suben.length : null;
    const impacto = marcadas.reduce((a, f) => a + f.p.ventas_90d * (f.precioFormula! - f.p.precio), 0);
    const debajo = porGrupo.get('debajo') ?? [];
    return {
      marcadas: marcadas.length, suben: suben.length, bajan: bajan.length, prom, impacto,
      bajoMinimo: debajo.filter(f => (f.difPct ?? 0) < minDif).length,
      sobreTope: debajo.filter(f => (f.difPct ?? 0) > tope).length,
      desmarcadasAMano: debajo.filter(f => sugeridos.has(f.p.id) && !elegidos.has(f.p.id)).length,
    };
  }, [filas, elegidos, porGrupo, minDif, tope, sugeridos]);

  // ── Fórmulas: guardar, excepciones ─────────────────────────────
  const setCampo = (k: keyof ParametrosFormula | 'nombre', v: string) =>
    setBorrador(b => (b ? { ...b, [k]: k === 'nombre' ? v : Number(v) } : b));
  function elegirFormulaEditar(id: string) {
    setSelId(id);
    setBorrador(formulas.find(f => f.id === id) ?? null);
  }
  async function recargarFormulas(id?: string) {
    const fs = await api.get<Formula[]>('/productos/revision-precios/formulas');
    setFormulas(fs);
    const nueva = fs.find(f => f.id === (id ?? selId)) ?? fs[0];
    setSelId(nueva?.id ?? '');
    setBorrador(nueva ?? null);
  }
  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    try {
      await api.put(`/productos/revision-precios/formulas/${borrador.id}`, borrador);
      toast.success('Fórmula guardada');
      await recargarFormulas(borrador.id);
      onCambio();
    } catch (e) {
      toast.error('No se pudo guardar', { description: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }
  async function crearExcepcion() {
    if (!nuevaExc || (!nuevaExc.familia && !nuevaExc.proveedor)) return;
    const general = formulas.find(f => !f.tipo_abertura_id && !f.proveedor_id);
    const familia = revision.productos.find(p => p.tipo_abertura_id === nuevaExc.familia)?.familia;
    const proveedor = revision.productos.find(p => p.proveedor_id === nuevaExc.proveedor)?.proveedor;
    try {
      const r = await api.post<{ id: string }>('/productos/revision-precios/formulas', {
        ...(general ?? {}), nombre: [familia, proveedor].filter(Boolean).join(' · '),
        tipo_abertura_id: nuevaExc.familia || null, proveedor_id: nuevaExc.proveedor || null, activa: true,
      });
      setNuevaExc(null);
      toast.success('Excepción creada: ajustá sus números y guardá');
      await recargarFormulas(r.id);
    } catch (e) {
      toast.error('No se pudo crear', { description: (e as Error).message });
    }
  }
  async function borrarExcepcion(f: Formula) {
    if (!window.confirm(`¿Borrar la fórmula "${f.nombre}"? Sus productos pasan a usar la general.`)) return;
    try {
      await api.delete(`/productos/revision-precios/formulas/${f.id}`);
      await recargarFormulas(formulas.find(x => !x.tipo_abertura_id && !x.proveedor_id)?.id);
      onCambio();
    } catch (e) {
      toast.error('No se pudo borrar', { description: (e as Error).message });
    }
  }

  function abrirAplicar() {
    const usadas = [...new Set(filas.filter(f => elegidos.has(f.p.id)).map(f => f.formula?.nombre).filter(Boolean))];
    const g = formulas.find(f => !f.tipo_abertura_id && !f.proveedor_id);
    const desc = g ? ` (÷${num(g.divisor)} +${num(g.recargo_pct)} % +${num(g.adicional_costo_pct)} % costo, termina en ${g.redondeo_terminacion})` : '';
    setAsistente({
      criterio: { tipo: 'formula', base, actualizar_costo: base === 'reposicion' && actualizarCosto },
      etiqueta: `Fórmula ${usadas.join(', ') || 'de precio'}${usadas.length === 1 && usadas[0] === g?.nombre ? desc : ''}${base === 'reposicion' ? ', costo de reposición' : ''}`,
      incluir: new Set(elegidos),
    });
  }

  const familias = useMemo(() => [...new Map(revision.productos.filter(p => p.tipo === 'estandar' && p.tipo_abertura_id).map(p => [p.tipo_abertura_id!, p.familia ?? '—'])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [revision.productos]);
  const proveedores = useMemo(() => [...new Map(revision.productos.filter(p => p.tipo === 'estandar' && p.proveedor_id).map(p => [p.proveedor_id!, p.proveedor ?? '—'])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [revision.productos]);
  const alcance = (f: Formula) => !f.tipo_abertura_id && !f.proveedor_id ? 'General' : 'Excepción';
  const cuantos = (id: string) => filas.filter(f => f.formula?.id === id).length;
  const ej = borrador ? precioPorFormula(ejemplo, borrador) : null;
  const inp = 'h-9 px-2 rounded-lg border border-gray-300 text-sm tabular-nums w-full';
  const editable = esAdmin && !soloLectura;

  return (
    <div className="space-y-3">
      {/* Fórmula */}
      <section className="rounded-2xl border border-violet-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-violet-100 flex flex-wrap items-center gap-2">
          <Calculator size={16} className="text-violet-700" />
          <h2 className="text-sm font-bold text-gray-900">Fórmula de precio · productos estándar</h2>
          <div className="flex flex-wrap gap-1 ml-auto">
            {formulas.map(f => (
              <button key={f.id} type="button" onClick={() => elegirFormulaEditar(f.id)}
                className={cn('h-8 px-2.5 rounded-lg border text-xs font-semibold', selId === f.id ? 'bg-violet-700 text-white border-violet-700' : 'bg-white border-gray-300 text-gray-700 hover:border-violet-400')}>
                {f.nombre} <span className="font-normal opacity-80">· {alcance(f)} ({cuantos(f.id)})</span>
              </button>
            ))}
            {editable && (
              <button type="button" onClick={() => setNuevaExc({ familia: '', proveedor: '' })}
                className="h-8 px-2.5 rounded-lg border border-dashed border-violet-400 text-xs font-semibold text-violet-800 inline-flex items-center gap-1">
                <Plus size={13} /> Excepción
              </button>
            )}
          </div>
        </div>

        {nuevaExc && (
          <div className="px-4 py-3 bg-violet-50 border-b border-violet-100 flex flex-wrap items-end gap-2 text-xs">
            <label className="flex-1 min-w-[10rem]">Familia
              <select value={nuevaExc.familia} onChange={e => setNuevaExc({ ...nuevaExc, familia: e.target.value })} className={inp}>
                <option value="">Cualquiera</option>
                {familias.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </label>
            <label className="flex-1 min-w-[10rem]">Proveedor
              <select value={nuevaExc.proveedor} onChange={e => setNuevaExc({ ...nuevaExc, proveedor: e.target.value })} className={inp}>
                <option value="">Cualquiera</option>
                {proveedores.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </label>
            <button type="button" onClick={crearExcepcion} disabled={!nuevaExc.familia && !nuevaExc.proveedor}
              className="h-9 px-3 rounded-lg bg-violet-700 text-white font-semibold disabled:opacity-50">Crear</button>
            <button type="button" onClick={() => setNuevaExc(null)} className="h-9 px-3 rounded-lg border border-gray-300 font-semibold">Cancelar</button>
          </div>
        )}

        {borrador && (
          <div className="p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4">
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-gray-700">
                <label>1. Reservar % del costo<input type="number" step="0.5" value={borrador.adicional_costo_pct} disabled={!editable} onChange={e => setCampo('adicional_costo_pct', e.target.value)} className={inp} /></label>
                <label>2. Dividir el costo por<input type="number" step="0.01" min="0.01" max="1" value={borrador.divisor} disabled={!editable} onChange={e => setCampo('divisor', e.target.value)} className={inp} /></label>
                <label>3. Sumar %<input type="number" step="0.5" value={borrador.recargo_pct} disabled={!editable} onChange={e => setCampo('recargo_pct', e.target.value)} className={inp} /></label>
                <label>5. Terminar en<input type="number" step="100" value={borrador.redondeo_terminacion} disabled={!editable} onChange={e => setCampo('redondeo_terminacion', e.target.value)} className={inp} /></label>
                <label>cada<input type="number" step="100" value={borrador.redondeo_paso} disabled={!editable} onChange={e => setCampo('redondeo_paso', e.target.value)} className={inp} /></label>
              </div>
              <p className="text-xs text-gray-700">
                Precio = (costo ÷ {num(borrador.divisor)} × {num(1 + borrador.recargo_pct / 100)}) + costo × {num(borrador.adicional_costo_pct / 100)}
                {borrador.redondeo_paso > 0 ? <> → redondeo hacia arriba terminado en <b>{borrador.redondeo_terminacion}</b></> : ' (sin redondeo)'}.
                {' '}Paso 4: se suma lo reservado en el paso 1.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {editable && (
                  <button type="button" onClick={guardar} disabled={!sucio || guardando}
                    className="h-9 px-3 rounded-lg bg-violet-700 text-white text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1.5">
                    {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar fórmula
                  </button>
                )}
                {sucio && <button type="button" onClick={() => setBorrador(guardada)} className="h-9 px-3 rounded-lg border border-gray-300 text-xs font-semibold">Descartar cambios</button>}
                {sucio && <span className="text-[11px] text-amber-800 font-semibold">Estás viendo el efecto sin guardar.</span>}
                {editable && guardada && alcance(guardada) === 'Excepción' && (
                  <button type="button" onClick={() => borrarExcepcion(guardada)} className="ml-auto h-9 px-3 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 inline-flex items-center gap-1">
                    <Trash2 size={13} /> Borrar excepción
                  </button>
                )}
                {!esAdmin && <span className="text-[11px] text-gray-600">Solo un administrador cambia la fórmula.</span>}
              </div>
            </div>
            {ej && (
              <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 text-xs">
                <label className="flex items-center gap-2 font-semibold text-violet-900">Ejemplo con costo
                  <input type="number" step="1000" value={ejemplo} onChange={e => setEjemplo(Number(e.target.value) || 0)} className={cn(inp, 'w-32 bg-white')} />
                </label>
                <ol className="mt-2 space-y-0.5 text-gray-800">
                  {ej.pasos.map((p, i) => (
                    <li key={i} className="flex justify-between gap-2"><span>{i + 1}. {p.texto}</span><span className="tabular-nums">{fmt$(p.valor)}</span></li>
                  ))}
                </ol>
                <p className="mt-1.5 pt-1.5 border-t border-violet-200 flex justify-between font-bold text-violet-900">
                  <span>Precio de venta</span><span className="tabular-nums">{fmt$(ej.precio)}</span>
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Cómo decidir */}
      <div className="rounded-xl border border-gray-300 bg-white px-4 py-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-gray-800">
        <label className="space-y-1">Costo para calcular
          <select value={base} onChange={e => setBase(e.target.value as 'cargado' | 'reposicion')} className={inp}>
            <option value="cargado">Costo cargado</option>
            <option value="reposicion">Costo de reposición (lista o última compra si subió)</option>
          </select>
          {base === 'reposicion' && (
            <span className="flex items-center gap-1.5"><input type="checkbox" checked={actualizarCosto} onChange={e => setActualizarCosto(e.target.checked)} /> Actualizar también el costo cargado</span>
          )}
        </label>
        <label className="space-y-1">No tocar si la diferencia es menor a (%)
          <input type="number" step="0.5" min="0" value={minDif} onChange={e => setMinDif(Number(e.target.value) || 0)} className={inp} />
        </label>
        <label className="space-y-1">No marcar aumentos mayores a (%)
          <input type="number" step="5" min="0" value={tope} onChange={e => setTope(Number(e.target.value) || 0)} className={inp} />
        </label>
        <p className="text-[11px] text-gray-600 self-center">
          Se marcan solos los que están <b>debajo de la fórmula</b> con un aumento entre el mínimo y el tope. Podés marcar o
          desmarcar cualquiera; un precio <b>encima</b> de la fórmula baja solo si lo marcás vos.
        </p>
      </div>

      {/* Grupos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {GRUPOS.map(g => {
          const fs = porGrupo.get(g.v) ?? [];
          const marc = fs.filter(f => elegidos.has(f.p.id)).length;
          return (
            <button key={g.v} type="button" onClick={() => setGrupoVer(g.v)} aria-pressed={grupoVer === g.v}
              className={cn('text-left rounded-xl border px-3 py-2', g.cls, grupoVer === g.v && g.activo)}>
              <p className="text-xl font-extrabold tabular-nums">{fs.length}</p>
              <p className="text-xs font-bold leading-tight">{g.l}</p>
              <p className="text-[11px] opacity-80">{marc > 0 ? `${marc} marcados para aplicar` : g.desc}</p>
            </button>
          );
        })}
      </div>

      <Filtros productos={(porGrupo.get(grupoVer) ?? []).map(f => f.p)} filtro={filtro} onChange={setFiltro} />

      <div className="rounded-2xl border border-gray-300 bg-white overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <button type="button" onClick={toggleVisibles} disabled={!marcablesVisibles.length}
            className="inline-flex items-center gap-2 text-xs font-semibold text-violet-800 disabled:opacity-40">
            <Casilla checked={todosVisibles} /> Marcar los {marcablesVisibles.length} de la lista
          </button>
          <span className="hidden md:inline text-[11px] text-gray-600 ml-auto">Costo usado · precio actual → fórmula · diferencia · veces el costo</span>
        </div>
        {visibles.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-600">No hay productos en este grupo con estos filtros.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibles.map(f => {
              const { p } = f;
              const on = elegidos.has(p.id);
              const desglose = f.formula && f.costoUsado > 0 ? precioPorFormula(f.costoUsado, f.formula) : null;
              return (
                <div key={p.id} className={cn(on && 'bg-violet-50/50')}>
                  <div className="px-4 py-2.5 grid grid-cols-[auto_1fr_auto] lg:grid-cols-[auto_minmax(0,1.8fr)_7rem_11rem_6.5rem_minmax(0,1.3fr)_auto] gap-x-3 gap-y-1 items-center">
                    <button type="button" onClick={() => marcable(f) && toggle(p.id)} disabled={!marcable(f)} aria-label={`Elegir ${p.nombre}`} aria-pressed={on}
                      className="disabled:opacity-30"><Casilla checked={on} /></button>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.nombre}
                        {p.precio_manual && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">precio manual</span>}
                      </p>
                      <p className="text-[11px] text-gray-600 truncate">{[p.codigo, p.familia ?? 'Sin familia', p.proveedor, f.formula && f.formula.nombre !== formulas[0]?.nombre ? `fórmula ${f.formula.nombre}` : null].filter(Boolean).join(' · ')}</p>
                    </div>
                    <p className="col-start-2 lg:col-start-auto text-left lg:text-right text-xs text-gray-700 tabular-nums leading-tight">
                      costo<br className="hidden lg:block" /> <b className="text-sm text-gray-900">{fmt$(f.costoUsado)}</b>
                    </p>
                    <div className="col-start-2 lg:col-start-auto text-left lg:text-right leading-tight tabular-nums">
                      <p className="text-xs text-gray-600">{fmt$(p.precio)} →</p>
                      <p className="text-sm font-extrabold text-violet-800">{f.precioFormula !== null ? fmt$(f.precioFormula) : '—'}</p>
                    </div>
                    <p className={cn('col-start-2 lg:col-start-auto text-sm font-bold lg:text-right tabular-nums',
                      (f.difPct ?? 0) > 0 ? 'text-orange-700' : (f.difPct ?? 0) < 0 ? 'text-sky-700' : 'text-gray-700')}>
                      {f.difPct !== null ? fmtPct(f.difPct) : '—'}
                      {f.precioFormula !== null && <span className="block text-[11px] font-normal text-gray-600">{(f.precioFormula - p.precio >= 0 ? '+' : '−') + fmt$(Math.abs(f.precioFormula - p.precio)).replace('$ ', '$')}</span>}
                    </p>
                    <div className="col-start-2 col-span-2 lg:col-span-1 lg:col-start-auto text-[11px] text-gray-600 space-y-0.5">
                      <p>{p.costo > 0 ? `${(p.precio / p.costo).toLocaleString('es-AR', { maximumFractionDigits: 3 })} veces el costo` : 'sin costo'}
                        {f.difPct !== null && f.difPct > tope && f.grupo === 'debajo' && <span className="ml-1.5 font-semibold text-amber-800">sobre el tope</span>}
                        {f.grupo === 'encima' && on && <span className="ml-1.5 font-semibold text-red-700">baja de precio</span>}
                      </p>
                      <p className="flex flex-wrap gap-x-2">
                        <span className={colorDias(p.dias, revision.config)}>Renovado {fmtFecha(p.precio_actualizado_at)}</span>
                        {p.ventas_90d > 0 && <span className="inline-flex items-center gap-0.5"><ShoppingBag size={11} />{p.ventas_90d}</span>}
                        {p.proformas_abiertas > 0 && <span className="inline-flex items-center gap-0.5" title="Proformas abiertas: no cambian su precio"><FileText size={11} />{p.proformas_abiertas}</span>}
                      </p>
                      {f.grupo === 'error' && (
                        <Link to={`/productos/${p.id}/editar`} className="inline-flex items-center gap-1 font-semibold text-red-700 hover:underline">
                          Corregir el producto <ExternalLink size={11} />
                        </Link>
                      )}
                    </div>
                    <button type="button" onClick={() => setAbierto(a => a === p.id ? null : p.id)}
                      className="col-start-3 row-start-1 lg:col-start-auto lg:row-start-auto text-[11px] font-semibold text-gray-600 hover:text-violet-800 inline-flex items-center gap-0.5">
                      {abierto === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Detalle
                    </button>
                  </div>
                  {abierto === p.id && (
                    <div className="px-4 pb-3 lg:pl-12 grid grid-cols-1 md:grid-cols-[18rem_1fr] gap-4">
                      {desglose ? (
                        <ol className="text-xs text-gray-800 space-y-0.5 rounded-lg bg-violet-50 border border-violet-100 p-2.5">
                          <li className="font-semibold text-violet-900 mb-1">Fórmula {f.formula!.nombre} con costo {fmt$(f.costoUsado)}</li>
                          {desglose.pasos.map((x, i) => <li key={i} className="flex justify-between gap-2"><span>{i + 1}. {x.texto}</span><span className="tabular-nums">{fmt$(x.valor)}</span></li>)}
                        </ol>
                      ) : <p className="text-xs text-gray-600">Este producto no tiene fórmula (no es estándar o tiene precio manual).</p>}
                      <HistorialPrecios productoId={p.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resumen de la decisión */}
      <div className="sticky bottom-2 rounded-2xl border border-violet-300 bg-white/95 backdrop-blur shadow-lg px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-800">
        <span><b className="text-base text-violet-900">{resumen.marcadas}</b> para aplicar{resumen.prom !== null && <> · aumento prom. <b>{fmtPct(resumen.prom)}</b></>}</span>
        {resumen.bajan > 0 && <span className="font-semibold text-red-700">{resumen.bajan} bajan de precio</span>}
        {resumen.impacto !== 0 && <span title="Si se hubiera vendido lo mismo que en los últimos 90 días">sobre lo vendido en 90 d: <b>{resumen.impacto > 0 ? '+' : ''}{fmt$(resumen.impacto)}</b></span>}
        <span className="text-gray-600">
          Sin aplicar: {(porGrupo.get('en') ?? []).length} en la fórmula · {(porGrupo.get('encima') ?? []).filter(f => !elegidos.has(f.p.id)).length} encima ·{' '}
          {(porGrupo.get('error') ?? []).length} con error
          {resumen.bajoMinimo > 0 && <> · {resumen.bajoMinimo} bajo el mínimo</>}
          {resumen.sobreTope > 0 && <> · {resumen.sobreTope} sobre el tope</>}
          {resumen.desmarcadasAMano > 0 && <> · {resumen.desmarcadasAMano} desmarcados a mano</>}
        </span>
        {!soloLectura && (
          <span className="ml-auto flex items-center gap-2">
            {sucio && <span className="text-[11px] font-semibold text-amber-800">Guardá la fórmula para aplicar</span>}
            <button type="button" onClick={abrirAplicar} disabled={!resumen.marcadas || sucio}
              className="h-10 px-4 rounded-xl bg-violet-700 text-white text-sm font-bold hover:bg-violet-800 disabled:opacity-50 inline-flex items-center gap-2">
              <Calculator size={15} /> Vista previa y aplicar ({resumen.marcadas})
            </button>
          </span>
        )}
      </div>

      {asistente && (
        <AsistenteActualizar
          productos={revision.productos.filter(p => asistente.incluir.has(p.id))}
          inicial={asistente}
          onClose={() => setAsistente(null)}
          onAplicado={() => { setAsistente(null); onCambio(); }}
        />
      )}
    </div>
  );
}
