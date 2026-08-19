import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Ruler, Plus, Trash2, Save, Loader2, Printer,
  ArrowRight, Users, Camera, X, Wrench, Package, Search, AlertTriangle, Ban, Pencil,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Cliente, TipoAbertura, Sistema } from '@/types';
import { EditItemModal, type EditableItemSpec } from '@/components/EditItemModal';

type TipoItemVisita = 'a_medida' | 'servicio' | 'estandar';

const COBRO_BADGE: Record<string, { label: (m: number) => string; cls: string }> = {
  pendiente:  { label: () => 'Sin cobrar',                       cls: 'bg-amber-100 text-amber-700' },
  cobrada:    { label: m => `Cobrada ${formatCurrency(m)}`,      cls: 'bg-emerald-100 text-emerald-700' },
  sin_cargo:  { label: () => 'Sin cargo',                        cls: 'bg-gray-100 text-gray-600' },
  bonificada: { label: () => 'Acreditada',                       cls: 'bg-violet-100 text-violet-700' },
};

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface CatalogoProductoLite {
  id: string; nombre: string; codigo: string | null; precio_base: number;
  imagenes: string[]; imagen_url: string | null;
}

interface ServicioCatalogo {
  id: string; nombre: string; descripcion: string | null; precio_base: number | null;
}

// Extiende EditableItemSpec (specs que edita el modal compartido con el presupuesto:
// tipo de abertura, sistema, color, vidrio, premarco, accesorios, foto de referencia)
// con lo propio del relevamiento (ambiente, medidas en mm, tipo/producto/servicio).
interface VisitaTecnicaItem extends EditableItemSpec {
  ambiente: string; ancho_mm: string; alto_mm: string;
  producto_id: string; producto_nombre: string;
  servicio_id: string;
}

interface VisitaTecnicaDetalle {
  id: string; numero: string; estado: string;
  operacion_id: string | null; operacion_numero: string | null;
  fecha_visita: string | null; tecnico: string | null;
  color: string[]; vidrio: string[]; instalacion: string[]; abertura_especial: string[];
  observaciones: string | null;
  imagenes: string[];
  cliente_id: string;
  cliente: Cliente;
  cobro_estado: 'pendiente' | 'cobrada' | 'sin_cargo' | 'bonificada';
  costo_cobrado: number | null;
  costo_externo: number | null;
  recibo_numero: string | null;
  items: Array<{
    ambiente: string | null; descripcion: string | null;
    ancho_mm: string | number | null; alto_mm: string | number | null;
    tipo_item?: TipoItemVisita; producto_id?: string | null; producto_nombre?: string | null;
    servicio_id?: string | null;
    tipo_abertura_id?: string | null; sistema_id?: string | null;
    vidrio?: string | null; premarco?: boolean | null; accesorios?: string[] | null;
    color?: string | null; calculo_url?: string | null;
  }>;
}

const COLOR_FIJOS = ['Blanco', 'Negro', 'Natural'];
const VIDRIO_FIJOS = ['Transparente', 'Esmerilado', 'Repartido', 'DVH'];
const INSTALACION_FIJOS = ['Con colocación', 'Sin colocación', 'Retira en local'];
const ABERTURA_FIJOS = ['Reja', 'Celosía', 'Persiana', 'Mosquitero'];

function emptyItem(): VisitaTecnicaItem {
  return {
    _key: uuid(), ambiente: '', descripcion: '', ancho_mm: '', alto_mm: '',
    tipo_item: 'a_medida', producto_id: '', producto_nombre: '', servicio_id: '',
    tipo_abertura_id: '', sistema_id: '', vidrio: '', premarco: false, accesorios: [],
    color: '', calculo_url: '', _atribAbrev: {},
  };
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
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1.5">
        {fijos.map(f => (
          <label key={f} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={valores.includes(f)} onChange={() => onToggle(f)}
              className="w-3.5 h-3.5 rounded border-gray-400 text-slate-700 focus:ring-slate-400" />
            {f}
          </label>
        ))}
        {onOtroChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Otro:</span>
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
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [fechaVisita, setFechaVisita] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [costoExterno, setCostoExterno] = useState('');
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
  const [buscarServicioIdx, setBuscarServicioIdx] = useState<number | null>(null);
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([]);
  const [tiposAbertura, setTiposAbertura] = useState<TipoAbertura[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [coloresDB, setColoresDB] = useState<{ id: string; nombre: string }[]>([]);
  const [editItemKey, setEditItemKey] = useState<string | null>(null);

  useEffect(() => {
    api.get<CatalogoProductoLite[]>('/catalogo/productos').then(setProductos).catch(() => {});
    api.get<ServicioCatalogo[]>('/catalogo/servicios').then(setServicios).catch(() => {});
    api.get<TipoAbertura[]>('/catalogo/tipos-abertura').then(setTiposAbertura).catch(() => {});
    api.get<Sistema[]>('/catalogo/sistemas').then(setSistemas).catch(() => {});
    api.get<{ id: string; nombre: string }[]>('/catalogo/colores').then(setColoresDB).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.get<VisitaTecnicaDetalle>(`/visitas-tecnicas/${id}`)
      .then(v => {
        setVisita(v);
        setFechaVisita(v.fecha_visita ? v.fecha_visita.slice(0, 10) : '');
        setTecnico(v.tecnico ?? '');
        setCostoExterno(v.costo_externo != null ? String(v.costo_externo) : '');
        setItems(v.items.length
          ? v.items.map(it => ({
              _key: uuid(),
              ambiente: it.ambiente ?? '', descripcion: it.descripcion ?? '',
              ancho_mm: it.ancho_mm != null ? String(it.ancho_mm) : '',
              alto_mm: it.alto_mm != null ? String(it.alto_mm) : '',
              tipo_item: it.tipo_item === 'servicio' ? 'servicio' : it.tipo_item === 'estandar' ? 'estandar' : 'a_medida',
              producto_id: it.producto_id ?? '', producto_nombre: it.producto_nombre ?? '',
              servicio_id: it.servicio_id ?? '',
              tipo_abertura_id: it.tipo_abertura_id ?? '', sistema_id: it.sistema_id ?? '',
              vidrio: it.vidrio ?? '', premarco: it.premarco ?? false,
              accesorios: it.accesorios ?? [], color: it.color ?? '',
              calculo_url: it.calculo_url ?? '', _atribAbrev: {},
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
      .catch(() => toast.error('No se pudo cargar la Visita de Relevamiento de Datos'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function toggle(arr: string[], setArr: (v: string[]) => void, valor: string) {
    setArr(arr.includes(valor) ? arr.filter(v => v !== valor) : [...arr, valor]);
  }

  function updateItem(idx: number, field: keyof VisitaTecnicaItem, value: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function updateItemSpec(key: string, field: keyof EditableItemSpec, value: unknown) {
    setItems(prev => prev.map(it => it._key === key ? { ...it, [field]: value } : it));
  }

  function toggleTipoItem(idx: number, tipo: TipoItemVisita) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, tipo_item: tipo } : it));
    if (tipo === 'a_medida') {
      const key = items[idx]?._key;
      if (key) setEditItemKey(key);
    }
  }

  function seleccionarProducto(idx: number, p: CatalogoProductoLite) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, producto_id: p.id, producto_nombre: p.nombre } : it));
    setBuscarProductoIdx(null);
    setBuscarProductoQ('');
  }

  function seleccionarServicio(idx: number, s: ServicioCatalogo) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, servicio_id: s.id, descripcion: s.nombre } : it));
  }

  const productosFiltrados = buscarProductoQ.trim()
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(buscarProductoQ.toLowerCase()) ||
        (p.codigo ?? '').toLowerCase().includes(buscarProductoQ.toLowerCase()))
    : productos;

  function agregarFila() { setItems(prev => [...prev, emptyItem()]); }
  function quitarFila(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  async function uploadFiles(files: File[]) {
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
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    await uploadFiles(files);
    if (fileRef.current) fileRef.current.value = '';
  }

  // Pegar imagen desde el portapapeles (Ctrl+V) en cualquier parte del formulario
  useEffect(() => {
    if (visita?.estado === 'convertida') return;
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? []);
      const files = items
        .filter(it => it.kind === 'file' && it.type.startsWith('image/'))
        .map(it => it.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length) {
        e.preventDefault();
        uploadFiles(files);
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [visita?.estado]);

  const [draggingImg, setDraggingImg] = useState(false);
  function handleImgDragOver(e: React.DragEvent) { e.preventDefault(); setDraggingImg(true); }
  function handleImgDragLeave(e: React.DragEvent) { e.preventDefault(); setDraggingImg(false); }
  function handleImgDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingImg(false);
    const files = Array.from(e.dataTransfer.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length) uploadFiles(files);
  }

  function quitarImagen(idx: number) {
    setImagenes(prev => prev.filter((_, i) => i !== idx));
  }

  function itemsValidos() {
    return items.filter(it => it.descripcion.trim() || it.ambiente.trim() || it.ancho_mm || it.alto_mm || it.producto_id);
  }

  // El costo externo va por su propio endpoint: no forma parte del relevado y
  // debe poder cargarse aunque la visita ya esté convertida (se paga después).
  async function guardarCostoExterno() {
    if (!id) return;
    const raw = costoExterno.trim();
    const valor = raw === '' ? null : parseFloat(raw);
    if (valor != null && (isNaN(valor) || valor < 0)) { toast.error('Costo externo inválido'); return; }
    if ((visita?.costo_externo ?? null) === valor) return;
    try {
      await api.patch(`/visitas-tecnicas/${id}/costo-externo`, { costo_externo: valor });
      setVisita(prev => prev ? { ...prev, costo_externo: valor } : prev);
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo guardar el costo externo');
    }
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
          servicio_id: it.tipo_item === 'servicio' ? (it.servicio_id || null) : null,
          tipo_abertura_id: it.tipo_item === 'a_medida' ? (it.tipo_abertura_id || null) : null,
          sistema_id: it.tipo_item === 'a_medida' ? (it.sistema_id || null) : null,
          vidrio: it.tipo_item === 'a_medida' ? (it.vidrio.trim() || null) : null,
          premarco: it.tipo_item === 'a_medida' ? !!it.premarco : false,
          accesorios: it.tipo_item === 'a_medida' ? it.accesorios : [],
          color: it.tipo_item === 'a_medida' ? (it.color.trim() || null) : null,
          calculo_url: it.tipo_item === 'a_medida' ? (it.calculo_url || null) : null,
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
    if (r) toast.success('Visita de Relevamiento de Datos actualizada');
  }

  async function handleCancelar() {
    setCancelando(true);
    try {
      const v = await api.patch<VisitaTecnicaDetalle>(`/visitas-tecnicas/${id}/cancelar`);
      setVisita(v);
      setConfirmarCancelar(false);
      toast.success('Visita de Relevamiento de Datos cancelada');
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo cancelar');
    } finally {
      setCancelando(false);
    }
  }

  async function handleAvanzar() {
    const validos = itemsValidos();
    if (validos.length === 0) {
      toast.error('Cargá al menos un ítem medido antes de avanzar');
      return;
    }
    const r = await guardar();
    if (!r) return;

    // Visita ligada desde el arranque a un presupuesto que ya existía (tenía ítems
    // identificados, faltaba relevar el resto): se completan esos ítems en la misma
    // operación, no se crea un presupuesto nuevo. El endpoint valida producto_id/
    // servicio_id/tipo_abertura_id/sistema_id como UUID — hay que mandar null (no
    // string vacío) cuando no aplican, a diferencia del state de React Router de
    // abajo que tolera cualquier cosa porque no pasa por Zod.
    if (r.operacion_id && r.estado !== 'convertida') {
      const itemsCompletar = validos.map(it => ({
        descripcion: [it.ambiente, it.descripcion].filter(Boolean).join(' — '),
        medida_ancho: it.tipo_item === 'a_medida' && it.ancho_mm ? String(parseFloat(it.ancho_mm) / 1000) : undefined,
        medida_alto: it.tipo_item === 'a_medida' && it.alto_mm ? String(parseFloat(it.alto_mm) / 1000) : undefined,
        tipo_item: it.tipo_item,
        producto_id: it.tipo_item === 'estandar' ? (it.producto_id || null) : null,
        servicio_id: it.tipo_item === 'servicio' ? (it.servicio_id || null) : null,
        tipo_abertura_id: it.tipo_item === 'a_medida' ? (it.tipo_abertura_id || null) : null,
        sistema_id: it.tipo_item === 'a_medida' ? (it.sistema_id || null) : null,
        vidrio: it.tipo_item === 'a_medida' ? (it.vidrio || undefined) : undefined,
        premarco: it.tipo_item === 'a_medida' ? !!it.premarco : false,
        accesorios: it.tipo_item === 'a_medida' ? it.accesorios : [],
        color: it.tipo_item === 'a_medida' ? (it.color || undefined) : undefined,
        calculo_url: it.tipo_item === 'a_medida' ? (it.calculo_url || null) : null,
      }));
      try {
        await api.post(`/operaciones/${r.operacion_id}/completar-relevamiento`, {
          visita_tecnica_id: r.id,
          items: itemsCompletar,
        });
        toast.success(`Presupuesto ${r.operacion_numero ?? ''} completado`.trim());
        navigate(`/presupuestos/${r.operacion_id}/editar`);
      } catch (e: any) {
        toast.error(e?.message ?? 'No se pudo completar el presupuesto');
      }
      return;
    }

    const itemsPrecargados = validos.map(it => ({
      descripcion: [it.ambiente, it.descripcion].filter(Boolean).join(' — '),
      medida_ancho: it.tipo_item === 'a_medida' && it.ancho_mm ? String(parseFloat(it.ancho_mm) / 1000) : '',
      medida_alto: it.tipo_item === 'a_medida' && it.alto_mm ? String(parseFloat(it.alto_mm) / 1000) : '',
      tipo_item: it.tipo_item,
      producto_id: it.tipo_item === 'estandar' ? it.producto_id : '',
      servicio_id: it.tipo_item === 'servicio' ? it.servicio_id : '',
      tipo_abertura_id: it.tipo_item === 'a_medida' ? it.tipo_abertura_id : '',
      sistema_id: it.tipo_item === 'a_medida' ? it.sistema_id : '',
      vidrio: it.tipo_item === 'a_medida' ? it.vidrio : '',
      premarco: it.tipo_item === 'a_medida' ? !!it.premarco : false,
      accesorios: it.tipo_item === 'a_medida' ? it.accesorios : [],
      color: it.tipo_item === 'a_medida' ? it.color : '',
      calculo_url: it.tipo_item === 'a_medida' ? it.calculo_url : '',
    }));
    navigate('/presupuestos/nuevo', {
      state: {
        itemsPrecargados, clienteId: r.cliente_id, visitaTecnicaId: r.id,
        imagenesVisita: r.imagenes ?? [],
        visitaNumero: r.numero,
        visitaCobroEstado: r.cobro_estado,
        visitaCostoCobrado: r.costo_cobrado,
      },
    });
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Cargando...</div>;
  }
  if (!visita) {
    return <div className="p-6 text-sm text-gray-600">Visita de Relevamiento de Datos no encontrada</div>;
  }

  const yaConvertida = visita.estado === 'convertida';
  const estaCancelada = visita.estado === 'cancelada';
  const soloLectura = yaConvertida || estaCancelada;
  const editItemData = editItemKey ? items.find(it => it._key === editItemKey) : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/presupuestos/visitas-tecnicas')} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={18} className="text-gray-600"/>
          </button>
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <Ruler size={18} className="text-slate-600"/>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-gray-900">Visita de Relevamiento de Datos {visita.numero}</h1>
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', COBRO_BADGE[visita.cobro_estado]?.cls)}>
                {COBRO_BADGE[visita.cobro_estado]?.label(Number(visita.costo_cobrado ?? 0))}
              </span>
            </div>
            <p className="text-xs text-gray-600 flex items-center gap-1"><Users size={11}/> {nombreCliente(visita.cliente)}</p>
          </div>
        </div>
        <button onClick={() => window.open(`/imprimir/visita-tecnica?visita_id=${visita.id}`, '_blank')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:underline shrink-0">
          <Printer size={13}/> Imprimir
        </button>
      </div>

      {yaConvertida && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center justify-between gap-2 flex-wrap">
          <span>
            Esta visita ya generó el presupuesto{visita.operacion_numero ? ` ${visita.operacion_numero}` : ''}. Los datos quedan solo como historial.
          </span>
          {visita.operacion_id && (
            <Link to={`/operaciones/${visita.operacion_id}`} className="font-semibold underline hover:text-emerald-800 shrink-0">
              Ver presupuesto →
            </Link>
          )}
        </div>
      )}

      {estaCancelada && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
          <Ban size={15} className="shrink-0"/>
          <span>Esta Visita de Relevamiento de Datos fue cancelada.</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1 block">Fecha de visita</label>
            <input type="date" value={fechaVisita} onChange={e => setFechaVisita(e.target.value)} disabled={soloLectura}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1 block">Técnico</label>
            <input value={tecnico} onChange={e => setTecnico(e.target.value)} disabled={soloLectura}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1 block">Costo externo</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">$</span>
            <input type="number" min="0" step="100" value={costoExterno}
              onChange={e => setCostoExterno(e.target.value)}
              onBlur={guardarCostoExterno}
              placeholder="0"
              className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"/>
          </div>
          <p className="text-[11px] text-gray-600 mt-1">
            Lo que se le pagó al técnico o servicio tercerizado. Se usa para medir el margen en Reportes.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Ítems relevados</p>
        <p className="text-[11px] text-gray-600 mb-3">Marcá cada uno como abertura a medir (obra nueva), producto de catálogo (estándar) o servicio (reparación, mantenimiento, cambio de piezas)</p>
        <div className="space-y-2">
          {items.map((it, idx) => {
            const esServicio = it.tipo_item === 'servicio';
            const esEstandar = it.tipo_item === 'estandar';
            const esAMedida = it.tipo_item === 'a_medida';
            return (
            <div key={idx} className="relative flex flex-col sm:flex-row gap-2 sm:items-center p-2 rounded-lg border border-gray-200">
              {/* Toggle tipo de ítem */}
              <div className="flex shrink-0 rounded-lg border border-gray-200 overflow-hidden w-fit">
                <button type="button" onClick={() => toggleTipoItem(idx, 'a_medida')} disabled={soloLectura}
                  title="Abertura a medir"
                  className={`p-2 ${esAMedida ? 'bg-slate-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  <Ruler size={14}/>
                </button>
                <button type="button" onClick={() => toggleTipoItem(idx, 'estandar')} disabled={soloLectura}
                  title="Producto de catálogo (estándar)"
                  className={`p-2 border-l border-gray-200 ${esEstandar ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  <Package size={14}/>
                </button>
                <button type="button" onClick={() => toggleTipoItem(idx, 'servicio')} disabled={soloLectura}
                  title="Servicio (reparación/mantenimiento)"
                  className={`p-2 border-l border-gray-200 ${esServicio ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  <Wrench size={14}/>
                </button>
              </div>

              {esEstandar ? (
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2 items-center">
                  <input value={it.ambiente} onChange={e => updateItem(idx, 'ambiente', e.target.value)} placeholder="Ambiente" disabled={soloLectura}
                    className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
                  <div className="relative">
                    <button type="button" disabled={soloLectura}
                      onClick={() => { setBuscarProductoIdx(idx); setBuscarProductoQ(''); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 border border-gray-200 rounded-lg text-sm text-left disabled:bg-gray-50 hover:border-sky-300">
                      <Search size={13} className="text-gray-600 shrink-0"/>
                      <span className={it.producto_nombre ? 'text-gray-800' : 'text-gray-600'}>
                        {it.producto_nombre || 'Buscar producto del catálogo...'}
                      </span>
                    </button>
                    {buscarProductoIdx === idx && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-200">
                          <input autoFocus value={buscarProductoQ} onChange={e => setBuscarProductoQ(e.target.value)}
                            onBlur={() => setTimeout(() => setBuscarProductoIdx(null), 150)}
                            placeholder="Nombre o código..."
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300"/>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {productosFiltrados.length === 0 ? (
                            <p className="text-xs text-gray-600 p-3 text-center">Sin resultados</p>
                          ) : productosFiltrados.slice(0, 30).map(p => (
                            <button key={p.id} type="button" onMouseDown={() => seleccionarProducto(idx, p)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-sky-50 text-left border-b border-gray-200 last:border-0">
                              <div className="w-7 h-7 rounded bg-gray-50 overflow-hidden shrink-0">
                                {(p.imagenes?.[0] || p.imagen_url) && <img src={p.imagenes?.[0] || p.imagen_url!} alt="" className="w-full h-full object-cover"/>}
                              </div>
                              <span className="text-xs text-gray-700 flex-1 truncate">{p.nombre}</span>
                              {p.codigo && <span className="font-mono text-[9px] text-gray-600">{p.codigo}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : esServicio ? (
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2 items-center">
                  <input value={it.ambiente} onChange={e => updateItem(idx, 'ambiente', e.target.value)} placeholder="Ambiente" disabled={soloLectura}
                    className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
                  <div className="relative">
                    <input value={it.descripcion} disabled={soloLectura}
                      onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                      onFocus={() => setBuscarServicioIdx(idx)}
                      onBlur={() => setTimeout(() => setBuscarServicioIdx(null), 150)}
                      placeholder="Buscar servicio o escribir uno nuevo..."
                      className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
                    {buscarServicioIdx === idx && servicios.length > 0 && (() => {
                      const q = it.descripcion.trim().toLowerCase();
                      const filtrados = q ? servicios.filter(s => s.nombre.toLowerCase().includes(q)) : servicios;
                      return (
                        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                          {filtrados.length === 0 ? (
                            <p className="text-xs text-gray-600 p-3 text-center">Sin resultados — se guarda como texto libre</p>
                          ) : filtrados.map(s => (
                            <button key={s.id} type="button" onMouseDown={() => seleccionarServicio(idx, s)}
                              className="w-full text-left px-3 py-2 hover:bg-amber-50 text-xs text-gray-700 border-b border-gray-200 last:border-0">
                              {s.nombre}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_64px_64px_36px] gap-2 items-center">
                    <input value={it.ambiente} onChange={e => updateItem(idx, 'ambiente', e.target.value)} placeholder="Ambiente" disabled={soloLectura}
                      className="min-w-0 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
                    <input value={it.descripcion} onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                      placeholder="Descripción" disabled={soloLectura}
                      className="min-w-0 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
                    <input value={it.ancho_mm} onChange={e => updateItem(idx, 'ancho_mm', e.target.value)} placeholder="Ancho mm" type="number" disabled={soloLectura}
                      className="min-w-0 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/>
                    <input value={it.alto_mm} onChange={e => updateItem(idx, 'alto_mm', e.target.value)} placeholder="Alto mm" type="number" disabled={soloLectura}
                      className="min-w-0 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/>
                    {!soloLectura && (
                      <button type="button" onClick={() => setEditItemKey(it._key)}
                        title="Editar detalle (tipo, sistema, color, vidrio...)"
                        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:text-slate-700 hover:border-slate-300 shrink-0">
                        <Pencil size={14}/>
                      </button>
                    )}
                  </div>
                  {(it.tipo_abertura_id || it.color || it.vidrio) && (
                    <div className="flex flex-wrap gap-1">
                      {tiposAbertura.find(t => t.id === it.tipo_abertura_id) && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {tiposAbertura.find(t => t.id === it.tipo_abertura_id)!.nombre}
                        </span>
                      )}
                      {it.color && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">{it.color}</span>}
                      {it.vidrio && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">{it.vidrio}</span>}
                    </div>
                  )}
                </div>
              )}

              {!soloLectura && (
                <button onClick={() => quitarFila(idx)} disabled={items.length === 1}
                  className="p-2 text-gray-600 hover:text-red-500 disabled:opacity-30 shrink-0">
                  <Trash2 size={15}/>
                </button>
              )}
            </div>
            );
          })}
        </div>
        {!soloLectura && (
          <button onClick={agregarFila} className="mt-3 text-xs font-semibold text-slate-600 hover:underline flex items-center gap-1">
            <Plus size={13}/> Agregar fila
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Detalles importantes</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CheckGroup title="Color" fijos={COLOR_FIJOS} valores={color}
            onToggle={v => !soloLectura && toggle(color, setColor, v)}
            otro={colorOtro} onOtroChange={soloLectura ? undefined : setColorOtro}/>
          <CheckGroup title="Vidrio" fijos={VIDRIO_FIJOS} valores={vidrio}
            onToggle={v => !soloLectura && toggle(vidrio, setVidrio, v)}
            otro={vidrioOtro} onOtroChange={soloLectura ? undefined : setVidrioOtro}/>
          <CheckGroup title="Instalación" fijos={INSTALACION_FIJOS} valores={instalacion}
            onToggle={v => !soloLectura && toggle(instalacion, setInstalacion, v)}/>
          <CheckGroup title="Abertura especial" fijos={ABERTURA_FIJOS} valores={aberturaEspecial}
            onToggle={v => !soloLectura && toggle(aberturaEspecial, setAberturaEspecial, v)}
            otro={aberturaOtro} onOtroChange={soloLectura ? undefined : setAberturaOtro}/>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Fotos de la visita</p>
        {!soloLectura && (
          <p className="text-[11px] text-gray-600 mb-2">Podés arrastrar imágenes acá o pegarlas con Ctrl+V.</p>
        )}
        <div
          onDragOver={!soloLectura ? handleImgDragOver : undefined}
          onDragLeave={!soloLectura ? handleImgDragLeave : undefined}
          onDrop={!soloLectura ? handleImgDrop : undefined}
          className={`flex flex-wrap gap-3 rounded-xl p-1 -m-1 transition-colors ${draggingImg ? 'ring-2 ring-sky-400 ring-offset-2 bg-sky-50/50' : ''}`}
        >
          {imagenes.map((url, idx) => (
            <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 group">
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="" className="w-full h-full object-cover"/>
              </a>
              {!soloLectura && (
                <button onClick={() => quitarImagen(idx)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={12}/>
                </button>
              )}
            </div>
          ))}
          {!soloLectura && (
            <button onClick={() => fileRef.current?.click()} disabled={uploadingImg}
              className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-200 hover:border-slate-300 hover:bg-gray-50 flex flex-col items-center justify-center gap-1 text-gray-600 disabled:opacity-50">
              {uploadingImg ? <Loader2 size={18} className="animate-spin"/> : <Camera size={18}/>}
              <span className="text-[10px] font-semibold">Agregar</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
          onChange={handleImageUpload} className="hidden"/>
        {imagenes.length === 0 && soloLectura && (
          <p className="text-xs text-gray-600">Sin fotos cargadas</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Observaciones</label>
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} disabled={soloLectura}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"/>
      </div>

      {!soloLectura && confirmarCancelar && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={16} />
            <p className="text-sm font-semibold">¿Cancelar esta Visita de Relevamiento de Datos?</p>
          </div>
          <p className="text-xs text-red-600">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <button onClick={handleCancelar} disabled={cancelando}
              className="flex-1 bg-red-500 text-white text-sm font-semibold py-2 rounded-lg hover:bg-red-600 disabled:opacity-50">
              {cancelando ? <Loader2 size={14} className="animate-spin mx-auto"/> : 'Sí, cancelar'}
            </button>
            <button onClick={() => setConfirmarCancelar(false)}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-lg hover:bg-gray-50">
              No, volver
            </button>
          </div>
        </div>
      )}

      {!soloLectura && !confirmarCancelar && (
        <div className="flex gap-2">
          <button onClick={handleGuardar} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} Guardar
          </button>
          <button onClick={handleAvanzar} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin"/> : <ArrowRight size={15}/>}
            {visita.operacion_id
              ? `Completar presupuesto ${visita.operacion_numero ?? ''}`.trim()
              : 'Avanzar a presupuesto'}
          </button>
        </div>
      )}

      {!soloLectura && !confirmarCancelar && (
        <button onClick={() => setConfirmarCancelar(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-red-400 hover:text-red-600">
          <Ban size={13}/> Cancelar Visita de Relevamiento de Datos
        </button>
      )}

      {soloLectura && (
        <Link to="/presupuestos/visitas-tecnicas"
          className="block text-center py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-semibold">
          Volver al listado
        </Link>
      )}

      {editItemKey && editItemData && (
        <EditItemModal
          item={editItemData}
          tiposAbertura={tiposAbertura}
          sistemas={sistemas}
          coloresDB={coloresDB}
          onChange={updateItemSpec}
          onClose={() => setEditItemKey(null)}
          mode="visita"
          uploadUrl="/api/visitas-tecnicas/upload-imagen"
          uploadField="imagen"
        />
      )}
    </div>
  );
}
