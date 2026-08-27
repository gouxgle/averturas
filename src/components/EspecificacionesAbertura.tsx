import { cn } from '@/lib/utils';
import { MontoInput } from '@/components/MontoInput';
import type { TipoAbertura, Sistema } from '@/types';
import {
  ATRIBUTOS_ABREVIADOS, ACCESORIOS_POR_TIPO,
  detectarCategoriaTipoAbertura, aplicarResumenAtributos,
} from '@/lib/atributosPorTipo';
import type { EditableItemSpec } from '@/components/EditItemModal';

export const VIDRIO_OPTS    = ['Transparente', 'Traslúcido', 'Laminado', 'DVH', 'Sin vidrio'];
export const ACCESORIO_OPTS = ['Barral', 'Cerradura', 'Manijón', 'Otros'];
export const COLORES_ITEM   = ['Blanco', 'Negro', 'Anodizado', 'Otro'];

export const inpCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white';
export const lblCls = 'block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1';

// Características de una abertura, compartidas por el modal de ítem individual
// (EditItemModal) y por la carga múltiple, donde se eligen una sola vez y valen
// para todas las medidas.
//
// `conPrecio` y `conMedidas` van separados a propósito: la plantilla de carga
// múltiple necesita el precio de instalación (que aplica a todas) pero NO el
// costo/venta unitario ni las medidas, que se cargan fila por fila.
export function EspecificacionesAbertura({
  item, tiposAbertura, sistemas, coloresDB, onChange,
  conPrecio = true,
  conMedidas = true,
  conPrecioUnitario = true,
}: {
  item: EditableItemSpec;
  tiposAbertura: TipoAbertura[];
  sistemas: Sistema[];
  coloresDB: { id: string; nombre: string }[];
  onChange: (key: string, field: keyof EditableItemSpec, value: unknown) => void;
  conPrecio?: boolean;
  conMedidas?: boolean;
  conPrecioUnitario?: boolean;
}) {
  const up = (f: keyof EditableItemSpec, v: unknown) => onChange(item._key, f, v);

  // Categoría real (ventana/puerta/puerta_balcon/mosquitera) según el tipo de abertura elegido —
  // se usa para mostrar atributos y accesorios correctos, no genéricos, evitando cargar
  // datos que no corresponden a ese tipo (ej. "Manijón" en una ventana).
  const tipoAberturaNombreItem = tiposAbertura.find(t => t.id === item.tipo_abertura_id)?.nombre ?? '';
  const categoriaItem = item.tipo_item === 'a_medida' && tipoAberturaNombreItem
    ? detectarCategoriaTipoAbertura(tipoAberturaNombreItem)
    : null;

  return (
    <>
      {/* Tipo de abertura + Sistema — primero: define qué atributos/accesorios corresponden */}
      {item.tipo_item !== 'servicio' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lblCls}>Tipo de abertura</label>
            <select value={item.tipo_abertura_id} onChange={e => up('tipo_abertura_id', e.target.value)} className={inpCls}>
              <option value="">—</option>
              {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Sistema</label>
            <select value={item.sistema_id} onChange={e => up('sistema_id', e.target.value)} className={inpCls}>
              <option value="">—</option>
              {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Descripción */}
      <div>
        <label className={lblCls}>Descripción</label>
        <input
          type="text"
          value={item.descripcion}
          onChange={e => up('descripcion', e.target.value)}
          className={inpCls}
          placeholder="Descripción del producto..."
        />
      </div>

      {/* Precio costo + Precio de venta (ambos los da el software externo) — no aplica
          en visita técnica ni en la plantilla de carga múltiple (van por fila) */}
      {conPrecio && conPrecioUnitario && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lblCls}>{item.tipo_item === 'a_medida' ? 'Precio costo (software)' : 'Precio costo'}</label>
            <MontoInput
              value={item.costo_unitario ? String(item.costo_unitario) : ''}
              onChange={v => up('costo_unitario', parseFloat(v) || 0)}
              placeholder="0,00"
              className={inpCls}
            />
          </div>
          <div>
            <label className={lblCls}>{item.tipo_item === 'a_medida' ? 'Precio venta (software)' : 'Precio unitario'}</label>
            <MontoInput
              value={item.precio_unitario ? String(item.precio_unitario) : ''}
              onChange={v => up('precio_unitario', parseFloat(v) || 0)}
              placeholder="0,00"
              className={inpCls}
            />
          </div>
        </div>
      )}

      {/* Instalación */}
      {conPrecio && item.tipo_item !== 'servicio' && (
        <div>
          <label className={lblCls}>Instalación</label>
          <select
            value={item.incluye_instalacion ? 'si' : 'no'}
            onChange={e => up('incluye_instalacion', e.target.value === 'si')}
            className={inpCls}
          >
            <option value="no">No incluye</option>
            <option value="si">Incluye instalación</option>
          </select>
        </div>
      )}

      {conPrecio && item.tipo_item !== 'servicio' && item.incluye_instalacion && (
        <div>
          <label className={lblCls}>Precio instalación</label>
          <MontoInput
            value={item.precio_instalacion ? String(item.precio_instalacion) : ''}
            onChange={v => up('precio_instalacion', parseFloat(v) || 0)}
            placeholder="0,00"
            className={inpCls}
          />
        </div>
      )}

      {item.tipo_item !== 'servicio' && (
        <>
          {/* Color + Vidrio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lblCls}>Color</label>
              <select value={item.color} onChange={e => up('color', e.target.value)} className={inpCls}>
                <option value="">—</option>
                {coloresDB.length
                  ? coloresDB.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)
                  : COLORES_ITEM.map(c => <option key={c} value={c}>{c}</option>)
                }
              </select>
            </div>
            <div>
              <label className={lblCls}>Vidrio</label>
              <select value={item.vidrio} onChange={e => up('vidrio', e.target.value)} className={inpCls}>
                <option value="">—</option>
                {VIDRIO_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Premarco — solo para tipos sin ficha propia (ni ventana/puerta/puerta-balcón/mosquitera),
              misma regla que en Nuevo Producto: esos 4 tipos no preguntan premarco */}
          {!categoriaItem && (
            <div>
              <label className={lblCls}>Premarco</label>
              <select value={item.premarco ? 'si' : 'no'} onChange={e => up('premarco', e.target.value === 'si')} className={inpCls}>
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
                <label className={lblCls}>Atributos de {tipoAberturaNombreItem.toLowerCase()}</label>
                {campos.map(c => (
                  <div key={c.key} className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-600 w-14 shrink-0">{c.label}</span>
                    {c.opciones.map(o => (
                      <button key={o.v} type="button" onClick={() => toggleAtrib(c.key, o.v)}
                        className={cn('px-2 py-1 rounded-full text-[11px] font-medium border',
                          item._atribAbrev[c.key] === o.v
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300')}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Medidas — no aplican en visita técnica (van en mm en la fila de afuera)
              ni en la plantilla de carga múltiple (van fila por fila) */}
          {conMedidas && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lblCls}>Ancho (m)</label>
                <input
                  type="number" step="0.01" value={item.medida_ancho ?? ''}
                  onChange={e => up('medida_ancho', e.target.value)}
                  placeholder="1.20" className={inpCls}
                />
              </div>
              <div>
                <label className={lblCls}>Alto (m)</label>
                <input
                  type="number" step="0.01" value={item.medida_alto ?? ''}
                  onChange={e => up('medida_alto', e.target.value)}
                  placeholder="2.05" className={inpCls}
                />
              </div>
            </div>
          )}

          {/* Accesorios — reales para el tipo elegido, o lista genérica si no se identificó el tipo */}
          <div>
            <label className={lblCls}>Accesorios</label>
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
                    className="rounded border-gray-400 text-violet-600 focus:ring-violet-400"
                  />
                  <span className="text-sm text-gray-600">{a}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
