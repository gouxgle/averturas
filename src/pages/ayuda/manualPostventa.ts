import { HeartHandshake, Workflow, MessageCircle, Star, Settings2, HelpCircle, Wrench, PenLine, Wallet } from 'lucide-react';
import type { SeccionManual } from './tipos';

/** Manual de Post venta. Ver `tipos.ts` para el formato de los bloques. */
export const MANUAL_POSTVENTA: SeccionManual[] = [
  {
    id: 'para-que',
    titulo: 'Para qué sirve',
    corto: 'Para qué sirve',
    icono: HeartHandshake,
    bloques: [
      { t: 'p', texto: 'Unos días después de entregar un pedido, el sistema te recuerda **preguntarle al cliente cómo le fue**: si quedó conforme con los productos, con la entrega y con la atención. Esa opinión te sirve para detectar problemas a tiempo, cuidar al cliente y mejorar el proceso.' },
      { t: 'aviso', tono: 'regla', texto: 'El sistema **nunca manda nada solo**. Te arma el mensaje y lo mandás vos con un clic, después de revisarlo.' },
    ],
  },
  {
    id: 'ciclo',
    titulo: 'El ciclo de un seguimiento',
    corto: 'El ciclo',
    icono: Workflow,
    bloques: [
      { t: 'flujo', nodos: ['Se entrega el pedido', 'Pasan unos días', 'Enviás el WhatsApp', 'El cliente responde', 'Queda registrado'] },
      {
        t: 'tabla',
        cols: ['Estado', 'Qué significa', 'Dónde está'],
        filas: [
          ['**Pendiente**', 'Se creó al entregar; todavía no se le escribió', 'Para contactar (si ya llegó la fecha) o Próximos'],
          ['**Enviado**', 'Se mandó el WhatsApp con el link de la encuesta; falta que responda', 'Sin respuesta'],
          ['**Respondido**', 'El cliente contestó la encuesta (o lo cargaste vos a mano)', 'Respondidos'],
          ['**Descartado**', 'No corresponde preguntar (con su motivo)', 'Descartados'],
        ],
      },
      { t: 'p', texto: 'El seguimiento nace solo cuando un **remito pasa a entregado** (también en la venta rápida si el cliente retira en el momento). Hay **uno por pedido**: si se entrega en partes, no se duplica. Se crea para **hoy + los días configurados** (3 por defecto) y aparece también en la **Agenda del día**.' },
      { t: 'aviso', tono: 'ojo', texto: 'Si el cliente **no tiene teléfono cargado** no se crea el seguimiento (no hay a quién escribirle). Si se cancela el pedido, se descarta solo.' },
    ],
  },
  {
    id: 'enviar',
    titulo: 'Contactar al cliente',
    corto: 'Contactar',
    icono: MessageCircle,
    bloques: [
      { t: 'lista', ordenada: true, items: [
        'Entrá a **Post venta**. La pestaña **"Para contactar"** muestra a quién le toca hoy (los más atrasados primero).',
        'Tocá **"Enviar WhatsApp"**. Se abre el mensaje ya armado con el nombre del cliente, lo que se le entregó y el link de la encuesta.',
        'Si querés, **editá el texto**. Lo único que no hay que borrar es el link: sin él el cliente no puede responder.',
        'Tocá **Enviar**. Queda anotado en el historial del cliente y la tarea de la Agenda se cierra.',
      ] },
      { t: 'subtitulo', texto: 'Otras acciones' },
      {
        t: 'tabla',
        cols: ['Botón', 'Para qué'],
        filas: [
          ['**Reprogramar**', 'Moverlo a otra fecha (el cliente está de viaje, la obra no terminó…)'],
          ['**Ya respondió / Cargar respuesta**', 'El cliente contestó por chat o por teléfono: cargás las notas y el comentario'],
          ['**Reenviar WhatsApp**', 'En "Sin respuesta", para volver a insistir'],
          ['**Descartar**', 'No corresponde preguntar: ya hablaron, hay un reclamo en curso, el cliente pidió que no lo contacten'],
        ],
      },
    ],
  },
  {
    id: 'respuestas',
    titulo: 'La encuesta y las respuestas',
    corto: 'Respuestas',
    icono: Star,
    bloques: [
      { t: 'p', texto: 'El cliente abre el link desde el celular y califica de **1 a 5 estrellas** tres cosas: **los productos**, **la entrega y la instalación** y **la atención en la venta**. Puede dejar un comentario. Responde **una sola vez** y el link vale 30 días desde que se envió.' },
      { t: 'lista', items: [
        'En **Respondidos** ves las tres notas y el comentario de cada cliente.',
        'Arriba de la pantalla están los **promedios de los últimos 90 días** y qué porcentaje de los contactados respondió.',
        'Si alguna nota es **2 o menos**, le llega un aviso (campanita y cartel) como **"Cliente insatisfecho"** para que lo llamen enseguida.',
      ] },
      { t: 'aviso', tono: 'info', texto: 'Una nota baja no se resuelve sola: conviene llamar al cliente, entender qué pasó y, si hace falta, registrar una devolución o tocar **"Generar servicio"** en la tarjeta para coordinar el arreglo (ver Garantías y servicios).' },
    ],
  },
  {
    id: 'ajustes',
    titulo: 'Ajustes: días y mensaje',
    corto: 'Ajustes',
    icono: Settings2,
    bloques: [
      { t: 'lista', items: [
        '**Cuántos días después de la entrega**: arriba en Post venta, **"Cambiar"** (solo administradores). Aplica a las próximas entregas; los seguimientos ya creados se pueden mover con "Reprogramar".',
        '**El texto del mensaje**: **Configuración → Mensajes → "Post venta: consulta de satisfacción"**. Se pueden usar estas variables, que el sistema reemplaza solo: {{nombre}}, {{productos}}, {{empresa}} y {{link}}.',
      ] },
      { t: 'aviso', tono: 'regla', texto: 'Si en la plantilla borrás {{link}}, el sistema lo agrega igual al final del mensaje: sin link el cliente no puede responder.' },
    ],
  },
  {
    id: 'servicios',
    titulo: 'Garantías y servicios técnicos',
    corto: 'Garantías y servicios',
    icono: Wrench,
    bloques: [
      { t: 'p', texto: 'En **Post venta → "Garantías y servicios"** se ordenan los trabajos después de la venta: **garantías** (sin cargo), **reparaciones con cargo** y **mantenimientos**. Cada reclamo es una **ficha de servicio** (número **ST-**) con todo su historial: visitas, firmas, cobros y reclamos al proveedor.' },
      { t: 'flujo', nodos: ['Reclamo del cliente', 'Ficha de servicio', 'Visita en la Agenda', 'Trabajo realizado', 'Firma del cliente', 'Ficha en PDF', 'Cierre'] },
      { t: 'subtitulo', texto: 'Dónde se abre una ficha' },
      { t: 'lista', items: [
        '**Post venta → Garantías y servicios → "Nuevo servicio"**: buscás al cliente.',
        '**Ficha del cliente**: menú ⋮ → **"Servicio / garantía"**, o la pestaña **Servicios**.',
        '**Remito o presupuesto entregado**: botón **"Generar servicio / garantía"** (ya trae el cliente y el pedido).',
        '**Seguimiento de post venta**: botón **"Generar servicio"** en la tarjeta (ya trae cliente, pedido y el comentario del cliente). Después la tarjeta muestra el estado del servicio.',
      ] },
      { t: 'p', texto: 'Al abrirla elegís **el producto** de la lista de lo que se le entregó (o lo escribís si no está, por ejemplo algo que no le vendimos), el **tipo de servicio**, el **problema que cuenta el cliente**, la **fecha del reclamo** y **fotos o videos** (hasta 50 MB por video, unos 30 segundos). Si el producto está dentro del plazo de garantía (12 meses por defecto) el sistema lo avisa y sugiere "Garantía". Si ese producto ya tuvo otros servicios, la ficha los muestra.' },
      {
        t: 'tabla',
        cols: ['Estado', 'Qué significa'],
        filas: [
          ['**Pendiente de coordinar**', 'Recién abierto, o hay que acordar otra visita'],
          ['**Visita programada**', 'Tiene responsable y fecha: está en la **Agenda**. Reprogramarla desde la Agenda mueve la visita de la ficha'],
          ['**En proceso**', 'El técnico ya fue (o se marcó hecha la visita en la Agenda) y falta cerrar'],
          ['**Repuesto o nueva visita**', 'No se resolvió en la visita: falta una pieza u otra visita'],
          ['**Finalizado** / **Cancelado**', 'Cerrado. Se puede **Reabrir** si vuelve el problema'],
        ],
      },
      { t: 'aviso', tono: 'info', texto: 'El **responsable** puede ser un usuario del sistema o una persona que no tiene usuario (un instalador externo): elegí "Otra persona" y escribí el nombre.' },
    ],
  },
  {
    id: 'servicio-visita',
    titulo: 'La visita, la firma y el comprobante',
    corto: 'Visita y firma',
    icono: PenLine,
    bloques: [
      { t: 'lista', ordenada: true, items: [
        'En la ficha, **"Registrar visita"**: fecha, técnico, problema encontrado, **trabajo realizado** (ajuste, reparación, cambio de pieza, reemplazo completo), repuestos usados, **fotos de antes y después**, observaciones, trabajos pendientes, si fue **sin cargo o con cargo** y **cómo quedó**.',
        'Al guardar, si el cliente está ahí, tocá **"Firmar ahora"**: en el celular el cliente marca **Recibido conforme** o **Con observaciones** (y las escribe), aclaración, DNI y **firma con el dedo**. Si no puede firmar, se guarda con el motivo.',
        'Con la firma, si la visita **resolvió el problema**, el servicio queda **Finalizado**. Si falta otra visita o un repuesto, queda esperando y se programa la próxima visita en la misma ficha: todo el historial queda junto.',
        '**"Ver PDF"** muestra la ficha de servicio de esa visita y **"Enviar por WhatsApp"** se la manda al cliente.',
      ] },
      { t: 'aviso', tono: 'regla', texto: 'Una visita **firmada no se puede modificar**: es el comprobante. La firma deja constancia del servicio recibido y **no impide reclamos futuros** que correspondan (la ficha lo dice).' },
      { t: 'p', texto: 'Todo queda en el **historial del cliente** (apertura, conformidad, envíos) y en la pestaña **Servicios** de su ficha.' },
    ],
  },
  {
    id: 'servicio-cobro',
    titulo: 'Cobro, proveedor y consulta posterior',
    corto: 'Cobro y proveedor',
    icono: Wallet,
    bloques: [
      {
        t: 'tabla',
        cols: ['Botón', 'Cuándo usarlo'],
        filas: [
          ['**Cobrar**', 'Trabajo simple con cargo: emite un **recibo** vinculado al servicio. Se factura desde Recibos, como siempre'],
          ['**Armar presupuesto**', 'Lleva repuestos o hay que pasar precio antes: abre un presupuesto con el cliente y el servicio cargados; sigue el circuito normal (aprobación, recibo)'],
          ['**Reclamar al proveedor**', 'La falla necesita una pieza o un producto del proveedor. Si el producto vino de una **orden de compra**, se abre el **reclamo (REC-)** sobre esa orden; si no, una **solicitud de compra** de garantía para pedir el repuesto. Se sigue desde **Compras**'],
        ],
      },
      { t: 'p', texto: 'Cuando el servicio se **finaliza**, el sistema agenda **volver a consultar al cliente** a los días de post venta configurados. En la ficha (y en la pestaña **"Para reconsultar"**) marcás **"Funciona bien"** o **"Sigue con problemas"**, que reabre el servicio.' },
    ],
  },
  {
    id: 'problemas',
    titulo: 'Problemas frecuentes',
    corto: 'Problemas frecuentes',
    icono: HelpCircle,
    bloques: [
      {
        t: 'tabla',
        cols: ['Qué pasa', 'Qué hacer'],
        filas: [
          ['No aparece el seguimiento de una entrega', 'Revisá que el cliente tenga **teléfono** y que el remito esté **entregado**. Si el pedido ya tenía uno (entrega parcial), es el mismo'],
          ['"El cliente no tiene teléfono registrado"', 'Cargalo en su ficha y volvé a intentar'],
          ['No se pudo enviar el WhatsApp', 'Revisá la conexión de WhatsApp del sistema o el número del cliente; el seguimiento sigue pendiente'],
          ['El cliente abre el link y dice que venció', 'Los links valen 30 días desde el envío: reenviá el mensaje desde "Sin respuesta"'],
          ['El cliente contestó por chat', 'Usá **Cargar respuesta** para dejarlo registrado'],
          ['El producto no aparece al abrir un servicio', 'Solo se listan los productos de remitos emitidos o entregados. Elegí **"Otro producto"** y escribilo'],
          ['"El video supera los 50 MB"', 'Grabá uno más corto (unos 30 segundos) o mandalo en partes'],
          ['No puedo editar una visita', 'Ya está **firmada**: es el comprobante. Registrá otra visita si hace falta corregir algo'],
        ],
      },
    ],
  },
];
