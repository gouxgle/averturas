import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, BookOpen, ChevronRight, ExternalLink } from 'lucide-react';
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
export type HelpTopic = 'presupuestos' | 'recibos' | 'remitos' | 'stock' | 'circuito' | 'compras' | 'facturacion' | 'agenda' | 'precios';

/** Temas que además tienen manual completo en Manuales del sistema (`/ayuda/:slug`). */
const MANUAL_DE_TEMA: Partial<Record<HelpTopic, string>> = {
  presupuestos: 'presupuestos',
  compras: 'compras',
};

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
          { label: '◑ Señado $X', value: 'Pago parcial registrado, hay saldo pendiente' },
          { label: '● Pago total', value: 'El total fue cobrado completamente' },
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

  precios: {
    label: 'Revisión integral de precios',
    color: 'text-sky-700',
    sections: [
      {
        id: 'analisis',
        emoji: '🔎',
        title: 'Cómo analiza cada producto',
        intro: 'Compara el costo cargado con la lista vigente del proveedor y con la última compra, el recargo actual con el objetivo, y el dólar blue del día en que se actualizó el precio con el de hoy. La inflación se muestra como referencia.',
        table: [
          { label: 'Renovar validez', value: 'Nada se movió más que el umbral (3 % por defecto): se renueva la fecha sin tocar el precio', color: 'text-sky-700' },
          { label: 'Actualizar', value: 'Subió la lista, la última compra o el dólar, o el recargo quedó bajo el objetivo', color: 'text-orange-700' },
          { label: 'Al día', value: 'Renovado hace pocos días', color: 'text-emerald-700' },
          { label: 'Sin datos', value: 'Falta el costo del producto', color: 'text-gray-700' },
        ],
        tip: 'El precio sugerido mantiene el recargo sobre el costo de reposición (o lo lleva al objetivo si estaba por debajo), o sigue al dólar: el mayor de los dos, no los suma. Nunca propone bajar un precio solo.',
      },
      {
        id: 'actualizar',
        emoji: '📈',
        title: 'Actualizar precios',
        steps: [
          { text: 'Agrupá por familia, línea, proveedor o por m² para ver dónde subió más el costo.' },
          { text: 'Ordená por prioridad: primero lo que más se vende con el precio más viejo.' },
          { text: 'Marcá y tocá "Actualizar precios": elegí el criterio (sugerido, %, dólar, costo + recargo o % por grupo) y el redondeo.' },
          { text: 'En la vista previa podés corregir cada precio. Los de "precio manual" quedan afuera salvo que los marques.' },
        ],
        warning: 'Las proformas ya enviadas no cambian: guardan su propio precio.',
      },
      {
        id: 'proveedor',
        emoji: '📄',
        title: 'Lista de un proveedor',
        steps: [
          { text: 'Elegí el proveedor y cargá su lista en Excel (.xlsx) o CSV, con código y precio; o un porcentaje.' },
          { text: 'Se analizan solo los productos de ese proveedor: qué sube, qué baja y qué no cambió.' },
          { text: 'Los códigos que no están enlazados se pueden enlazar a un producto y volver a analizar.' },
          { text: 'Al aplicar se guarda la lista, se actualizan costos y precios, y se renueva la validez de lo que no cambió.' },
        ],
      },
    ],
  },

  agenda: {
    label: 'Agenda del día',
    color: 'text-orange-700',
    sections: [
      {
        id: 'aviso',
        emoji: '📅',
        title: 'El aviso de cada día',
        intro: 'Al entrar al sistema aparece "Tu agenda de hoy" con todo lo pendiente del día y lo que quedó atrasado: llamados, recotizaciones, visitas, entregas, oportunidades y tareas internas.',
        steps: [
          { text: 'Hecho: la tarea queda resuelta para todos.' },
          { text: 'Leído: te la vuelvo a mostrar en 1 hora.' },
          { text: 'Recordar: elegís en 30 min, 1, 2 o 4 horas, o a una hora exacta (por ejemplo 12:30).' },
          { text: 'Reprogramar: la pasás a otro día. Si es una oportunidad, una entrega o una visita, también cambia su fecha.' },
          { text: 'Ir: abre el cliente, la proforma, el remito o la visita.' },
        ],
        tip: '"Seguir trabajando" cierra el aviso: lo que no tocaste vuelve en 1 hora. La pastilla de abajo a la izquierda lo abre cuando quieras.',
      },
      {
        id: 'acumulacion',
        emoji: '🧘',
        title: 'Sin avisos encimados',
        steps: [
          { text: 'Si el sistema se abre horas después, aparece un solo aviso con todo junto, no uno por cada hora.' },
          { text: 'Si mientras está abierto vence otro recordatorio, se suma a la lista con la marca "Nuevo".' },
          { text: 'Si estás escribiendo, el recordatorio espera a que termines.' },
          { text: 'Cada uno maneja sus recordatorios: si vos posponés una tarea, a tus compañeros les sigue avisando.' },
        ],
      },
      {
        id: 'recotizar',
        emoji: '📝',
        title: 'Recotizar una proforma',
        intro: 'Es revisar una proforma y adecuarla a lo que pidió el cliente.',
        steps: [
          { text: 'Se agenda sola cuando el cliente responde "quiero modificar" desde el link de la proforma.' },
          { text: 'A mano: en el detalle de la proforma, "Agendar recotización".' },
          { text: '"Ir" abre la proforma para editar. Al guardar, el sistema pregunta si quedó lista.' },
        ],
      },
      {
        id: 'internas',
        emoji: '🏢',
        title: 'Tareas internas',
        intro: 'Para lo que no es de un cliente: comprar insumos, llamar a un proveedor, pagar un servicio, mantenimiento.',
        steps: [
          { text: 'Agenda → "Tarea interna" (o el + junto a la pastilla): qué hacer, fecha, hora, categoría y proveedor.' },
          { text: 'Si se repite (cada semana, cada mes o cada tantos días), al marcarla hecha se agenda sola la próxima.' },
        ],
      },
    ],
  },

  facturacion: {
    label: 'Facturación',
    color: 'text-fuchsia-700',
    sections: [
      {
        id: 'como',
        emoji: '🧾',
        title: 'Cómo se factura',
        intro: 'Cada factura se autoriza en el momento con ARCA (CAE). Se puede facturar de tres maneras:',
        steps: [
          { text: 'Por cada cobro: pestaña "Por facturar" → Cobros sin facturar → Facturar. Sirve también para las señas.' },
          { text: 'Por la venta completa: "Presupuestos aprobados sin facturar" → Facturar (por ejemplo, al entregar).' },
          { text: 'A mano: "Nueva factura" → elegir cliente → cargar ítems → revisar → emitir.' },
        ],
        tip: 'El sistema descuenta lo ya facturado de cada recibo y presupuesto: si te pasás, avisa y hay que confirmarlo.',
      },
      {
        id: 'letra',
        emoji: '🔤',
        title: '¿A o B?',
        table: [
          { label: 'Factura A', value: 'Responsable inscripto o monotributista (necesita CUIT)' },
          { label: 'Factura B', value: 'Consumidor final, exento y el resto' },
        ],
        tip: 'La letra sale sola de la condición de IVA del cliente. Con el CUIT cargado, "Traer de ARCA" la completa.',
        warning: 'Desde $ 10.000.000 el consumidor final tiene que estar identificado con DNI o CUIT.',
      },
      {
        id: 'precios',
        emoji: '💲',
        title: 'Precios e IVA',
        steps: [
          { text: 'Los precios se cargan finales, con IVA incluido. El sistema separa neto e IVA.' },
          { text: 'Si hay instalación u otro servicio, hay que indicar el período del servicio y el vencimiento del pago.' },
        ],
      },
      {
        id: 'estados',
        emoji: '🚦',
        title: 'Estados',
        table: [
          { label: 'Borrador', value: 'Guardado, todavía no se mandó a ARCA', color: 'text-gray-700' },
          { label: 'Autorizado', value: 'Tiene CAE: es la factura válida', color: 'text-emerald-700' },
          { label: 'Rechazado', value: 'ARCA dijo que no; se corrige y se vuelve a emitir', color: 'text-red-700' },
          { label: 'Sin confirmar', value: 'ARCA no respondió a tiempo; el sistema lo verifica solo', color: 'text-amber-700' },
        ],
        warning: 'Un comprobante "Sin confirmar" NO se vuelve a emitir: se podría duplicar la factura.',
      },
      {
        id: 'anular',
        emoji: '↩️',
        title: 'Corregir o anular',
        steps: [
          { text: 'Una factura autorizada no se borra ni se modifica.' },
          { text: 'Se corrige con una nota de crédito: abrir la factura → "Nota de crédito" (total o parcial).' },
          { text: 'Para cobrar un recargo o una diferencia a favor del local: "Nota de débito" sobre la factura.' },
        ],
      },
      {
        id: 'enviar',
        emoji: '📤',
        title: 'PDF y envío',
        steps: [
          { text: 'Desde la factura: "Ver PDF", "Imprimir" (original y duplicado) o "Enviar al cliente" por WhatsApp o mail.' },
          { text: 'Si un envío falla, el sistema lo reintenta solo. El historial queda en la factura.' },
        ],
      },
      {
        id: 'contingencia',
        emoji: '🛟',
        title: 'Si ARCA no responde',
        steps: [
          { text: 'Si al emitir ARCA no contesta, aparece "Emitir en contingencia": la factura sale con el CAEA de la quincena y es válida.' },
          { text: 'Hay que escribir la causa (por ejemplo "ARCA caído" o "sin internet"). Queda registrada con fecha, hora y usuario.' },
          { text: 'Cuando ARCA vuelve, el sistema la informa solo (pestaña Contingencia).' },
        ],
        warning: 'El CAEA es SOLO para contingencias (RG 5852). Con ARCA funcionando, el sistema no deja usarlo.',
      },
      {
        id: 'libro',
        emoji: '📒',
        title: 'Libro IVA para el contador',
        steps: [
          { text: 'Pestaña "Libro IVA": elegir el mes → "Descargar para el contador (CSV)".' },
          { text: '"Controlar con ARCA" verifica que cada factura del mes esté en ARCA con los mismos datos.' },
        ],
      },
    ],
  },

  compras: {
    label: 'Compras',
    color: 'text-lime-700',
    sections: [
      {
        id: 'circuito',
        emoji: '🛒',
        title: 'El circuito de una compra',
        intro: 'Cada compra deja su historia completa: qué se necesitó, a quién se cotizó, qué se eligió y qué se pidió.',
        steps: [
          { text: 'Solicitud (SC-): qué hace falta y para quién. Se arma sola desde una venta, un relevamiento o el catálogo.' },
          { text: 'Cotización (PC-): opcional. Se invita a uno o varios proveedores, se cargan sus respuestas y se comparan.' },
          { text: 'Orden de compra (OC-): lo que se le pide al proveedor, con precios neto + IVA y flete. Se envía en PDF por WhatsApp o email.' },
          { text: 'Seguimiento: confirmación del proveedor, en qué anda, y aviso automático cuando se pasa de la fecha prometida.' },
          { text: 'Recepción: ítem por ítem. Entra a stock solo lo que llegó conforme; lo que llegó con problema abre un reclamo (REC-).' },
          { text: 'Factura, pagos y cierre: la compra queda saldada y archivada, y el saldo del proveedor se actualiza solo.' },
        ],
        tip: 'Una compra normal es: solicitud → orden → recibir. La cotización, el seguimiento y los reclamos aparecen solo cuando los necesitás.',
      },
      {
        id: 'solicitud',
        emoji: '📝',
        title: 'Crear una solicitud',
        steps: [
          { text: 'Compras → Nueva solicitud → elegir el origen (venta, relevamiento, reposición de stock, producción propia…)' },
          { text: 'Los ítems se autocompletan con su ficha técnica (medidas, color, vidrio, apertura, herrajes)' },
          { text: 'Revisar cantidades y fichas, adjuntar fotos o planos' },
          { text: '"¿Cómo seguimos?": pedir cotización, comprar directo o solo guardar' },
        ],
        tip: 'Desde un presupuesto aprobado o el kanban, "Pedido al proveedor" ya trae la solicitud armada con lo que falta comprar.',
      },
      {
        id: 'cotizacion',
        emoji: '⚖️',
        title: 'Cotizar y comparar',
        steps: [
          { text: 'Enviar el pedido de cotización a cada proveedor (PDF por WhatsApp/email, o marcar "ya enviada")' },
          { text: 'Cargar la respuesta: un solo total, o precio por ítem. Neto, descuento, IVA, flete, plazo, forma de pago, validez.' },
          { text: 'La comparativa marca en verde el mejor valor de cada columna y el menor costo final' },
          { text: '"Elegir" genera la orden de compra con los precios cotizados; "Cerrar sin comprar" libera los ítems' },
        ],
        warning: 'Se compara por TOTAL FINAL (neto − descuento + IVA + flete). Un neto más barato con IVA 21% puede salir más caro que otro con 10,5%.',
      },
      {
        id: 'orden',
        emoji: '📦',
        title: 'Orden de compra',
        table: [
          { label: 'Borrador', value: 'Se puede editar precios, flete y condiciones', color: 'bg-amber-100 text-amber-800' },
          { label: 'Enviada', value: 'El proveedor la recibió (WhatsApp / email / marcada a mano)', color: 'bg-sky-100 text-sky-800' },
          { label: 'Recibida', value: 'Mercadería ingresada al stock; se puede armar el remito', color: 'bg-emerald-100 text-emerald-800' },
          { label: 'Cancelada', value: 'Los ítems de la solicitud vuelven a quedar pendientes', color: 'bg-gray-100 text-gray-700' },
        ],
        tip: '"Consolidar" arma una sola orden con ítems de varios clientes al mismo proveedor: cada ítem sabe de quién es y el flete se prorratea por monto.',
      },
      {
        id: 'recepcion',
        emoji: '📥',
        title: 'Recibir la mercadería',
        intro: 'En la orden, "Registrar recepción" abre la lista de ítems. Cada uno se marca con un botón:',
        table: [
          { label: '✓ Llegó bien', value: 'Entra a stock la cantidad conforme', color: 'bg-emerald-100 text-emerald-700' },
          { label: '⚠ Con problema', value: 'Se abre un reclamo (REC-) con foto y detalle. NO entra a stock.', color: 'bg-amber-100 text-amber-800' },
          { label: '✗ No vino', value: 'Queda pendiente para la próxima entrega', color: 'bg-gray-100 text-gray-700' },
        ],
        tip: 'Se pueden ajustar las cantidades a mano: si de 5 llegaron 3 y 1 roto, la orden queda "recibida parcial" y podés registrar otra entrega después.',
        warning: 'Al stock entra SOLO lo conforme. Antes se ingresaba la cantidad pedida entera al marcar "recibido", aunque faltara o viniera roto.',
      },
      {
        id: 'reclamos',
        emoji: '🛠️',
        title: 'Reclamos al proveedor',
        steps: [
          { text: 'El reclamo se abre solo al marcar un ítem con problema — no hay que ir a buscarlo' },
          { text: 'Cargar la foto y el detalle, y reclamar por WhatsApp o email (las fotos van adjuntas)' },
          { text: 'Registrar qué contestó: repone, cambia el vidrio, manda el herraje, hace un descuento, nota de crédito, o no se hace cargo' },
          { text: 'Si repone, se agrega un ítem de reposición a la orden sin costo; cuando llega conforme el reclamo se cierra solo' },
        ],
        tip: 'La franja "Calidad" de la orden muestra si hay reclamos abiertos; la pestaña Reclamos los lista todos con contador.',
      },
      {
        id: 'demoras',
        emoji: '⏰',
        title: 'Demoras',
        intro: 'Si pasa la fecha prometida y la mercadería no llegó, el sistema avisa solo:',
        steps: [
          { text: 'Aparece un aviso en la campanita y una tarjeta que no se va hasta aceptarla' },
          { text: 'La orden se marca "Demorada N días" en rojo en la lista y en el Dashboard' },
          { text: 'Con "Registrar contacto" se anota qué dijo el proveedor y la fecha nueva' },
          { text: 'Al poner una fecha nueva, la orden deja de figurar demorada hasta que se pase otra vez' },
        ],
      },
      {
        id: 'plata',
        emoji: '💰',
        title: 'Factura, pagos y cuenta corriente',
        steps: [
          { text: 'En la orden: "Cargar factura" con número, neto, IVA y el PDF' },
          { text: 'Si el total no coincide con la orden, el sistema pide el motivo (flete, aumento, IVA, adicional, error)' },
          { text: '"Pagar" registra el pago y lo reparte entre las órdenes que estás cancelando' },
          { text: 'Lo que pagues de más queda como saldo a favor y se aplica después a otra orden' },
          { text: 'Notas de crédito y débito ajustan la cuenta (una nota de crédito por un reclamo lo cierra)' },
        ],
        tip: 'La pestaña "Cuenta corriente" muestra el saldo de cada proveedor, su libro mayor completo, y permite mandarle el estado de cuenta en PDF por WhatsApp.',
        warning: 'La "Deuda actual" que antes se cargaba a mano en la ficha del proveedor ya no se escribe: el saldo sale solo de las facturas, pagos y notas. El saldo que había quedó cargado como "Saldo inicial migrado".',
      },
      {
        id: 'cierre',
        emoji: '🔒',
        title: 'Cerrar una compra',
        intro: 'La orden junta sola su carpeta: la orden en PDF al enviarla, el remito al recibir, la factura y los comprobantes de pago al cargarlos.',
        table: [
          { label: 'Mercadería recibida', value: 'Todos los ítems llegaron (o su falta quedó saldada por un reclamo)', color: 'bg-emerald-100 text-emerald-700' },
          { label: 'Sin reclamos abiertos', value: 'Ningún REC- pendiente', color: 'bg-emerald-100 text-emerald-700' },
          { label: 'Control realizado', value: 'Alguien revisó la compra contra la factura', color: 'bg-emerald-100 text-emerald-700' },
          { label: 'Saldo en cero', value: 'Facturado = pagado + créditos', color: 'bg-emerald-100 text-emerald-700' },
          { label: 'Documentación completa', value: 'Orden, factura y remito archivados', color: 'bg-emerald-100 text-emerald-700' },
        ],
        tip: 'Con los tres primeros ya se puede cerrar la compra; cuando además está todo pagado y archivado, la orden queda con el sello "Cerrada totalmente".',
      },
      {
        id: 'legado',
        emoji: '🕘',
        title: 'Los pedidos PED- anteriores',
        intro: 'Los pedidos viejos siguen en la pestaña Órdenes tal cual estaban. "Pedido rápido" es el formulario de siempre; ahora también deja una solicitud y una recepción registradas para que todo quede trazado.',
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
  const navigate = useNavigate();
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
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[440px] max-w-full bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <BookOpen size={16} className="text-violet-600" />
            </div>
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Ayuda</p>
              <p className="text-sm font-bold text-gray-900">{data.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {/* Este panel es el resumen para consultar mientras se trabaja; el manual
            completo del tema vive en Manuales del sistema. */}
        {MANUAL_DE_TEMA[topic] && (
          <button
            onClick={() => { onClose(); navigate(`/ayuda/${MANUAL_DE_TEMA[topic]}`); }}
            className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-violet-200 bg-violet-50 text-left hover:bg-violet-100 transition-colors">
            <span className="text-xs font-semibold text-violet-900">Ver el manual completo de {data.label}</span>
            <ExternalLink size={13} className="text-violet-700 shrink-0" />
          </button>
        )}

        {/* Nav de secciones (solo si hay más de una) */}
        {data.sections.length > 1 && (
          <div className="flex gap-1 px-4 py-2.5 border-b border-gray-200 overflow-x-auto">
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
                    {step.note && <p className="text-xs text-gray-600 mt-0.5">{step.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabla */}
          {section.table && section.table.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {section.table.map((row, i) => (
                <div key={i} className={cn(
                  'flex gap-3 px-3 py-2.5 text-sm',
                  i % 2 === 0 ? 'bg-gray-50' : 'bg-white',
                  i < section.table!.length - 1 && 'border-b border-gray-200'
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
        <div className="border-t border-gray-200 px-5 py-3">
          <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider mb-2">Otros temas</p>
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
