import { HeartHandshake, Workflow, MessageCircle, Star, Settings2, HelpCircle } from 'lucide-react';
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
      { t: 'aviso', tono: 'info', texto: 'Una nota baja no se resuelve sola: conviene llamar al cliente, entender qué pasó y, si hace falta, registrar una devolución o coordinar un arreglo.' },
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
        ],
      },
    ],
  },
];
