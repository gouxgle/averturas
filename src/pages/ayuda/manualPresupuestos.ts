import {
  Workflow, LayoutDashboard, FilePlus2, Tags, Send, Globe, MessageSquareReply,
  Receipt, History, Clock, AlertTriangle,
} from 'lucide-react';
import type { SeccionManual } from './tipos';

/** Manual de Presupuestos. Ver `tipos.ts` para el formato de los bloques. */
export const MANUAL_PRESUPUESTOS: SeccionManual[] = [
  {
    id: 'circuito',
    titulo: 'Para qué sirve y cómo es el circuito',
    corto: 'El circuito',
    icono: Workflow,
    bloques: [
      { t: 'p', texto: 'Un presupuesto es la propuesta que le hacemos a un cliente. El sistema guarda toda su historia: qué se le ofreció, qué se le mandó y cuándo, si lo abrió, qué contestó, cuánto pagó y en qué terminó.' },
      { t: 'flujo', nodos: ['Armar', 'Enviar', 'El cliente responde', 'Aprobado', 'Cobrar', 'Entregar'] },
      { t: 'p', texto: 'Internamente el documento se numera **OP-00123**, pero lo que ve el cliente se llama **proforma** y se numera **PRO-00123**. Es el mismo documento con dos nombres: uno para adentro y otro para afuera.' },
      {
        t: 'tabla',
        cols: ['Estado', 'Qué significa'],
        filas: [
          ['**Pendiente de Aprobación**', 'Está armado pero el cliente todavía no lo aprobó'],
          ['**Enviado**', 'Se le mandó el link y estamos esperando respuesta'],
          ['**Aprobado**', 'El cliente dijo que sí — ya se puede cobrar y pedir'],
          ['**Rechazado**', 'El cliente dijo que no'],
          ['**Cancelado**', 'Lo dimos de baja nosotros'],
        ],
      },
      { t: 'aviso', tono: 'info', texto: 'Una vez **aprobado** el presupuesto no se edita más. Es a propósito: es el documento contra el que se cobra y se le compra al proveedor. Si hay que cambiar algo, se arma uno nuevo.' },
      { t: 'aviso', tono: 'regla', texto: 'Si se aceptó por error, el botón **Deshacer aprobación** (abajo del todo en el detalle) lo vuelve al estado anterior. Solo funciona mientras no se generó nada sobre ese presupuesto: si ya hay un recibo, un pedido al proveedor o un remito, primero hay que anular esos documentos.' },
    ],
  },
  {
    id: 'pantalla',
    titulo: 'La pantalla: cómo leer la lista',
    corto: 'La lista',
    icono: LayoutDashboard,
    bloques: [
      { t: 'p', texto: 'Arriba está la barra de **métricas** (cuántos activos, importe total, cuántos sin respuesta, cuántos vencidos, tasa de cierre) y abajo las **pestañas**, que son filtros de la misma lista.' },
      {
        t: 'tabla',
        cols: ['Pestaña', 'Qué junta'],
        filas: [
          ['Todos', 'Todo lo que está vivo'],
          ['Seguimiento', 'El cliente contestó algo y hay que hacer algo con eso'],
          ['Sin respuesta', 'Enviados hace más de 3 días sin noticias'],
          ['Por vencer', 'Se vencen dentro de la semana'],
          ['Vencidos', 'Ya se pasó la fecha de validez'],
          ['Aprobados', 'Los que el cliente aceptó'],
          ['Perdidos', 'Los rechazados'],
        ],
      },
      { t: 'subtitulo', texto: 'Las etiquetas de cada fila' },
      { t: 'p', texto: 'Cada fila tiene etiquetas ordenadas en **tres niveles**, siempre en el mismo orden. Una vez que le agarrás la mano, se lee de un vistazo.' },
      {
        t: 'tabla',
        cols: ['Nivel', 'Cómo se ve', 'Qué dice'],
        filas: [
          ['**1 — El estado**', 'Etiqueta de color **lleno**, una sola por fila', 'En qué punto está el documento'],
          ['**2 — Las señales**', 'Pastillas **pastel con borde**', 'La plata y lo que pide acción'],
          ['**3 — El rastro**', 'Texto **gris sin recuadro**', 'Cómo llegó hasta acá'],
        ],
      },
      { t: 'p', texto: 'Las señales del nivel 2 salen siempre en este orden: **falta enviar → qué contestó el cliente → esperando relevamiento → pedido al proveedor → cobro → vencimiento → sin abrir → prioridad**. Lo primero que aparece es lo más urgente.' },
      {
        t: 'tabla',
        cols: ['Señal', 'Qué quiere decir'],
        filas: [
          ['✉ Falta enviar', 'Está armado pero nunca se le mandó al cliente'],
          ['○ Sin cobrar / ◑ Señado $X / ● Pago total', 'Cuánto se cobró de un presupuesto aprobado'],
          ['Vencido hace N días / Vence hoy / Vence en N días', 'La fecha de validez'],
          ['Sin abrir', 'Se le mandó el link y todavía no lo abrió'],
          ['📐 Esperando relevamiento', 'Hay ítems sin medir — no se puede compartir así'],
          ['Alta / Media prioridad · Listo p/ cerrar', 'Qué tan urgente lo considera el sistema'],
        ],
      },
      { t: 'aviso', tono: 'info', texto: 'La **franja de color** del borde izquierdo indica el estado, igual que la etiqueta del nivel 1. Verde = aprobado, rojo = rechazado.' },
      { t: 'p', texto: 'La columna **Validez** tiene los botones **+7d** y **+15d**: extienden la fecha de validez sin abrir el presupuesto. Sirve cuando el cliente pidió tiempo y no querés que se vea vencido.' },
    ],
  },
  {
    id: 'armar',
    titulo: 'Armar un presupuesto',
    corto: 'Armar',
    icono: FilePlus2,
    bloques: [
      { t: 'p', texto: 'Botón **Nuevo presupuesto**. Primero se elige el cliente (buscador por nombre; si no está, **Cliente nuevo**).' },
      { t: 'p', texto: 'Después se cargan los ítems. Arriba de la carga hay cuatro solapas, una por tipo de ítem.' },
      {
        t: 'tabla',
        cols: ['Tipo', 'Cuándo', 'Cómo se carga'],
        filas: [
          ['**Estándar**', 'Producto del catálogo', 'Se elige de la galería, con su precio y su stock'],
          ['**A medida**', 'Abertura que hay que fabricar', 'Medidas a mano y especificaciones; se puede adjuntar la foto del cálculo'],
          ['**Servicio**', 'Colocación, reparación, flete', 'Del catálogo de servicios o escrito a mano'],
          ['**A relevar**', 'No se sabe la medida todavía', 'Solo la descripción — queda marcado como pendiente de medir'],
        ],
      },
      { t: 'aviso', tono: 'ojo', texto: 'Un presupuesto con ítems **"A relevar"** no se puede compartir con el cliente hasta que se midan. El botón Compartir queda apagado y avisa qué visita falta. Es a propósito: no queremos mandar un precio de algo que no se midió.' },
      { t: 'subtitulo', texto: 'Los datos de abajo' },
      {
        t: 'lista',
        items: [
          '**Forma de pago** — texto libre; salen sugerencias de las que están cargadas en Configuración.',
          '**Forma de envío** — Retiro en local · Envío bonificado · Envío a destino (lo paga el cliente) · Envío a cargo de la empresa.',
          '**Fecha de validez** — hasta cuándo vale el precio. Es la que después marca el presupuesto como vencido.',
          '**Tiempo de entrega** — en días, para que el cliente sepa qué esperar.',
        ],
      },
      { t: 'aviso', tono: 'regla', texto: 'Los **servicios nunca requieren pedirle nada al proveedor**. El sistema los excluye solo de los controles de stock y de cobertura de ítems.' },
    ],
  },
  {
    id: 'proforma',
    titulo: 'La proforma: lo que ve el cliente',
    corto: 'La proforma',
    icono: Tags,
    bloques: [
      { t: 'p', texto: 'La proforma es la versión del presupuesto **sin costos ni márgenes**: solo lo que el cliente tiene que ver. Se puede imprimir en PDF desde el botón **PDF** del detalle.' },
      { t: 'p', texto: 'Muestra los ítems con su miniatura (la foto del producto, o la del cálculo en los ítems a medida), las formas de pago, el envío y la validez.' },
      { t: 'aviso', tono: 'info', texto: 'Si el presupuesto salió de una **Visita de Relevamiento sin cargo**, la proforma lo aclara: le dice al cliente que el relevamiento fue bonificado. Conviene que se vea, es un argumento de venta.' },
    ],
  },
  {
    id: 'enviar',
    titulo: 'Enviarle el presupuesto al cliente',
    corto: 'Enviar',
    icono: Send,
    bloques: [
      { t: 'p', texto: 'Se abre el presupuesto (click en la fila) y se aprieta **Compartir**. Eso genera un **link único** para ese cliente.' },
      { t: 'p', texto: 'Con el link ya generado aparecen los botones **Enviar por WhatsApp** y **Enviar por email**. El WhatsApp sale por el sistema, con el mensaje de la plantilla cargada en Configuración.' },
      { t: 'subtitulo', texto: 'Revisiones' },
      { t: 'p', texto: 'Cada vez que se envía, el sistema **congela una foto** del presupuesto en ese momento: es una **revisión** (Rev. 1, Rev. 2, …). El cliente aprueba esa foto, no el presupuesto vivo.' },
      {
        t: 'lista',
        items: [
          'Si volvés a compartir y **no cambió nada**, se reutiliza el mismo link y la misma revisión.',
          'Si **cambiaste algo** desde el último envío, se arma una revisión nueva.',
          'Si el cliente había **rechazado** y se lo reenviás, se fuerza una revisión nueva y el presupuesto vuelve a **enviado**.',
        ],
      },
      { t: 'aviso', tono: 'regla', texto: 'Los links **vencen a los 30 días** del envío. Vencido, el cliente ve una página que le pide que lo vuelva a solicitar. Se arregla volviendo a compartir.' },
      { t: 'aviso', tono: 'ojo', texto: 'Un presupuesto **vencido** (pasada la fecha de validez) no deja generar link. Extendé la validez con **+7d** / **+15d** o editá la fecha antes de compartir.' },
      { t: 'p', texto: 'Si el cliente tiene abierto un link viejo, lo sigue viendo pero con un aviso de que hay una versión más nueva, y un comparador que le muestra qué cambió.' },
    ],
  },
  {
    id: 'cliente',
    titulo: 'Qué puede hacer el cliente con el link',
    corto: 'El cliente',
    icono: Globe,
    bloques: [
      { t: 'p', texto: 'El cliente abre el link desde el celular y ve la proforma completa. Tiene cuatro caminos.' },
      {
        t: 'tabla',
        cols: ['Qué hace', 'Qué pasa de este lado'],
        filas: [
          ['**Aprobar**', 'El presupuesto pasa a **Aprobado** y te llega un aviso'],
          ['**No voy a avanzar**', 'Pasa a **Rechazado**, con el motivo que eligió'],
          ['**Necesito más tiempo**', 'No cambia el estado; se crea una tarea de seguimiento'],
          ['**Tengo una consulta / Quiero que me llamen / Quiero modificar**', 'No cambia el estado; queda la señal y una tarea'],
        ],
      },
      { t: 'subtitulo', texto: 'Los motivos que puede elegir' },
      {
        t: 'lista',
        items: [
          '**Al rechazar**: el precio no me cierra · ya compré en otro lugar · cancelé la obra · no era lo que buscaba · otro motivo.',
          '**Al pedir tiempo**: estoy comparando · necesito consultarlo · espero cobrar · la obra no empezó · todavía no lo decidí · quiero retomarlo más adelante. Ese motivo define la fecha de seguimiento sugerida.',
          '**Al pedir cambios**: medidas · color · vidrio · sistema · cantidad · una opción más económica · agregar o quitar productos.',
          '**Al pedir llamado**: puede dejar el día y el horario que le queda cómodo.',
        ],
      },
      { t: 'aviso', tono: 'regla', texto: 'El cliente solo puede aprobar o rechazar **la última revisión**, y solo si coincide con el presupuesto vivo. Si editaste después de enviar, el sistema no lo deja y le pide el documento actualizado — así nunca se aprueba un precio viejo.' },
      { t: 'p', texto: 'Cada vez que el cliente abre el link queda registrado. Por eso en la lista ves **"Visto hace 3 h"** o la señal **"Sin abrir"**.' },
    ],
  },
  {
    id: 'seguimiento',
    titulo: 'Seguimiento: qué hacer con lo que contestó',
    corto: 'Seguimiento',
    icono: MessageSquareReply,
    bloques: [
      { t: 'p', texto: 'Cuando el cliente contesta algo que no es sí ni no, aparece en la pestaña **Seguimiento** con su señal (⏳ Pidió más tiempo, 💬 Consulta, 📞 Pidió llamado, ✏️ Pidió cambios).' },
      { t: 'p', texto: 'Esa señal se limpia de tres maneras: **completando la tarea** de seguimiento, **volviendo a enviarle** el presupuesto, o marcándola como resuelta desde el detalle.' },
      { t: 'subtitulo', texto: 'Cuando el presupuesto se cae' },
      { t: 'p', texto: 'Un presupuesto rechazado o vencido no se tira a la basura: se puede convertir en una **oportunidad futura**, con una fecha de recontacto. Llegada esa fecha aparece solo en la agenda del Dashboard.' },
      { t: 'aviso', tono: 'info', texto: 'El sistema no manda recordatorios solo. Lo que hace es **poner las cosas adelante tuyo el día que corresponde**: en la agenda del Dashboard y en la pestaña Seguimiento.' },
    ],
  },
  {
    id: 'cobro',
    titulo: 'Cobrar un presupuesto aprobado',
    corto: 'Cobrar',
    icono: Receipt,
    bloques: [
      { t: 'p', texto: 'Desde el detalle de un presupuesto aprobado, el botón **Registrar cobro** abre el recibo ya cargado con los datos.' },
      {
        t: 'tabla',
        cols: ['Señal en la lista', 'Qué significa'],
        filas: [
          ['○ Sin cobrar', 'No se registró ningún pago'],
          ['◑ Señado $X', 'Hay un pago parcial y queda saldo'],
          ['● Pago total', 'Está cobrado del todo'],
        ],
      },
      { t: 'aviso', tono: 'regla', texto: 'Solo se puede emitir recibos sobre presupuestos **aprobados**. El formulario **no viene con "total" preseleccionado** a propósito: hay que elegir si es total o parcial, porque antes salían recibos por el saldo completo por olvido.' },
      { t: 'p', texto: 'Un pago parcial genera un **compromiso de pago**, que se cierra solo cuando se termina de cobrar.' },
      { t: 'aviso', tono: 'ojo', texto: 'El **saldo real** es precio total − cobrado − bonificaciones. Una bonificación no es deuda del cliente.' },
    ],
  },
  {
    id: 'versiones',
    titulo: 'Versiones y revisiones: no son lo mismo',
    corto: 'Versiones',
    icono: History,
    bloques: [
      { t: 'p', texto: 'Son dos historiales distintos y conviene no confundirlos.' },
      {
        t: 'tabla',
        cols: ['', 'Versión', 'Revisión'],
        filas: [
          ['Cuándo se guarda', 'Cada vez que **editás** el presupuesto', 'Cada vez que se lo **enviás** al cliente'],
          ['Qué guarda', 'El estado anterior, **con costos**', 'Lo que vio el cliente, **sin costos**'],
          ['Para qué', 'Auditoría interna', 'Respaldo de qué aprobó'],
          ['Quién la ve', 'Solo nosotros', 'El cliente, por su link'],
        ],
      },
      { t: 'p', texto: 'En la lista, la etiqueta gris **"Editado ×N"** cuenta las versiones. En el detalle se ven las dos historias completas.' },
      { t: 'p', texto: 'El PDF de cualquier revisión anterior se puede imprimir, para tener exactamente el papel que vio el cliente en su momento.' },
    ],
  },
  {
    id: 'despues',
    titulo: 'Qué pasa después de aprobado',
    corto: 'Después',
    icono: Clock,
    bloques: [
      { t: 'p', texto: 'Un presupuesto aprobado sigue su vida en otras pantallas:' },
      {
        t: 'tabla',
        cols: ['Si…', 'Entonces…'],
        filas: [
          ['Todo está en stock', 'Va directo a "Lista para entregar" — se arma el remito'],
          ['Falta algo', 'Se genera una solicitud de compra al proveedor desde **Compras**'],
          ['Hay que cobrar', 'Se emite el recibo desde **Recibos**'],
          ['Hay que entregar', 'Se arma el remito desde **Remitos**'],
        ],
      },
      { t: 'aviso', tono: 'ojo', texto: 'Para poder comprarle al proveedor hace falta que el cliente **haya puesto plata**. El crédito de una visita acreditada no cuenta como seña.' },
      { t: 'p', texto: 'La señal de pedido en la lista (**Pedido generado · Env. parcial · Env. total · Pedido recibido**) te dice en qué anda la compra sin salir de Presupuestos.' },
    ],
  },
  {
    id: 'problemas',
    titulo: 'Cuando algo no sale',
    corto: 'Problemas',
    icono: AlertTriangle,
    bloques: [
      {
        t: 'tabla',
        cols: ['Qué pasa', 'Por qué', 'Qué hacer'],
        filas: [
          ['El botón Compartir está apagado', 'El presupuesto está vencido, o hay ítems a relevar', 'Extendé la validez, o completá la visita'],
          ['No puedo editarlo', 'Ya está aprobado', 'Armá uno nuevo'],
          ['Lo aprobé/aprobó el cliente por error', 'Pasa', 'Detalle → Deshacer aprobación (si no hay recibo, pedido ni remito generados)'],
          ['El cliente dice que el link no anda', 'Pasaron 30 días del envío', 'Volvé a compartir: genera un link nuevo'],
          ['El cliente no puede aprobar', 'Se editó después de enviar y ya no coincide', 'Reenviale el presupuesto — se arma una revisión nueva'],
          ['No me deja emitir el recibo', 'El presupuesto no está aprobado', 'Aprobalo primero'],
          ['Dice "Sin abrir" hace días', 'Le llegó pero no lo abrió', 'Llamalo — está en la pestaña Sin respuesta'],
        ],
      },
    ],
  },
];
