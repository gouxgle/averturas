import { useState, useEffect } from 'react';
import { X, BookOpen, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Tipos de contenido ────────────────────────────────────────────────────────

type HelpStep = { text: string; note?: string };
type HelpSection = {
  id: string;
  title: string;
  emoji: string;
  intro?: string;
  steps?: HelpStep[];
  table?: { label: string; value: string; color?: string }[];
  warning?: string;
  tip?: string;
};
type HelpTopicData = { label: string; color: string; sections: HelpSection[] };
export type HelpTopic = 'presupuestos' | 'recibos' | 'remitos' | 'stock' | 'circuito';

// ── Contenido de ayuda ────────────────────────────────────────────────────────

const HELP_CONTENT: Record<HelpTopic, HelpTopicData> = {

  circuito: {
    label: 'Circuito comercial',
    color: 'text-violet-600',
    sections: [
      {
        id: 'flujo',
        emoji: '🔄',
        title: 'Flujo completo',
        intro: 'El ciclo de trabajo completo en el sistema sigue este orden:',
        steps: [
          { text: 'Crear presupuesto → enviarlo al cliente' },
          { text: 'Cliente aprueba (online por link o manualmente)' },
          { text: 'Registrar recibo de pago (total o parcial)' },
          { text: 'Emitir remito de entrega cuando el producto esté listo' },
          { text: 'Cliente confirma recepción por link público' },
        ],
      },
      {
        id: 'estados',
        emoji: '📊',
        title: 'Estados de una operación',
        table: [
          { label: 'Presupuesto', value: 'Borrador, no enviado al cliente', color: 'bg-gray-100 text-gray-700' },
          { label: 'Enviado', value: 'Cliente tiene el presupuesto, esperando respuesta', color: 'bg-blue-100 text-blue-700' },
          { label: 'Aprobado', value: 'Cliente aceptó — se puede cobrar y fabricar', color: 'bg-emerald-100 text-emerald-700' },
          { label: 'En producción', value: 'Pedido al proveedor o en fabricación', color: 'bg-amber-100 text-amber-700' },
          { label: 'Listo', value: 'Producto listo para entregar', color: 'bg-teal-100 text-teal-700' },
          { label: 'Entregado', value: 'Remito entregado al cliente', color: 'bg-slate-100 text-slate-700' },
        ],
        tip: 'El estado de cobro (Sin cobrar / Seña / Cobrado) es independiente del estado de la operación.',
      },
    ],
  },

  presupuestos: {
    label: 'Presupuestos',
    color: 'text-violet-600',
    sections: [
      {
        id: 'crear',
        emoji: '📝',
        title: 'Crear un presupuesto',
        steps: [
          { text: 'Ir a Presupuestos → Nuevo presupuesto' },
          { text: 'Seleccionar cliente (buscador por nombre)' },
          { text: 'Agregar ítems desde la galería de productos o manualmente' },
          { text: 'Configurar forma de envío y pago' },
          { text: 'Guardar como borrador o generar proforma directamente' },
        ],
        tip: 'Los ítems "a medida" no tienen precio fijo — ingresás el precio manualmente al agregar.',
      },
      {
        id: 'compartir',
        emoji: '📤',
        title: 'Compartir con el cliente',
        steps: [
          { text: 'Abrir el modal del presupuesto (click en la fila)' },
          { text: 'Hacer click en "Compartir"' },
          { text: 'Se genera un link único — el mensaje se copia automáticamente' },
          { text: 'Enviar por WhatsApp o copiar el link manualmente' },
          { text: 'El cliente abre el link y puede aprobar o rechazar' },
        ],
        warning: 'Si el presupuesto está vencido (fecha de validez pasada), no se puede generar link. Editarlo para actualizar la fecha.',
      },
      {
        id: 'cobro',
        emoji: '💰',
        title: 'Estado de cobro',
        intro: 'En la lista de presupuestos aprobados se muestra el estado de pago:',
        table: [
          { label: '○ Sin cobrar', value: 'No se registró ningún recibo' },
          { label: '◑ Seña $X', value: 'Pago parcial registrado, hay saldo pendiente' },
          { label: '● Cobrado', value: 'El total fue cobrado completamente' },
        ],
        tip: 'Desde el modal del presupuesto aprobado, el botón "Registrar cobro" abre el formulario de recibo pre-cargado.',
      },
    ],
  },

  recibos: {
    label: 'Recibos',
    color: 'text-emerald-600',
    sections: [
      {
        id: 'tipos',
        emoji: '🧾',
        title: 'Tipos de pago',
        table: [
          { label: 'Pago total', value: 'Cubre el saldo completo pendiente. El sistema calcula el monto automáticamente.' },
          { label: 'Pago parcial', value: 'Se ingresa un monto menor. El saldo restante queda como pendiente.' },
        ],
        tip: 'Un recibo siempre está asociado a un presupuesto aprobado. No se pueden crear recibos sobre presupuestos en borrador o enviados.',
      },
      {
        id: 'bonificacion',
        emoji: '🎁',
        title: 'Bonificación por pago al contado',
        intro: 'Solo disponible cuando la forma de pago es "Contado". Se aplica sobre el precio de los productos, NO sobre instalación ni envío.',
        steps: [
          { text: 'Seleccionar forma de pago "Contado"' },
          { text: 'Aparece la sección de bonificación con botones de 5%, 10%, 15%, 20% o porcentaje libre' },
          { text: 'El total del recibo se recalcula mostrando el descuento aplicado' },
        ],
      },
      {
        id: 'saldo',
        emoji: '⏳',
        title: 'Cobrar saldo pendiente',
        steps: [
          { text: 'En la lista de Recibos, los pagos parciales muestran "Saldo: $X" en la columna Estado' },
          { text: 'El botón "Cobrar saldo" abre el formulario pre-cargado con el monto y concepto correctos' },
          { text: 'También se puede acceder desde el modal del presupuesto → botón "Registrar cobro"' },
        ],
        tip: 'Los compromisos de pago (fecha de vencimiento) se crean al guardar un recibo parcial si se activa esa opción.',
      },
    ],
  },

  remitos: {
    label: 'Remitos',
    color: 'text-sky-600',
    sections: [
      {
        id: 'flujo',
        emoji: '📦',
        title: 'Flujo del remito',
        steps: [
          { text: 'Crear remito desde una operación aprobada' },
          { text: 'Estado "Borrador" — se puede editar libremente' },
          { text: 'Emitir → descuenta el stock automáticamente (movimiento egreso_remito)' },
          { text: 'Marcar como "Entregado" cuando el cliente lo recibe' },
          { text: 'Opcional: compartir link público para que el cliente confirme recepción' },
        ],
        warning: 'Si se cancela un remito ya emitido, el sistema revierte el egreso de stock automáticamente.',
      },
      {
        id: 'confirmacion',
        emoji: '✅',
        title: 'Confirmación del cliente',
        intro: 'El link público del remito permite al cliente registrar la recepción:',
        table: [
          { label: 'Conforme', value: 'Recibió todo correctamente' },
          { label: 'Con observaciones', value: 'Recibió pero hay algo a revisar' },
          { label: 'No conforme', value: 'Hay un problema con la entrega' },
        ],
        tip: 'La confirmación del cliente queda registrada con fecha y hora en el remito.',
      },
    ],
  },

  stock: {
    label: 'Stock',
    color: 'text-amber-600',
    sections: [
      {
        id: 'formula',
        emoji: '📐',
        title: 'Cómo se calcula el stock',
        intro: 'El stock no es un número fijo en la base de datos. Se calcula en tiempo real:',
        steps: [
          { text: 'stock_actual = stock_inicial + SUMA de todos los movimientos' },
          { text: 'Los movimientos pueden ser positivos (ingreso) o negativos (egreso, reserva)' },
          { text: 'El stock mínimo genera alertas cuando stock_actual ≤ stock_minimo' },
        ],
        tip: 'Si el stock muestra un número incorrecto, revisar los movimientos del producto en la pantalla de Stock.',
      },
      {
        id: 'movimientos',
        emoji: '↕️',
        title: 'Tipos de movimiento',
        table: [
          { label: 'ingreso', value: 'Entrada de mercadería (lote de compra)' },
          { label: 'egreso_remito', value: 'Salida por entrega en remito (automático al emitir)' },
          { label: 'egreso_retiro', value: 'Salida por retiro directo en local' },
          { label: 'devolucion', value: 'Reingreso por cancelación de remito' },
          { label: 'reserva', value: 'Reserva al aprobar presupuesto con producto de stock' },
          { label: 'ajuste', value: 'Corrección manual de inventario' },
        ],
      },
    ],
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface HelpDrawerProps {
  topic: HelpTopic;
  onClose: () => void;
  onChangeTopic?: (topic: HelpTopic) => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function HelpDrawer({ topic, onClose, onChangeTopic }: HelpDrawerProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const data = HELP_CONTENT[topic];

  // Activar primera sección al montar o cambiar de topic
  useEffect(() => {
    if (data.sections.length > 0) setActiveSection(data.sections[0].id);
  }, [topic, data.sections]);

  const section = data.sections.find(s => s.id === activeSection) ?? data.sections[0];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[440px] bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <BookOpen size={16} className="text-violet-600" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Ayuda</p>
              <p className="text-sm font-bold text-gray-900">{data.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Nav de secciones (solo si hay más de una) */}
        {data.sections.length > 1 && (
          <div className="flex gap-1 px-4 py-2.5 border-b border-gray-100 overflow-x-auto">
            {data.sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0',
                  activeSection === s.id
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}>
                <span>{s.emoji}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Título de sección */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{section.emoji}</span>
              <h3 className="text-base font-bold text-gray-900">{section.title}</h3>
            </div>
            {section.intro && (
              <p className="text-sm text-gray-600 leading-relaxed">{section.intro}</p>
            )}
          </div>

          {/* Pasos numerados */}
          {section.steps && section.steps.length > 0 && (
            <div className="space-y-2">
              {section.steps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm text-gray-800">{step.text}</p>
                    {step.note && <p className="text-xs text-gray-400 mt-0.5">{step.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabla */}
          {section.table && section.table.length > 0 && (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              {section.table.map((row, i) => (
                <div key={i} className={cn(
                  'flex gap-3 px-3 py-2.5 text-sm',
                  i % 2 === 0 ? 'bg-gray-50' : 'bg-white',
                  i < section.table!.length - 1 && 'border-b border-gray-100'
                )}>
                  <span className={cn(
                    'shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full h-fit mt-0.5',
                    row.color ?? 'bg-gray-100 text-gray-700'
                  )}>
                    {row.label}
                  </span>
                  <span className="text-gray-600 text-xs leading-relaxed">{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Advertencia */}
          {section.warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
              <span className="font-bold">⚠️ Atención: </span>{section.warning}
            </div>
          )}

          {/* Tip */}
          {section.tip && (
            <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 text-xs text-sky-800 leading-relaxed">
              <span className="font-bold">💡 </span>{section.tip}
            </div>
          )}
        </div>

        {/* Footer — otros temas */}
        <div className="border-t border-gray-100 px-5 py-3">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Otros temas</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(HELP_CONTENT) as HelpTopic[]).filter(k => k !== topic).map(k => (
              <button key={k} onClick={() => onChangeTopic?.(k)}
                className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors border border-gray-200 hover:border-violet-200">
                {HELP_CONTENT[k].label}
                <ChevronRight size={10} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
