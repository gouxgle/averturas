import {
  MapPin, CalendarPlus, Ruler, Camera, Wallet, ArrowRightLeft, Gift, AlertTriangle,
} from 'lucide-react';
import type { SeccionManual } from './tipos';

/** Manual de Visitas de Relevamiento de Datos. Ver `tipos.ts` para el formato. */
export const MANUAL_VISITAS: SeccionManual[] = [
  {
    id: 'para-que',
    titulo: 'Para qué sirve y cuándo se hace una',
    corto: 'Para qué sirve',
    icono: MapPin,
    bloques: [
      { t: 'p', texto: 'La **Visita de Relevamiento de Datos** es cuando vamos a la obra o a la casa del cliente a **medir** y anotar qué hace falta. Sin medidas no hay presupuesto serio de una abertura a medida.' },
      { t: 'p', texto: 'La visita guarda las medidas de cada vano, las especificaciones (color, vidrio, sistema), las fotos del lugar y las condiciones generales del trabajo. Después, con un botón, todo eso se convierte en un presupuesto sin volver a tipear nada.' },
      { t: 'flujo', nodos: ['Crear la visita', 'Ir y medir', 'Cargar el relevamiento', 'Avanzar a presupuesto'] },
      { t: 'p', texto: 'Cada visita tiene su número: **VT-202609-0001**.' },
      {
        t: 'tabla',
        cols: ['Estado', 'Qué significa'],
        filas: [
          ['Pendiente', 'Está creada pero todavía no se cargaron las medidas'],
          ['Relevada', 'Ya tiene ítems medidos cargados'],
          ['Convertida', 'Ya se usó para armar un presupuesto'],
          ['Cancelada', 'No se hizo o no va a seguir'],
        ],
      },
    ],
  },
  {
    id: 'crear',
    titulo: 'Crear la visita',
    corto: 'Crear',
    icono: CalendarPlus,
    bloques: [
      { t: 'p', texto: 'Se entra desde **Presupuestos → Visita de Relevamiento de Datos**. Se elige el cliente y se decide lo más importante: **si se cobra o no**.' },
      { t: 'subtitulo', texto: 'Cobrar o no cobrar' },
      {
        t: 'tabla',
        cols: ['Opción', 'Qué pasa'],
        filas: [
          ['**Cobrarla**', 'Se emite un recibo en el momento por el costo de visita configurado. La visita queda **cobrada**'],
          ['**Sin cargo**', 'No se emite nada. La visita queda **sin cargo**'],
        ],
      },
      { t: 'aviso', tono: 'ojo', texto: 'Para poder cobrarla tiene que haber un **costo de visita cargado** en Configuración → Empresa. Si está en cero, el sistema no deja elegir "cobrar".' },
      { t: 'subtitulo', texto: 'Visita atada a un presupuesto que ya existe' },
      { t: 'p', texto: 'Si el presupuesto ya está armado y solo faltan medir algunos ítems (los que se cargaron como **"A relevar"**), la visita se crea enganchada a ese presupuesto. Al terminar, esos ítems se completan **en el mismo presupuesto**, no se crea uno nuevo.' },
      {
        t: 'lista',
        items: [
          'El presupuesto tiene que ser **del mismo cliente**.',
          'No se puede relevar sobre un presupuesto **aprobado, rechazado o cancelado**.',
          'Un presupuesto puede tener **una sola visita pendiente** a la vez.',
        ],
      },
    ],
  },
  {
    id: 'relevamiento',
    titulo: 'Cargar el relevamiento',
    corto: 'Cargar medidas',
    icono: Ruler,
    bloques: [
      { t: 'p', texto: 'Desde el listado de visitas se abre la que corresponda y se cargan los ítems. Cada ítem es **un vano o un trabajo**.' },
      { t: 'subtitulo', texto: 'Los cuatro tipos de ítem' },
      {
        t: 'tabla',
        cols: ['Tipo', 'Cuándo se usa', 'Qué se carga'],
        filas: [
          ['**A medida**', 'Una abertura que hay que fabricar', 'Ambiente, descripción, ancho y alto, y las especificaciones'],
          ['**Estándar**', 'Un producto del catálogo que entra tal cual', 'Ambiente y el producto elegido'],
          ['**Servicio**', 'Colocación, reparación, mantenimiento', 'Ambiente y el servicio'],
        ],
      },
      { t: 'aviso', tono: 'regla', texto: 'Las medidas se cargan **en milímetros**. Un vano de 1,20 m de ancho se escribe **1200**. El sistema las pasa solo a metros cuando arma el presupuesto — no las conviertas vos.' },
      { t: 'subtitulo', texto: 'Especificaciones de una abertura a medida' },
      { t: 'p', texto: 'Cada ítem a medida abre un panel donde se elige **tipo de abertura**, **sistema**, **color**, **vidrio**, si lleva **premarco** y qué **accesorios**. También se puede adjuntar la **foto del cálculo** del software externo.' },
      { t: 'p', texto: 'Es la misma pantalla de especificaciones que se usa al cargar un presupuesto, así que lo que anotás acá llega intacto del otro lado.' },
    ],
  },
  {
    id: 'condiciones',
    titulo: 'Condiciones generales y fotos',
    corto: 'Condiciones y fotos',
    icono: Camera,
    bloques: [
      { t: 'p', texto: 'Abajo de los ítems hay tildes de **condiciones generales** de todo el trabajo, no de un vano en particular:' },
      {
        t: 'tabla',
        cols: ['Bloque', 'Opciones'],
        filas: [
          ['Color', 'Blanco · Negro · Natural · Otro (a especificar)'],
          ['Vidrio', 'Transparente · Esmerilado · Repartido · DVH · Otro'],
          ['Instalación', 'Con colocación · Sin colocación · Retira en local'],
          ['Abertura especial', 'Reja · Celosía · Persiana · Mosquitero'],
        ],
      },
      { t: 'p', texto: 'Hay además un campo de **observaciones** para todo lo que no entra en las tildes: un contrapiso desparejo, un acceso complicado, un plazo que pidió el cliente.' },
      { t: 'subtitulo', texto: 'Fotos' },
      { t: 'p', texto: 'Se pueden **arrastrar imágenes** al recuadro o **pegarlas con Ctrl+V**. Sacá fotos de cada vano y del acceso: son las que después evitan discusiones sobre qué se había acordado.' },
      { t: 'aviso', tono: 'info', texto: 'También se puede tomar la **firma del cliente** en el momento, como constancia de que el relevamiento se hizo y de lo que se acordó.' },
    ],
  },
  {
    id: 'cobro',
    titulo: 'El cobro de la visita',
    corto: 'Cobro',
    icono: Wallet,
    bloques: [
      { t: 'p', texto: 'La visita tiene su propio estado de cobro, aparte del estado del relevamiento.' },
      {
        t: 'tabla',
        cols: ['Estado de cobro', 'Qué significa'],
        filas: [
          ['**Cobrada**', 'Se emitió un recibo por el costo de la visita'],
          ['**Sin cargo**', 'Se decidió no cobrarla'],
          ['**Pendiente**', 'Estaba cobrada pero se anuló el recibo'],
          ['**Bonificada**', 'Lo que pagó por la visita se le acreditó al presupuesto'],
        ],
      },
      { t: 'subtitulo', texto: 'Costo externo' },
      { t: 'p', texto: 'Si el relevamiento lo hizo alguien de afuera y hubo que pagarle, se anota como **costo externo**. Es lo que nos costó a nosotros, no lo que le cobramos al cliente — sirve para saber si la visita dio ganancia o pérdida.' },
      { t: 'aviso', tono: 'ojo', texto: 'Una visita **sin cargo** no se puede pasar a cobrada después. Si te equivocaste, el camino es crear la visita de nuevo con la opción correcta.' },
    ],
  },
  {
    id: 'bonificar',
    titulo: 'Acreditar la visita al presupuesto',
    corto: 'Bonificar',
    icono: Gift,
    bloques: [
      { t: 'p', texto: 'Es lo más común del circuito: **se le cobró la visita, después compró, y esa plata se le descuenta de la compra**. En el sistema se llama **bonificar**.' },
      { t: 'p', texto: 'Al bonificar, el recibo de la visita deja de estar suelto y pasa a contar como **pago a cuenta del presupuesto**. El cliente no pagó dos veces: pagó una y se le acreditó.' },
      { t: 'aviso', tono: 'regla', texto: 'Para poder bonificar tienen que darse **todas** estas condiciones: la visita está cobrada y su recibo sigue emitido (no anulado), el recibo no está ya acreditado a otro presupuesto, el presupuesto es **del mismo cliente**, el presupuesto **salió de esa visita**, y no está cancelado ni rechazado.' },
      { t: 'p', texto: 'Si el presupuesto después se cae, se puede **desbonificar**: el recibo vuelve a ser de la visita y la visita vuelve a estar cobrada.' },
      { t: 'aviso', tono: 'ojo', texto: 'El crédito de la visita **no cuenta como seña del cliente**. Un presupuesto cuyo único pago es la visita acreditada no habilita a comprarle al proveedor — para eso hace falta plata puesta por el cliente sobre el presupuesto.' },
      { t: 'p', texto: 'Cuando la visita quedó **sin cargo**, la proforma se lo aclara al cliente: le dice que el relevamiento fue bonificado. Es un argumento de venta, conviene que se vea.' },
    ],
  },
  {
    id: 'avanzar',
    titulo: 'Pasar la visita a presupuesto',
    corto: 'Avanzar',
    icono: ArrowRightLeft,
    bloques: [
      { t: 'p', texto: 'Abajo de la pantalla hay dos botones:' },
      {
        t: 'lista',
        items: [
          '**Guardar** — deja el relevamiento guardado para seguir después. La visita pasa a **relevada** en cuanto tiene al menos un ítem.',
          '**Avanzar a presupuesto** — guarda y arma el presupuesto con todo lo cargado.',
        ],
      },
      { t: 'p', texto: 'Si la visita estaba enganchada a un presupuesto que ya existía, el botón dice **"Completar presupuesto PRO-xxxx"** y los ítems se agregan a ese, en lugar de crear uno nuevo.' },
      { t: 'aviso', tono: 'regla', texto: 'No se puede avanzar sin **al menos un ítem medido**. El sistema avisa: *"Cargá al menos un ítem medido antes de avanzar"*.' },
      { t: 'p', texto: 'Al avanzar, cada ítem llega al presupuesto con su descripción armada como **"Ambiente — Descripción"**, las medidas ya convertidas a metros y todas las especificaciones puestas. Solo queda poner los precios.' },
      { t: 'p', texto: 'La visita queda **convertida** y en modo solo lectura: ya cumplió su función y no se toca más.' },
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
        cols: ['Mensaje', 'Por qué', 'Qué hacer'],
        filas: [
          ['"No hay costo de visita configurado"', 'Está en cero en Configuración', 'Cargalo en Configuración → Empresa, o creá la visita sin cargo'],
          ['"Este presupuesto ya tiene una visita pendiente"', 'Quedó otra abierta', 'Usá la que ya existe, o cancelala primero'],
          ['"El presupuesto es de otro cliente"', 'Se quiso enganchar a un presupuesto ajeno', 'Revisá el cliente'],
          ['"La visita no fue cobrada, no hay importe para acreditar"', 'Se quiso bonificar una visita sin cargo', 'No hay nada que acreditar'],
          ['"El recibo ya está acreditado a otro presupuesto"', 'Esa plata ya se usó', 'Desbonificá del otro presupuesto primero'],
          ['"No se puede relevar ítems faltantes de un presupuesto aprobado"', 'El presupuesto ya se cerró', 'Si hay que cambiar algo, es un presupuesto nuevo'],
        ],
      },
      { t: 'aviso', tono: 'ojo', texto: 'Cancelar una visita **no se puede deshacer**. El sistema pide confirmación antes.' },
    ],
  },
];
