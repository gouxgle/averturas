import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Ruler, Plus, Trash2, Save, Loader2, Printer,
  ArrowRight, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Cliente } from '@/types';

interface VisitaTecnicaItem {
  ambiente: string; descripcion: string; ancho_mm: string; alto_mm: string;
}

interface VisitaTecnicaDetalle {
  id: string; numero: string; estado: string;
  fecha_visita: string | null; tecnico: string | null;
  color: string[]; vidrio: string[]; instalacion: string[]; abertura_especial: string[];
  observaciones: string | null;
  cliente_id: string;
  cliente: Cliente;
  items: Array<{ ambiente: string | null; descripcion: string | null; ancho_mm: string | number | null; alto_mm: string | number | null }>;
}

const COLOR_FIJOS = ['Blanco', 'Negro', 'Natural'];
const VIDRIO_FIJOS = ['Transparente', 'Esmerilado', 'Repartido', 'DVH'];
const INSTALACION_FIJOS = ['Con colocación', 'Sin colocación', 'Retira en local'];
const ABERTURA_FIJOS = ['Reja', 'Celosía', 'Persiana', 'Mosquitero'];

function emptyItem(): VisitaTecnicaItem {
  return { ambiente: '', descripcion: '', ancho_mm: '', alto_mm: '' };
}

function nombreCliente(c: Cliente) {
  return c.tipo_persona === 'juridica'
    ? (c.razon_social ?? '')
    : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim();
}

function CheckGroup({ title, fijos, valores, onToggle, otro, onOtroChange }: {
  title: string; fijos: string[]; valores: string[]; onToggle: (v: string) => void;
  otro?: string; onOtroChange?: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1.5">
        {fijos.map(f => (
          <label key={f} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={valores.includes(f)} onChange={() => onToggle(f)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-slate-700 focus:ring-slate-400" />
            {f}
          </label>
        ))}
        {onOtroChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Otro:</span>
            <input value={otro ?? ''} onChange={e => onOtroChange(e.target.value)}
              placeholder="especificar"
              className="flex-1 min-w-0 px-2 py-1 border-b border-gray-200 text-sm focus:outline-none focus:border-slate-400" />
          </div>
        )}
      </div>
    </div>
  );
}

export function CargarVisitaTecnica() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visita, setVisita] = useState<VisitaTecnicaDetalle | null>(null);

  const [fechaVisita, setFechaVisita] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [items, setItems] = useState<VisitaTecnicaItem[]>([emptyItem()]);
  const [color, setColor] = useState<string[]>([]);
  const [colorOtro, setColorOtro] = useState('');
  const [vidrio, setVidrio] = useState<string[]>([]);
  const [vidrioOtro, setVidrioOtro] = useState('');
  const [instalacion, setInstalacion] = useState<string[]>([]);
  const [aberturaEspecial, setAberturaEspecial] = useState<string[]>([]);
  const [aberturaOtro, setAberturaOtro] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.get<VisitaTecnicaDetalle>(`/visitas-tecnicas/${id}`)
      .then(v => {
        setVisita(v);
        setFechaVisita(v.fecha_visita ? v.fecha_visita.slice(0, 10) : '');
        setTecnico(v.tecnico ?? '');
        setItems(v.items.length
          ? v.items.map(it => ({
              ambiente: it.ambiente ?? '', descripcion: it.descripcion ?? '',
              ancho_mm: it.ancho_mm != null ? String(it.ancho_mm) : '',
              alto_mm: it.alto_mm != null ? String(it.alto_mm) : '',
            }))
          : [emptyItem()]);
        setColor(v.color.filter(c => COLOR_FIJOS.includes(c)));
        setColorOtro(v.color.find(c => !COLOR_FIJOS.includes(c)) ?? '');
        setVidrio(v.vidrio.filter(c => VIDRIO_FIJOS.includes(c)));
        setVidrioOtro(v.vidrio.find(c => !VIDRIO_FIJOS.includes(c)) ?? '');
        setInstalacion(v.instalacion.filter(c => INSTALACION_FIJOS.includes(c)));
        setAberturaEspecial(v.abertura_especial.filter(c => ABERTURA_FIJOS.includes(c)));
        setAberturaOtro(v.abertura_especial.find(c => !ABERTURA_FIJOS.includes(c)) ?? '');
        setObservaciones(v.observaciones ?? '');
      })
      .catch(() => toast.error('No se pudo cargar la visita técnica'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function toggle(arr: string[], setArr: (v: string[]) => void, valor: string) {
    setArr(arr.includes(valor) ? arr.filter(v => v !== valor) : [...arr, valor]);
  }

  function updateItem(idx: number, field: keyof VisitaTecnicaItem, value: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function agregarFila() { setItems(prev => [...prev, emptyItem()]); }
  function quitarFila(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  function itemsValidos() {
    return items.filter(it => it.descripcion.trim() || it.ambiente.trim() || it.ancho_mm || it.alto_mm);
  }

  async function guardar(): Promise<VisitaTecnicaDetalle | null> {
    setSaving(true);
    try {
      const body = {
        fecha_visita: fechaVisita || null,
        tecnico: tecnico.trim() || null,
        color: [...color, ...(colorOtro.trim() ? [colorOtro.trim()] : [])],
        vidrio: [...vidrio, ...(vidrioOtro.trim() ? [vidrioOtro.trim()] : [])],
        instalacion,
        abertura_especial: [...aberturaEspecial, ...(aberturaOtro.trim() ? [aberturaOtro.trim()] : [])],
        observaciones: observaciones.trim() || null,
        items: itemsValidos().map(it => ({
          ambiente: it.ambiente.trim() || null,
          descripcion: it.descripcion.trim() || null,
          ancho_mm: it.ancho_mm ? parseFloat(it.ancho_mm) : null,
          alto_mm: it.alto_mm ? parseFloat(it.alto_mm) : null,
        })),
      };
      const full = await api.put<VisitaTecnicaDetalle>(`/visitas-tecnicas/${id}`, body);
      setVisita(full);
      return full;
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al guardar');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleGuardar() {
    const r = await guardar();
    if (r) toast.success('Visita técnica actualizada');
  }

  async function handleAvanzar() {
    const validos = itemsValidos();
    if (validos.length === 0) {
      toast.error('Cargá al menos un ítem medido antes de avanzar');
      return;
    }
    const r = await guardar();
    if (!r) return;
    const itemsPrecargados = validos.map(it => ({
      descripcion: [it.ambiente, it.descripcion].filter(Boolean).join(' — '),
      medida_ancho: it.ancho_mm ? String(parseFloat(it.ancho_mm) / 1000) : '',
      medida_alto: it.alto_mm ? String(parseFloat(it.alto_mm) / 1000) : '',
    }));
    navigate('/presupuestos/nuevo', {
      state: { itemsPrecargados, clienteId: r.cliente_id, visitaTecnicaId: r.id },
    });
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">Cargando...</div>;
  }
  if (!visita) {
    return <div className="p-6 text-sm text-gray-400">Visita técnica no encontrada</div>;
  }

  const yaConvertida = visita.estado === 'convertida';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/presupuestos/visitas-tecnicas')} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={18} className="text-gray-500"/>
          </button>
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <Ruler size={18} className="text-slate-600"/>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Visita técnica {visita.numero}</h1>
            <p className="text-xs text-gray-400 flex items-center gap-1"><Users size={11}/> {nombreCliente(visita.cliente)}</p>
          </div>
        </div>
        <button onClick={() => window.open(`/imprimir/visita-tecnica?visita_id=${visita.id}`, '_blank')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:underline shrink-0">
          <Printer size={13}/> Imprimir
        </button>
      </div>

      {yaConvertida && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          Esta visita ya generó un presupuesto. Los datos quedan solo como historial.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Fecha de visita</label>
            <input type="date" value={fechaVisita} onChange={e => setFechaVisita(e.target.value)} disabled={yaConvertida}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Técnico</label>
            <input value={tecnico} onChange={e => setTecnico(e.target.value)} disabled={yaConvertida}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Aberturas medidas</p>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1.4fr_80px_80px_auto] gap-2 items-center">
              <input value={it.ambiente} onChange={e => updateItem(idx, 'ambiente', e.target.value)} placeholder="Ambiente" disabled={yaConvertida}
                className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
              <input value={it.descripcion} onChange={e => updateItem(idx, 'descripcion', e.target.value)} placeholder="Descripción" disabled={yaConvertida}
                className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
              <input value={it.ancho_mm} onChange={e => updateItem(idx, 'ancho_mm', e.target.value)} placeholder="Ancho mm" type="number" disabled={yaConvertida}
                className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
              <input value={it.alto_mm} onChange={e => updateItem(idx, 'alto_mm', e.target.value)} placeholder="Alto mm" type="number" disabled={yaConvertida}
                className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
              {!yaConvertida && (
                <button onClick={() => quitarFila(idx)} disabled={items.length === 1}
                  className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30">
                  <Trash2 size={15}/>
                </button>
              )}
            </div>
          ))}
        </div>
        {!yaConvertida && (
          <button onClick={agregarFila} className="mt-3 text-xs font-semibold text-slate-600 hover:underline flex items-center gap-1">
            <Plus size={13}/> Agregar fila
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Detalles importantes</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CheckGroup title="Color" fijos={COLOR_FIJOS} valores={color}
            onToggle={v => !yaConvertida && toggle(color, setColor, v)}
            otro={colorOtro} onOtroChange={yaConvertida ? undefined : setColorOtro}/>
          <CheckGroup title="Vidrio" fijos={VIDRIO_FIJOS} valores={vidrio}
            onToggle={v => !yaConvertida && toggle(vidrio, setVidrio, v)}
            otro={vidrioOtro} onOtroChange={yaConvertida ? undefined : setVidrioOtro}/>
          <CheckGroup title="Instalación" fijos={INSTALACION_FIJOS} valores={instalacion}
            onToggle={v => !yaConvertida && toggle(instalacion, setInstalacion, v)}/>
          <CheckGroup title="Abertura especial" fijos={ABERTURA_FIJOS} valores={aberturaEspecial}
            onToggle={v => !yaConvertida && toggle(aberturaEspecial, setAberturaEspecial, v)}
            otro={aberturaOtro} onOtroChange={yaConvertida ? undefined : setAberturaOtro}/>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Observaciones</label>
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} disabled={yaConvertida}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
      </div>

      {!yaConvertida && (
        <div className="flex gap-2">
          <button onClick={handleGuardar} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} Guardar
          </button>
          <button onClick={handleAvanzar} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin"/> : <ArrowRight size={15}/>} Avanzar a presupuesto
          </button>
        </div>
      )}

      {yaConvertida && (
        <Link to="/presupuestos/visitas-tecnicas"
          className="block text-center py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-semibold">
          Volver al listado
        </Link>
      )}
    </div>
  );
}
