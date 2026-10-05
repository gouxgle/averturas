import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ReceiptText, ArrowRight, ArrowLeft, Check, Search, UserRound, Plus, Trash2, Landmark, AlertTriangle, XCircle, Send, Save, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toastApiError } from '@/lib/apiError';
import { cuitValido } from '@/lib/cuit';
import { scrollContenidoArriba } from '@/lib/scroll';
import { FormPageHeader } from '@/components/FormPageHeader';
import {
  CBTE_NOMBRE, COND_IVA_NOMBRE, fmt$, type NuevoComprobante, type Propuesta, type Analisis, type ItemCbte, type Receptor,
} from './tipos';

const inp = 'w-full h-11 sm:h-10 px-3 border border-gray-300 rounded-lg text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';
const card = 'bg-white rounded-2xl border border-gray-400 shadow-lg p-4 sm:p-5';
const btnPri = 'inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-4 rounded-lg bg-fuchsia-700 text-white text-sm font-semibold hover:bg-fuchsia-800 disabled:opacity-50';
const btnSec = 'inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50';

const CF: Receptor = { doc_tipo: 99, doc_nro: '0', nombre: 'Consumidor Final', condicion_iva_id: 5 };
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// Total de la línea en centavos, con el mismo redondeo que el servidor (calculo.ts): precio a
// 2 decimales, cantidad a 3 y sin el error de los flotantes (1,005 × 100 = 100,4999…).
const redondear = (x: number) => Math.round(Number(x.toPrecision(15)));
const totalLineaCent = (i: ItemCbte) => {
  const precioC = redondear((i.precio_unitario || 0) * 100);
  const cantidad = redondear((i.cantidad || 0) * 1000) / 1000;
  return redondear(cantidad * precioC) - redondear((i.bonificacion ?? 0) * 100);
};

const itemVacio = (): ItemCbte => ({ descripcion: '', cantidad: 1, precio_unitario: 0, alicuota: 21 });
interface CambioFicha { campo: string; etiqueta: string; antes: string | null; despues: string }
interface RespuestaReceptor {
  receptor: Receptor; cliente_id: string; faltantes: string[]; cuit_conocido: string | null; cambios?: CambioFicha[];
}
const letraDe = (cond: number) => ([1, 6, 13, 16].includes(cond) ? 'A' : 'B');

interface ClienteBusqueda { id: string; nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string; documento_nro: string | null }
const nombreCliente = (c: ClienteBusqueda) =>
  c.tipo_persona === 'juridica' ? (c.razon_social ?? c.nombre ?? '') : [c.apellido, c.nombre].filter(Boolean).join(' ');

export default function NuevaFactura() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const origenParam = params.get('recibo_id') ? `recibo_id=${params.get('recibo_id')}`
    : params.get('operacion_id') ? `operacion_id=${params.get('operacion_id')}`
      : params.get('factura_id') ? `factura_id=${params.get('factura_id')}${params.get('tipo') === 'nota_debito' ? '&tipo=nota_debito' : ''}` : null;

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [comp, setComp] = useState<NuevoComprobante>({ tipo_doc: 'factura', receptor: CF, items: [itemVacio()], fecha: hoy(), origen: 'manual' });
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [cargando, setCargando] = useState(!!origenParam);
  const [habilitada, setHabilitada] = useState<boolean | null>(null);

  useEffect(() => { scrollContenidoArriba(); }, [paso]);
  useEffect(() => {
    api.get<{ habilitada: boolean }>('/facturacion/estado').then(r => setHabilitada(r.habilitada)).catch(() => {});
    if (!origenParam) return;
    api.get<Propuesta>(`/facturacion/preparar?${origenParam}`)
      .then(p => {
        setPropuesta(p);
        setComp({ ...p.comprobante, fecha: p.comprobante.fecha ?? hoy() });
        setPaso(p.comprobante.tipo_doc === 'factura' ? 1 : 2);
      })
      .catch(e => toastApiError(e))
      .finally(() => setCargando(false));
  }, [origenParam]);

  const esNC = comp.tipo_doc === 'nota_credito';
  const esNota = comp.tipo_doc !== 'factura';
  const titulo = esNC ? 'Nueva nota de crédito' : comp.tipo_doc === 'nota_debito' ? 'Nueva nota de débito' : 'Nueva factura';
  const pasos = [{ n: 1, l: 'Cliente' }, { n: 2, l: 'Ítems' }, { n: 3, l: 'Revisar y emitir' }] as const;

  if (cargando) return <div className="p-6 text-sm text-gray-600">Preparando…</div>;

  return (
    <div className="p-3 sm:p-4 xl:p-6 max-w-5xl mx-auto space-y-4" data-section="facturacion">
      <FormPageHeader onBack={() => navigate(-1)} icon={ReceiptText} iconColorClass="bg-fuchsia-100 text-fuchsia-700" title={titulo}
        sub={propuesta ? `Desde ${propuesta.referencia}` : 'Carga manual'} />

      {habilitada === false && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
          <Info size={16} className="shrink-0 mt-0.5" />
          La facturación todavía no está habilitada: podés armar y guardar el borrador, pero no emitirlo.
        </div>
      )}
      {propuesta && (propuesta.avisos.length > 0 || propuesta.facturado > 0) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
          <p><b>{propuesta.referencia}</b>: total {fmt$(propuesta.total_origen)} · {esNC ? 'queda por acreditar' : 'queda por facturar'} <b>{fmt$(propuesta.saldo)}</b></p>
          {propuesta.avisos.map((a, i) => <p key={i}>{a}</p>)}
        </div>
      )}

      {/* Pasos */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {pasos.filter(p => !esNota || p.n !== 1).map((p, i, arr) => (
          <div key={p.n} className="flex items-center gap-2 shrink-0">
            <button onClick={() => p.n < paso && setPaso(p.n)} disabled={p.n >= paso}
              className={cn('flex items-center gap-2 px-3 h-9 rounded-full text-xs font-semibold border',
                paso === p.n ? 'bg-fuchsia-700 text-white border-fuchsia-700' : p.n < paso ? 'bg-white text-fuchsia-700 border-fuchsia-300' : 'bg-white text-gray-400 border-gray-200')}>
              <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px]', paso === p.n ? 'bg-white/20' : p.n < paso ? 'bg-fuchsia-100' : 'bg-gray-100')}>
                {p.n < paso ? <Check size={11} /> : p.n}
              </span>
              {p.l}
            </button>
            {i < arr.length - 1 && <ArrowRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {paso === 1 && <PasoCliente comp={comp} setComp={setComp} onSeguir={() => setPaso(2)} />}
      {paso === 2 && <PasoItems comp={comp} setComp={setComp} esNota={esNota} onVolver={() => setPaso(1)} onSeguir={() => setPaso(3)} />}
      {paso === 3 && <PasoRevision comp={comp} setComp={setComp} habilitada={!!habilitada} onVolver={() => setPaso(2)}
        onListo={id => navigate(`/facturacion?cbte=${id}`, { replace: true })} />}
    </div>
  );
}

// ── Paso 1: cliente ──────────────────────────────────────────────────────────
function PasoCliente({ comp, setComp, onSeguir }: {
  comp: NuevoComprobante; setComp: React.Dispatch<React.SetStateAction<NuevoComprobante>>; onSeguir: () => void;
}) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<ClienteBusqueda[]>([]);
  const [trayendo, setTrayendo] = useState(false);
  const [cambiosFicha, setCambiosFicha] = useState<CambioFicha[]>([]);
  const [faltaDocumento, setFaltaDocumento] = useState(false);
  const r = comp.receptor;
  const setR = (cambios: Partial<Receptor>) => setComp(c => ({ ...c, receptor: { ...c.receptor, ...cambios } }));

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      api.get<ClienteBusqueda[]>(`/clientes?search=${encodeURIComponent(q.trim())}`)
        .then(l => setResultados(l.slice(0, 8))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Con un cliente de la base: si en su ficha faltan datos fiscales y se conoce el CUIT, se
  // buscan en ARCA y se guardan en la ficha (así la próxima factura ya sale completa). Si no
  // hay ARCA configurado o falla, se sigue con lo que hay: nunca bloquea.
  async function prepararCliente(id: string) {
    setCambiosFicha([]); setFaltaDocumento(false);
    try {
      let x = await api.get<RespuestaReceptor>(`/facturacion/receptor/${id}`);
      setComp(p => ({ ...p, receptor: x.receptor, cliente_id: x.cliente_id }));
      if (x.cuit_conocido && x.faltantes.some(f => f !== 'cuit')) {
        try {
          x = await api.post<RespuestaReceptor>(`/facturacion/clientes/${id}/completar-arca`, {});
          setComp(p => (p.cliente_id === id ? { ...p, receptor: x.receptor } : p));
          setCambiosFicha(x.cambios ?? []);
        } catch { /* sin ARCA se sigue a mano */ }
      }
      setFaltaDocumento(x.faltantes.includes('cuit'));
    } catch (e) { toastApiError(e); }
  }

  // Si el cliente se trae por el origen (recibo, presupuesto) también se completa su ficha.
  const clienteInicial = useRef<string | null>(null);
  useEffect(() => {
    if (comp.cliente_id && clienteInicial.current !== comp.cliente_id) {
      clienteInicial.current = comp.cliente_id;
      void prepararCliente(comp.cliente_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp.cliente_id]);

  async function elegir(c: ClienteBusqueda) {
    clienteInicial.current = c.id;
    setQ(''); setResultados([]);
    await prepararCliente(c.id);
  }

  async function traerDeArca() {
    setTrayendo(true);
    try {
      if (comp.cliente_id) {
        // Cliente de la base: se completa y guarda su ficha con el CUIT que está en pantalla.
        const x = await api.post<RespuestaReceptor>(`/facturacion/clientes/${comp.cliente_id}/completar-arca`, { cuit: r.doc_nro });
        setComp(p => ({ ...p, receptor: x.receptor }));
        setCambiosFicha(x.cambios ?? []); setFaltaDocumento(false);
        toast.success(x.cambios?.length ? 'Datos traídos de ARCA y guardados en la ficha del cliente' : 'La ficha ya estaba completa');
        return;
      }
      const x = await api.get<{ persona: { nombre_completo: string; domicilio_texto: string | null; condicion_iva: string } }>(
        `/facturacion/padron/${r.doc_nro.replace(/\D/g, '')}`);
      const cond: Record<string, number> = { responsable_inscripto: 1, monotributista: 6, exento: 4, consumidor_final: 5, no_alcanzado: 15, monotributo_social: 13 };
      setR({ nombre: x.persona.nombre_completo, domicilio: x.persona.domicilio_texto, condicion_iva_id: cond[x.persona.condicion_iva] ?? 5 });
      toast.success('Datos del cliente traídos de ARCA');
    } catch (e) { toastApiError(e); } finally { setTrayendo(false); }
  }

  const docValido = r.doc_tipo === 99 || (r.doc_tipo === 80 ? cuitValido(r.doc_nro) : /^\d{6,8}$/.test(r.doc_nro));
  const puedeSeguir = docValido && r.nombre.trim().length > 0;

  return (
    <div className={cn(card, 'space-y-4')}>
      <div className="relative">
        <label className={lbl}>Buscar cliente</label>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => { setQ(e.target.value); if (e.target.value.trim().length < 2) setResultados([]); }}
            placeholder="Nombre, DNI, CUIT o teléfono…" className={cn(inp, 'pl-9')} />
        </div>
        {resultados.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-72 overflow-y-auto">
            {resultados.map(c => (
              <li key={c.id}>
                <button onMouseDown={() => elegir(c)} className="w-full text-left px-3 py-2.5 hover:bg-fuchsia-50 flex items-center gap-2 min-h-11">
                  <UserRound size={15} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-900 flex-1 truncate">{nombreCliente(c)}</span>
                  {c.documento_nro && <span className="text-xs text-gray-500">{c.documento_nro}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button onClick={() => setComp(p => ({ ...p, receptor: CF, cliente_id: null }))}
          className="mt-2 text-xs font-semibold text-fuchsia-800 hover:underline">Usar "Consumidor final" sin identificar</button>
      </div>

      {cambiosFicha.length > 0 && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-900" role="status">
          <p className="font-semibold flex items-center gap-1.5"><Check size={15} /> Se completó la ficha del cliente con datos de ARCA</p>
          <ul className="mt-1 text-xs space-y-0.5">
            {cambiosFicha.filter(c => !['documento_nro', 'tipo_persona'].includes(c.campo)).map(c => (
              <li key={c.campo}><b>{c.etiqueta}:</b> {c.antes ? <>{c.antes} → {c.despues}</> : c.despues}</li>
            ))}
          </ul>
          <p className="text-[11px] mt-1 text-emerald-800">Quedó guardado: la próxima factura a este cliente sale directo.</p>
        </div>
      )}
      {faltaDocumento && comp.cliente_id && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-sm text-amber-900" role="status">
          <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={15} /> Este cliente no tiene CUIT ni DNI cargado</p>
          <p className="text-xs mt-0.5">Escribí el <b>CUIT</b> abajo y tocá <b>Traer de ARCA</b>: se completan sus datos y se guardan en la ficha para las próximas facturas. Para una factura B de poco monto alcanza con el DNI.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Documento</label>
          <div className="flex gap-2">
            <select value={r.doc_tipo} onChange={e => {
              const t = Number(e.target.value) as Receptor['doc_tipo'];
              setR(t === 99 ? { doc_tipo: 99, doc_nro: '0' } : { doc_tipo: t, doc_nro: r.doc_tipo === 99 ? '' : r.doc_nro });
            }} className={cn(inp, 'w-28 shrink-0')}>
              <option value={80}>CUIT</option>
              <option value={96}>DNI</option>
              <option value={99}>Sin identificar</option>
            </select>
            <input value={r.doc_tipo === 99 ? '' : r.doc_nro} disabled={r.doc_tipo === 99} inputMode="numeric"
              onChange={e => setR({ doc_nro: e.target.value.replace(/\D/g, '') })}
              className={cn(inp, 'min-w-0', !docValido && 'border-amber-400')} placeholder={r.doc_tipo === 80 ? '20123456789' : '12345678'} />
          </div>
          {!docValido && <p className="text-[11px] text-amber-700 mt-1">{r.doc_tipo === 80 ? 'CUIT inválido' : 'DNI inválido'}</p>}
        </div>
        <div>
          <label className={lbl}>Condición frente al IVA</label>
          <select value={r.condicion_iva_id} onChange={e => setR({ condicion_iva_id: Number(e.target.value) })} className={inp}>
            {Object.entries(COND_IVA_NOMBRE).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Nombre o razón social</label>
          <div className="flex gap-2">
            <input value={r.nombre} onChange={e => setR({ nombre: e.target.value })} className={cn(inp, 'min-w-0')} />
            {r.doc_tipo === 80 && (
              <button onClick={traerDeArca} disabled={!cuitValido(r.doc_nro) || trayendo} className={cn(btnSec, 'shrink-0 text-fuchsia-800 border-fuchsia-300 bg-fuchsia-50')}>
                <Landmark size={14} /> <span className="hidden sm:inline">{trayendo ? 'Consultando…' : 'Traer de ARCA'}</span>
              </button>
            )}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Domicilio</label>
          <input value={r.domicilio ?? ''} onChange={e => setR({ domicilio: e.target.value || null })} className={inp} />
        </div>
      </div>

      <div className="rounded-lg bg-fuchsia-50 border border-fuchsia-200 px-3 py-2 text-sm text-fuchsia-900">
        Corresponde <b>Factura {letraDe(r.condicion_iva_id)}</b>
        {letraDe(r.condicion_iva_id) === 'A' && r.doc_tipo !== 80 && <> — la factura A necesita el <b>CUIT</b> del cliente.</>}
      </div>

      <div className="flex justify-end">
        <button onClick={onSeguir} disabled={!puedeSeguir} className={btnPri}>Continuar <ArrowRight size={15} /></button>
      </div>
    </div>
  );
}

// ── Paso 2: ítems ────────────────────────────────────────────────────────────
function PasoItems({ comp, setComp, esNota, onVolver, onSeguir }: {
  comp: NuevoComprobante; setComp: React.Dispatch<React.SetStateAction<NuevoComprobante>>; esNota: boolean;
  onVolver: () => void; onSeguir: () => void;
}) {
  const setItem = (i: number, cambios: Partial<ItemCbte>) =>
    setComp(c => ({ ...c, items: c.items.map((it, j) => (j === i ? { ...it, ...cambios } : it)) }));
  const hayServicio = comp.items.some(i => i.es_servicio);
  const total = comp.items.reduce((a, i) => a + totalLineaCent(i), 0) / 100;
  const valido = comp.items.length > 0 && comp.items.every(i => i.descripcion.trim() && i.cantidad > 0 && i.precio_unitario > 0)
    && (!hayServicio || (comp.fch_serv_desde && comp.fch_serv_hasta && comp.fch_vto_pago));

  // Al marcar el primer servicio se proponen fechas (hoy): ARCA las exige con instalación.
  function marcarServicio(i: number, v: boolean) {
    setItem(i, { es_servicio: v });
    if (v && !comp.fch_serv_desde) setComp(c => ({ ...c, fch_serv_desde: c.fecha ?? hoy(), fch_serv_hasta: c.fecha ?? hoy(), fch_vto_pago: c.fecha ?? hoy() }));
  }

  return (
    <div className={cn(card, 'space-y-4')}>
      <p className="text-xs text-gray-600">Los precios se cargan <b>finales, con IVA incluido</b>, como en el resto del sistema. El sistema separa el neto y el IVA.</p>
      <ul className="space-y-3">
        {comp.items.map((it, i) => (
          <li key={i} className="rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex gap-2">
              <input value={it.descripcion} onChange={e => setItem(i, { descripcion: e.target.value })} placeholder="Descripción"
                className={cn(inp, 'min-w-0')} />
              <button onClick={() => setComp(c => ({ ...c, items: c.items.filter((_, j) => j !== i) }))} disabled={comp.items.length === 1}
                className="h-11 sm:h-10 w-11 sm:w-10 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 disabled:opacity-30" aria-label="Quitar ítem">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className={lbl}>Cantidad</label>
                <input type="number" min={0} step="any" value={it.cantidad} onChange={e => setItem(i, { cantidad: Number(e.target.value) })} className={inp} />
              </div>
              <div>
                <label className={lbl}>Precio final</label>
                <input type="number" min={0} step="0.01" value={it.precio_unitario || ''} onChange={e => setItem(i, { precio_unitario: Number(e.target.value) })} className={inp} />
              </div>
              <div>
                <label className={lbl}>Bonificación $</label>
                <input type="number" min={0} step="0.01" value={it.bonificacion || ''} onChange={e => setItem(i, { bonificacion: Number(e.target.value) || 0 })} className={inp} />
              </div>
              <div>
                <label className={lbl}>IVA</label>
                <select value={it.exento ? 'ex' : String(it.alicuota ?? 21)} className={inp}
                  onChange={e => setItem(i, e.target.value === 'ex' ? { exento: true, alicuota: 0 } : { exento: false, alicuota: Number(e.target.value) })}>
                  <option value="21">21 %</option><option value="10.5">10,5 %</option><option value="27">27 %</option>
                  <option value="0">0 %</option><option value="ex">Exento</option>
                </select>
              </div>
              <label className="col-span-2 sm:col-span-1 flex items-center gap-2 text-sm text-gray-700 sm:pt-5">
                <input type="checkbox" checked={!!it.es_servicio} onChange={e => marcarServicio(i, e.target.checked)} className="w-5 h-5 accent-fuchsia-700" />
                Servicio / instalación
              </label>
            </div>
            <p className="text-right text-sm font-semibold tabular-nums text-gray-900">
              {fmt$(totalLineaCent(it) / 100)}
            </p>
          </li>
        ))}
      </ul>
      {comp.tipo_doc !== 'nota_credito' && (
        <button onClick={() => setComp(c => ({ ...c, items: [...c.items, itemVacio()] }))} className={btnSec}><Plus size={15} /> Agregar ítem</button>
      )}
      {comp.tipo_doc === 'nota_credito' && (
        <p className="text-xs text-gray-600">Para una nota de crédito <b>parcial</b>, bajá cantidades o importes, o quitá ítems.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-200">
        <div>
          <label className={lbl}>Fecha del comprobante</label>
          <input type="date" value={comp.fecha ?? ''} onChange={e => setComp(c => ({ ...c, fecha: e.target.value }))} className={inp} />
        </div>
        {hayServicio && (
          <>
            <div>
              <label className={lbl}>Servicio desde</label>
              <input type="date" value={comp.fch_serv_desde ?? ''} onChange={e => setComp(c => ({ ...c, fch_serv_desde: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Servicio hasta</label>
              <input type="date" value={comp.fch_serv_hasta ?? ''} onChange={e => setComp(c => ({ ...c, fch_serv_hasta: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Vencimiento del pago</label>
              <input type="date" value={comp.fch_vto_pago ?? ''} onChange={e => setComp(c => ({ ...c, fch_vto_pago: e.target.value }))} className={inp} />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <p className="text-base font-extrabold text-gray-900">Total {fmt$(total)}</p>
        <div className="flex gap-2">
          {!esNota && <button onClick={onVolver} className={btnSec}><ArrowLeft size={15} /> Volver</button>}
          <button onClick={onSeguir} disabled={!valido} className={btnPri}>Revisar <ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}

// ── Paso 3: revisión ─────────────────────────────────────────────────────────
function PasoRevision({ comp, setComp, habilitada, onVolver, onListo }: {
  comp: NuevoComprobante; setComp: React.Dispatch<React.SetStateAction<NuevoComprobante>>; habilitada: boolean;
  onVolver: () => void; onListo: (id: string) => void;
}) {
  const [a, setA] = useState<Analisis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<null | 'borrador' | 'emitir'>(null);

  const cuerpo = useMemo(() => JSON.stringify(comp), [comp]);
  useEffect(() => {
    api.post<Analisis>('/facturacion/comprobantes/previsualizar', JSON.parse(cuerpo))
      .then(r => { setA(r); setError(null); })
      .catch((e: Error) => setError(e.message));
  }, [cuerpo]);

  const exceso = a?.exceso && a.exceso.exceso > 0 ? a.exceso : null;
  const bloqueado = !a || a.problemas.length > 0 || (!!exceso && !comp.confirmar_exceso);

  async function guardar(emitirTambien: boolean) {
    setTrabajando(emitirTambien ? 'emitir' : 'borrador');
    try {
      const { id } = await api.post<{ id: string }>('/facturacion/comprobantes', comp);
      if (!emitirTambien) { toast.success('Borrador guardado'); onListo(id); return; }
      const r = await api.post<{ estado: string; numero: number | null; mensajes: string[] }>(`/facturacion/comprobantes/${id}/emitir`, {});
      if (r.estado === 'autorizado') toast.success(`Autorizado por ARCA: N° ${r.numero}`, { description: r.mensajes.join('\n') || undefined });
      else if (r.estado === 'incierto') toast.warning('ARCA no confirmó todavía: el sistema lo verifica solo', { description: r.mensajes.join('\n'), duration: 12000 });
      else toast.error(r.estado === 'rechazado' ? 'ARCA rechazó el comprobante' : 'No se pudo emitir', { description: r.mensajes.join('\n'), duration: 12000 });
      onListo(id);
    } catch (e) {
      toastApiError(e, { duration: 12000 });
      setTrabajando(null);
    }
  }

  if (error) return <div className={cn(card, 'text-sm text-red-700')}>{error}</div>;
  if (!a) return <div className={cn(card, 'text-sm text-gray-600')}>Calculando…</div>;
  const im = a.importes;

  return (
    <div className={cn(card, 'space-y-4')}>
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-lg border-2 border-gray-900 flex items-center justify-center text-2xl font-black">{a.clase}</span>
        <div>
          <p className="text-base font-bold text-gray-900">{CBTE_NOMBRE[a.cbte_tipo]}</p>
          <p className="text-sm text-gray-600">{comp.receptor.nombre} · {COND_IVA_NOMBRE[comp.receptor.condicion_iva_id]}</p>
        </div>
      </div>

      {a.problemas.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="flex items-center gap-2 font-bold"><XCircle size={16} /> Hay que corregir antes de emitir:</p>
          <ul className="list-disc pl-6 mt-1">{a.problemas.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
      {exceso && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-2">
          <p className="flex items-center gap-2"><AlertTriangle size={16} className="shrink-0" />
            Supera en <b>{fmt$(exceso.exceso)}</b> lo que queda por {comp.tipo_doc === 'nota_credito' ? 'acreditar' : 'facturar'} {exceso.referencia}.</p>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={!!comp.confirmar_exceso} onChange={e => setComp(c => ({ ...c, confirmar_exceso: e.target.checked }))} className="w-5 h-5 accent-amber-600" />
            Entiendo, {comp.tipo_doc === 'nota_credito' ? 'acreditar' : 'facturar'} igual
          </label>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <ul className="divide-y divide-gray-100">
          {im.items.map((it, i) => (
            <li key={i} className="px-3 py-2 flex gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 break-words">{it.descripcion}</p>
                <p className="text-xs text-gray-500">{it.cantidad} × {fmt$(it.precio_unitario)}{(it.bonificacion ?? 0) > 0 && ` · bonif. ${fmt$(it.bonificacion!)}`}{it.es_servicio && ' · servicio'}</p>
              </div>
              <p className="font-semibold tabular-nums whitespace-nowrap">{fmt$(it.total)}</p>
            </li>
          ))}
        </ul>
        <div className="bg-gray-50 px-3 py-2 text-sm space-y-0.5">
          {a.clase === 'A' ? (
            <>
              <div className="flex justify-between"><span>Neto gravado</span><span className="tabular-nums">{fmt$(im.imp_neto)}</span></div>
              {im.alicuotas.map(x => <div key={x.alicuota_id} className="flex justify-between"><span>IVA {x.alicuota}%</span><span className="tabular-nums">{fmt$(x.importe)}</span></div>)}
              {im.imp_op_ex > 0 && <div className="flex justify-between"><span>Exento</span><span className="tabular-nums">{fmt$(im.imp_op_ex)}</span></div>}
            </>
          ) : (
            <p className="text-xs text-gray-600">Transparencia Fiscal al Consumidor (Ley 27.743): IVA contenido {fmt$(im.imp_iva)}</p>
          )}
          <div className="flex justify-between text-base font-extrabold text-gray-900 pt-1"><span>Total</span><span className="tabular-nums">{fmt$(im.imp_total)}</span></div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
        <button onClick={onVolver} className={btnSec}><ArrowLeft size={15} /> Volver</button>
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button onClick={() => guardar(false)} disabled={!!trabajando || !a || (!!exceso && !comp.confirmar_exceso)} className={btnSec}>
            <Save size={15} /> {trabajando === 'borrador' ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button onClick={() => guardar(true)} disabled={!!trabajando || bloqueado || !habilitada} className={btnPri}
            title={!habilitada ? 'La facturación todavía no está habilitada' : undefined}>
            <Send size={15} /> {trabajando === 'emitir' ? 'Enviando a ARCA…' : 'Emitir con ARCA'}
          </button>
        </div>
      </div>
    </div>
  );
}
