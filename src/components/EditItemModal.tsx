import { useState, useRef } from 'react';
import { X, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, cn } from '@/lib/utils';
import { MontoInput } from '@/components/MontoInput';
import type { TipoAbertura, Sistema } from '@/types';
import { ATRIBUTOS_ABREVIADOS, ACCESORIOS_POR_TIPO, detectarCategoriaTipoAbertura, aplicarResumenAtributos } from '@/lib/atributosPorTipo';

const VIDRIO_OPTS    = ['Transparente', 'Traslúcido', 'Laminado', 'DVH', 'Sin vidrio'];
const ACCESORIO_OPTS = ['Barral', 'Cerradura', 'Manijón', 'Otros'];
const COLORES_ITEM   = ['Blanco', 'Negro', 'Anodizado', 'Otro'];

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
  mode?: 'presupuesto' | 'visita';
  uploadUrl?: string;
  uploadField?: string;
}) {
  const up = (f: keyof EditableItemSpec, v: unknown) => onChange(item._key, f, v);
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white';
  const lbl = 'block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1';
  const conPrecio = mode === 'presupuesto';

  // Categoría real (ventana/puerta/puerta_balcon/mosquitera) según el tipo de abertura elegido —
  // se usa para mostrar atributos y accesorios correctos, no genéricos, evitando cargar
  // datos que no corresponden a ese tipo (ej. "Manijón" en una ventana).
  const tipoAberturaNombreItem = tiposAbertura.find(t => t.id === item.tipo_abertura_id)?.nombre ?? '';
  const categoriaItem = item.tipo_item === 'a_medida' && tipoAberturaNombreItem
    ? detectarCategoriaTipoAbertura(tipoAberturaNombreItem)
    : null;

  const [subiendoCalculo, setSubiendoCalculo] = useState(false);
  const calculoInputRef = useRef<HTMLInputElement>(null);

  // Adjunto del cálculo del software externo — pegar / arrastrar / seleccionar
  async function subirCalculo(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Solo se aceptan imágenes'); return; }
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
      if (!res.ok) throw new Error('Error al subir');
      const { url } = await res.json();
      up('calculo_url', url);
      toast.success('Imagen adjuntada');
    } catch {
      toast.error('No se pudo subir la imagen');
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-sm font-bold text-gray-900">Editar ítem</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo de abertura + Sistema — primero: define qué atributos/accesorios corresponden */}
          {item.tipo_item !== 'servicio' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Tipo de abertura</label>
                <select value={item.tipo_abertura_id} onChange={e => up('tipo_abertura_id', e.target.value)} className={inp}>
                  <option value="">—</option>
                  {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Sistema</label>
                <select value={item.sistema_id} onChange={e => up('sistema_id', e.target.value)} className={inp}>
                  <option value="">—</option>
                  {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className={lbl}>Descripción</label>
            <input
              type="text"
              value={item.descripcion}
              onChange={e => up('descripcion', e.target.value)}
              className={inp}
              placeholder="Descripción del producto..."
            />
          </div>

          {/* Precio costo + Precio de venta (ambos los da el software externo) — no aplica en visita técnica */}
          {conPrecio && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{item.tipo_item === 'a_medida' ? 'Precio costo (software)' : 'Precio costo'}</label>
              <MontoInput
                value={item.costo_unitario ? String(item.costo_unitario) : ''}
                onChange={v => up('costo_unitario', parseFloat(v) || 0)}
                placeholder="0,00"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>{item.tipo_item === 'a_medida' ? 'Precio venta (software)' : 'Precio unitario'}</label>
              <MontoInput
                value={item.precio_unitario ? String(item.precio_unitario) : ''}
                onChange={v => up('precio_unitario', parseFloat(v) || 0)}
                placeholder="0,00"
                className={inp}
              />
            </div>
          </div>
          )}

          {/* Instalación */}
          {conPrecio && item.tipo_item !== 'servicio' && (
          <div>
            <label className={lbl}>Instalación</label>
            <select
              value={item.incluye_instalacion ? 'si' : 'no'}
              onChange={e => up('incluye_instalacion', e.target.value === 'si')}
              className={inp}
            >
              <option value="no">No incluye</option>
              <option value="si">Incluye instalación</option>
            </select>
          </div>
          )}

          {conPrecio && item.tipo_item !== 'servicio' && item.incluye_instalacion && (
            <div>
              <label className={lbl}>Precio instalación</label>
              <MontoInput
                value={item.precio_instalacion ? String(item.precio_instalacion) : ''}
                onChange={v => up('precio_instalacion', parseFloat(v) || 0)}
                placeholder="0,00"
                className={inp}
              />
            </div>
          )}

          {item.tipo_item !== 'servicio' && (
          <>
          {/* Color + Vidrio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Color</label>
              <select value={item.color} onChange={e => up('color', e.target.value)} className={inp}>
                <option value="">—</option>
                {coloresDB.length
                  ? coloresDB.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)
                  : COLORES_ITEM.map(c => <option key={c} value={c}>{c}</option>)
                }
              </select>
            </div>
            <div>
              <label className={lbl}>Vidrio</label>
              <select value={item.vidrio} onChange={e => up('vidrio', e.target.value)} className={inp}>
                <option value="">—</option>
                {VIDRIO_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Premarco — solo para tipos sin ficha propia (ni ventana/puerta/puerta-balcón/mosquitera),
              misma regla que en Nuevo Producto: esos 4 tipos no preguntan premarco */}
          {!categoriaItem && (
            <div>
              <label className={lbl}>Premarco</label>
              <select value={item.premarco ? 'si' : 'no'} onChange={e => up('premarco', e.target.value === 'si')} className={inp}>
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
            </div>
          )}

          {/* Atributos abreviados según tipo de abertura (solo a medida) */}
          {categoriaItem && (() => {
            const campos = ATRIBUTOS_ABREVIADOS[categoriaItem];
            function toggleAtrib(key: string, valor: string) {
              const actual = item._atribAbrev[key] === valor ? '' : valor;
              const nuevaSeleccion = { ...item._atribAbrev, [key]: actual };
              up('_atribAbrev', nuevaSeleccion);
              up('descripcion', aplicarResumenAtributos(item.descripcion, nuevaSeleccion, campos));
            }
            return (
              <div className="space-y-2">
                <label className={lbl}>Atributos de {tipoAberturaNombreItem.toLowerCase()}</label>
                {campos.map(c => (
                  <div key={c.key} className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 w-14 shrink-0">{c.label}</span>
                    {c.opciones.map(o => (
                      <button key={o.v} type="button" onClick={() => toggleAtrib(c.key, o.v)}
                        className={cn('px-2 py-1 rounded-full text-[11px] font-medium border',
                          item._atribAbrev[c.key] === o.v
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300')}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Medidas — no aplica en visita técnica: ya se cargan en mm en la fila de afuera */}
          {conPrecio && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Ancho (m)</label>
              <input
                type="number" step="0.01" value={item.medida_ancho ?? ''}
                onChange={e => up('medida_ancho', e.target.value)}
                placeholder="1.20" className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Alto (m)</label>
              <input
                type="number" step="0.01" value={item.medida_alto ?? ''}
                onChange={e => up('medida_alto', e.target.value)}
                placeholder="2.05" className={inp}
              />
            </div>
          </div>
          )}

          {/* Accesorios — reales para el tipo elegido, o lista genérica si no se identificó el tipo */}
          <div>
            <label className={lbl}>Accesorios</label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              {(categoriaItem ? ACCESORIOS_POR_TIPO[categoriaItem] : ACCESORIO_OPTS).map(a => (
                <label key={a} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={item.accesorios.includes(a)}
                    onChange={e => up('accesorios',
                      e.target.checked
                        ? [...item.accesorios, a]
                        : item.accesorios.filter(x => x !== a)
                    )}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-400"
                  />
                  <span className="text-sm text-gray-600">{a}</span>
                </label>
              ))}
            </div>
          </div>
          </>
          )}

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
                  : <ImagePlus size={18} className="text-gray-300" />}
                <p className="text-xs text-gray-500 text-center px-3">
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
