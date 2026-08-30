import { useState, useRef } from 'react';
import { X, ImagePlus, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import type { TipoAbertura, Sistema } from '@/types';
import { EspecificacionesAbertura, inpCls, lblCls } from '@/components/EspecificacionesAbertura';

// Campos que edita este modal — subconjunto común entre un ítem de presupuesto (ItemForm)
// y un ítem "a medida" relevado en una visita técnica (VisitaTecnicaItem). Costo/precio/
// instalación/medidas son opcionales porque en modo 'visita' no se piden (no hay precio
// decidido en el sitio, y ancho/alto ya se cargan en mm en la fila de afuera).
export interface EditableItemSpec {
  _key: string;
  tipo_item: 'estandar' | 'a_medida' | 'servicio' | 'a_relevar';
  tipo_abertura_id: string;
  sistema_id: string;
  descripcion: string;
  color: string;
  vidrio: string;
  premarco: boolean;
  accesorios: string[];
  calculo_url: string;
  _atribAbrev: Record<string, string>;
  cantidad?: number;
  costo_unitario?: number;
  precio_unitario?: number;
  incluye_instalacion?: boolean;
  precio_instalacion?: number;
  medida_ancho?: string;
  medida_alto?: string;
}

function itemSubtotal(item: EditableItemSpec) {
  const base = (item.precio_unitario ?? 0) + (item.incluye_instalacion ? (item.precio_instalacion ?? 0) : 0);
  return base * (item.cantidad ?? 1);
}

export function EditItemModal({
  item,
  tiposAbertura,
  sistemas,
  coloresDB,
  onChange,
  onClose,
  onDuplicar,
  mode = 'presupuesto',
  uploadUrl = '/api/operaciones/upload-calculo',
  uploadField = 'calculo',
}: {
  item: EditableItemSpec;
  tiposAbertura: TipoAbertura[];
  sistemas: Sistema[];
  coloresDB: { id: string; nombre: string }[];
  onChange: (key: string, field: keyof EditableItemSpec, value: unknown) => void;
  onClose: () => void;
  onDuplicar?: (key: string) => void;
  mode?: 'presupuesto' | 'visita';
  uploadUrl?: string;
  uploadField?: string;
}) {
  const up = (f: keyof EditableItemSpec, v: unknown) => onChange(item._key, f, v);
  const inp = inpCls;
  const lbl = lblCls;
  const conPrecio = mode === 'presupuesto';

  const [subiendoCalculo, setSubiendoCalculo] = useState(false);
  const calculoInputRef = useRef<HTMLInputElement>(null);

  // Adjunto del cálculo del software externo — pegar / arrastrar / seleccionar / cámara.
  // El chequeo de tipo es intencionalmente laxo: en Android el archivo que entrega la
  // cámara a veces no trae un MIME reconocible (varía por navegador/fabricante) — el
  // servidor tiene la validación real (MIME + fallback de extensión), acá solo se
  // descartan casos obviamente no-imagen para dar feedback rápido sin pegarle un viaje
  // al servidor.
  async function subirCalculo(file: File) {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const extConocida = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp'].includes(ext);
    if (!file.type.startsWith('image/') && !extConocida) {
      toast.error('Solo se aceptan imágenes');
      return;
    }
    setSubiendoCalculo(true);
    try {
      const token = sessionStorage.getItem('aberturas_token');
      const fd = new FormData();
      fd.append(uploadField, file);
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const detalle = await res.json().catch(() => null);
        throw new Error(detalle?.error || 'Error al subir imagen');
      }
      const { url } = await res.json();
      up('calculo_url', url);
      toast.success('Imagen adjuntada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setSubiendoCalculo(false);
    }
  }

  function handlePasteCalculo(e: React.ClipboardEvent) {
    const it = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    const file = it?.getAsFile();
    if (file) { e.preventDefault(); subirCalculo(file); }
  }

  function handleDropCalculo(e: React.DragEvent) {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (file) subirCalculo(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-sm font-bold text-gray-900 shrink-0">Editar ítem</h2>
          <div className="flex items-center gap-1.5">
            {onDuplicar && (
              <button
                onClick={() => onDuplicar(item._key)}
                title="Copia las características para que solo cambies medidas y precio"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200"
              >
                <Copy size={13} /> Duplicar ítem
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={16} className="text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <EspecificacionesAbertura
            item={item}
            tiposAbertura={tiposAbertura}
            sistemas={sistemas}
            coloresDB={coloresDB}
            onChange={onChange}
            conPrecio={conPrecio}
            conMedidas={conPrecio}
          />

          {/* Cálculo del software externo (adjunto) */}
          <div>
            <label className={lbl}>
              {item.tipo_item === 'servicio' ? 'Foto de referencia (opcional)' : item.tipo_item === 'a_medida' ? 'Cálculo del software (respaldo)' : 'Cálculo del software (opcional)'}
            </label>
            {item.calculo_url ? (
              <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-2">
                <a href={item.calculo_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <img src={item.calculo_url} alt="Cálculo" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                </a>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600">Imagen adjuntada</p>
                  <a href={item.calculo_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline">Ver completo</a>
                </div>
                <button type="button" onClick={() => up('calculo_url', '')}
                  className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors shrink-0" title="Quitar">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div
                tabIndex={0}
                onPaste={handlePasteCalculo}
                onDrop={handleDropCalculo}
                onDragOver={e => e.preventDefault()}
                onClick={() => calculoInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-lg py-4 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-300"
              >
                {subiendoCalculo
                  ? <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  : <ImagePlus size={18} className="text-gray-600" />}
                <p className="text-xs text-gray-600 text-center px-3">
                  Hacé click y pegá (Ctrl+V) la captura del software, o arrastrala acá
                </p>
                <input
                  ref={calculoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirCalculo(f); e.target.value = ''; }}
                />
              </div>
            )}
          </div>

          {/* Subtotal */}
          {conPrecio && itemSubtotal(item) > 0 && (
            <div className="bg-violet-50 rounded-xl px-4 py-3 flex items-center justify-between border border-violet-100">
              <span className="text-xs text-violet-600 font-medium">Subtotal ítem</span>
              <span className="text-base font-bold text-violet-700">{formatCurrency(itemSubtotal(item))}</span>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#7c3aed] hover:bg-violet-700 text-white rounded-xl text-sm font-semibold"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
