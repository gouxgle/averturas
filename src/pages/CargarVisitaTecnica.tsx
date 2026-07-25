import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Ruler, Plus, Trash2, Save, Loader2, Printer,
  ArrowRight, Users, Camera, X, Wrench, Package, Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Cliente } from '@/types';

type TipoItemVisita = 'a_medida' | 'servicio' | 'estandar';

interface CatalogoProductoLite {
  id: string; nombre: string; codigo: string | null; precio_base: number;
  imagenes: string[]; imagen_url: string | null;
}

interface VisitaTecnicaItem {
  ambiente: string; descripcion: string; ancho_mm: string; alto_mm: string;
  tipo_item: TipoItemVisita;
  producto_id: string; producto_nombre: string;
}

interface VisitaTecnicaDetalle {
  id: string; numero: string; estado: string;
  fecha_visita: string | null; tecnico: string | null;
  color: string[]; vidrio: string[]; instalacion: string[]; abertura_especial: string[];
  observaciones: string | null;
  imagenes: string[];
  cliente_id: string;
  cliente: Cliente;
  items: Array<{
    ambiente: string | null; descripcion: string | null;
    ancho_mm: string | number | null; alto_mm: string | number | null;
    tipo_item?: TipoItemVisita; producto_id?: string | null; producto_nombre?: string | null;
  }>;
}

const COLOR_FIJOS = ['Blanco', 'Negro', 'Natural'];
const VIDRIO_FIJOS = ['Transparente', 'Esmerilado', 'Repartido', 'DVH'];
const INSTALACION_FIJOS = ['Con colocación', 'Sin colocación', 'Retira en local'];
const ABERTURA_FIJOS = ['Reja', 'Celosía', 'Persiana', 'Mosquitero'];

function emptyItem(): VisitaTecnicaItem {
  return { ambiente: '', descripcion: '', ancho_mm: '', alto_mm: '', tipo_item: 'a_medida', producto_id: '', producto_nombre: '' };
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
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [productos, setProductos] = useState<CatalogoProductoLite[]>([]);
  const [buscarProductoIdx, setBuscarProductoIdx] = useState<number | null>(null);
  const [buscarProductoQ, setBuscarProductoQ] = useState('');

  useEffect(() => {
    api.get<CatalogoProductoLite[]>('/catalogo/productos').then(setProductos).catch(() => {});
  }, []);

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
              tipo_item: it.tipo_item === 'servicio' ? 'servicio' : it.tipo_item === 'estandar' ? 'estandar' : 'a_medida',
              producto_id: it.producto_id ?? '', producto_nombre: it.producto_nombre ?? '',
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
        setImagenes(v.imagenes ?? []);
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

  function toggleTipoItem(idx: number, tipo: TipoItemVisita) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, tipo_item: tipo } : it));
  }

  function seleccionarProducto(idx: number, p: CatalogoProductoLite) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, producto_id: p.id, producto_nombre: p.nombre } : it));
    setBuscarProductoIdx(null);
    setBuscarProductoQ('');
  }

  const productosFiltrados = buscarProductoQ.trim()
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(buscarProductoQ.toLowerCase()) ||
        (p.codigo ?? '').toLowerCase().includes(buscarProductoQ.toLowerCase()))
    : productos;

  function agregarFila() { setItems(prev => [...prev, emptyItem()]); }
  function quitarFila(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingImg(true);
    try {
      const token = sessionStorage.getItem('aberturas_token');
      const newUrls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('imagen', file);
        const res = await fetch('/api/visitas-tecnicas/upload-imagen', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (!res.ok) throw new Error('Error al subir imagen');
        const { url } = await res.json();
        newUrls.push(url);
      }
      setImagenes(prev => [...prev, ...newUrls]);
      toast.success(newUrls.length === 1 ? 'Foto cargada' : `${newUrls.length} fotos cargadas`);
    } catch {
      toast.error('No se pudo subir la foto');
    } finally {
      setUploadingImg(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function quitarImagen(idx: number) {
    setImagenes(prev => prev.filter((_, i) => i !== idx));
  }

  function itemsValidos() {
    return items.filter(it => it.descripcion.trim() || it.ambiente.trim() || it.ancho_mm || it.alto_mm || it.producto_id);
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
        imagenes,
        items: itemsValidos().map(it => ({
          ambiente: it.ambiente.trim() || null,
          descripcion: it.descripcion.trim() || null,
          ancho_mm: it.ancho_mm ? parseFloat(it.ancho_mm) : null,
          alto_mm: it.alto_mm ? parseFloat(it.alto_mm) : null,
          tipo_item: it.tipo_item,
          producto_id: it.tipo_item === 'estandar' ? (it.producto_id || null) : null,
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
      medida_ancho: it.tipo_item === 'a_medida' && it.ancho_mm ? String(parseFloat(it.ancho_mm) / 1000) : '',
      medida_alto: it.tipo_item === 'a_medida' && it.alto_mm ? String(parseFloat(it.alto_mm) / 1000) : '',
      tipo_item: it.tipo_item,
      producto_id: it.tipo_item === 'estandar' ? it.producto_id : '',
    }));
    navigate('/presupuestos/nuevo', {
      state: { itemsPrecargados, clienteId: r.cliente_id, visitaTecnicaId: r.id, imagenesVisita: r.imagenes ?? [] },
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
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Ítems relevados</p>
        <p className="text-[11px] text-gray-400 mb-3">Marcá cada uno como abertura a medir (obra nueva), producto de catálogo (estándar) o servicio (reparación, mantenimiento, cambio de piezas)</p>
        <div className="space-y-2">
          {items.map((it, idx) => {
            const esServicio = it.tipo_item === 'servicio';
            const esEstandar = it.tipo_item === 'estandar';
            const esAMedida = it.tipo_item === 'a_medida';
            return (
            <div key={idx} className="relative flex flex-col sm:flex-row gap-2 sm:items-center p-2 rounded-lg border border-gray-100">
              {/* Toggle tipo de ítem */}
              <div className="flex shrink-0 rounded-lg border border-gray-200 overflow-hidden w-fit">
                <button type="button" onClick={() => toggleTipoItem(idx, 'a_medida')} disabled={yaConvertida}
                  title="Abertura a medir"
                  className={`p-2 ${esAMedida ? 'bg-slate-700 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                  <Ruler size={14}/>
                </button>
                <button type="button" onClick={() => toggleTipoItem(idx, 'estandar')} disabled={yaConvertida}
                  title="Producto de catálogo (estándar)"
                  className={`p-2 border-l border-gray-200 ${esEstandar ? 'bg-sky-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                  <Package size={14}/>
                </button>
                <button type="button" onClick={() => toggleTipoItem(idx, 'servicio')} disabled={yaConvertida}
                  title="Servicio (reparación/mantenimiento)"
                  className={`p-2 border-l border-gray-200 ${esServicio ? 'bg-amber-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                  <Wrench size={14}/>
                </button>
              </div>

              {esEstandar ? (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-2 items-center">
                  <input value={it.ambiente} onChange={e => updateItem(idx, 'ambiente', e.target.value)} placeholder="Ambiente" disabled={yaConvertida}
                    className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
                  <div className="relative">
                    <button type="button" disabled={yaConvertida}
                      onClick={() => { setBuscarProductoIdx(idx); setBuscarProductoQ(''); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 border border-gray-200 rounded-lg text-sm text-left disabled:bg-gray-50 hover:border-sky-300">
                      <Search size={13} className="text-gray-300 shrink-0"/>
                      <span className={it.producto_nombre ? 'text-gray-800' : 'text-gray-300'}>
                        {it.producto_nombre || 'Buscar producto del catálogo...'}
                      </span>
                    </button>
                    {buscarProductoIdx === idx && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                          <input autoFocus value={buscarProductoQ} onChange={e => setBuscarProductoQ(e.target.value)}
                            onBlur={() => setTimeout(() => setBuscarProductoIdx(null), 150)}
                            placeholder="Nombre o código..."
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300"/>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {productosFiltrados.length === 0 ? (
                            <p className="text-xs text-gray-400 p-3 text-center">Sin resultados</p>
                          ) : productosFiltrados.slice(0, 30).map(p => (
                            <button key={p.id} type="button" onMouseDown={() => seleccionarProducto(idx, p)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-sky-50 text-left border-b border-gray-50 last:border-0">
                              <div className="w-7 h-7 rounded bg-gray-50 overflow-hidden shrink-0">
                                {(p.imagenes?.[0] || p.imagen_url) && <img src={p.imagenes?.[0] || p.imagen_url!} alt="" className="w-full h-full object-cover"/>}
                              </div>
                              <span className="text-xs text-gray-700 flex-1 truncate">{p.nombre}</span>
                              {p.codigo && <span className="font-mono text-[9px] text-gray-400">{p.codigo}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_80px_80px] gap-2 items-center">
                  <input value={it.ambiente} onChange={e => updateItem(idx, 'ambiente', e.target.value)} placeholder="Ambiente" disabled={yaConvertida}
                    className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
                  <input value={it.descripcion} onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                    placeholder={esServicio ? 'Ej: Ajuste de bisagra, cambio de burlete...' : 'Descripción'} disabled={yaConvertida}
                    className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
                  {!esServicio && (
                    <>
                      <input value={it.ancho_mm} onChange={e => updateItem(idx, 'ancho_mm', e.target.value)} placeholder="Ancho mm" type="number" disabled={yaConvertida}
                        className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
                      <input value={it.alto_mm} onChange={e => updateItem(idx, 'alto_mm', e.target.value)} placeholder="Alto mm" type="number" disabled={yaConvertida}
                        className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
                    </>
                  )}
                </div>
              )}

              {!yaConvertida && (
                <button onClick={() => quitarFila(idx)} disabled={items.length === 1}
                  className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30 shrink-0">
                  <Trash2 size={15}/>
                </button>
              )}
            </div>
            );
          })}
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
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Fotos de la visita</p>
        <div className="flex flex-wrap gap-3">
          {imagenes.map((url, idx) => (
            <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 group">
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="" className="w-full h-full object-cover"/>
              </a>
              {!yaConvertida && (
                <button onClick={() => quitarImagen(idx)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={12}/>
                </button>
              )}
            </div>
          ))}
          {!yaConvertida && (
            <button onClick={() => fileRef.current?.click()} disabled={uploadingImg}
              className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-200 hover:border-slate-300 hover:bg-gray-50 flex flex-col items-center justify-center gap-1 text-gray-400 disabled:opacity-50">
              {uploadingImg ? <Loader2 size={18} className="animate-spin"/> : <Camera size={18}/>}
              <span className="text-[10px] font-semibold">Agregar</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
          onChange={handleImageUpload} className="hidden"/>
        {imagenes.length === 0 && yaConvertida && (
          <p className="text-xs text-gray-400">Sin fotos cargadas</p>
        )}
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
