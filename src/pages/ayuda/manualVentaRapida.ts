import {
  Zap, UserPlus, PackageSearch, Wallet, Truck, FileCheck2, AlertTriangle, Undo2,
} from 'lucide-react';
import type { SeccionManual } from './tipos';

/** Manual de Venta rápida — mostrador. Ver `tipos.ts` para el formato de los bloques. */
export const MANUAL_VENTA_RAPIDA: SeccionManual[] = [
  {
    id: 'para-que',
    titulo: 'Para qué sirve y cuándo usarla',
    corto: 'Para qué sirve',
    icono: Zap,
    bloques: [
      { t: 'p', texto: 'Venta rápida es la pantalla del **mostrador**: el cliente viene, se lleva algo que está en el salón y paga en el momento. En una sola pantalla se elige el cliente, se cargan los productos, se cobra y se entrega.' },
      { t: 'p', texto: 'Lo que en el circuito normal son cuatro pasos (presupuesto → aprobación → recibo → remito), acá pasa todo junto al apretar un botón.' },
      { t: 'flujo', nodos: ['Elegir cliente', 'Cargar productos', 'Cobrar', 'Confirmar venta'] },
      {
        t: 'tabla',
        cols: ['Usá Venta rápida cuando…', 'Usá Presupuesto cuando…'],
        filas: [
          ['El cliente se lleva algo hoy', 'Hay que mandarle una propuesta y esperar respuesta'],
          ['El producto está en el salón con stock', 'Es a medida, o hay que pedírselo al proveedor'],
          ['Paga todo ahora', 'Va a señar, o paga en varias veces'],
          ['No hace falta negociar nada', 'Puede haber idas y vueltas de precio o medidas'],
        ],
      },
      { t: 'aviso', tono: 'regla', texto: 'Venta rápida **solo trabaja con productos del catálogo que tengan stock**. Si no hay stock suficiente, el sistema no deja confirmar. Para vender algo a medida o que hay que encargar, el camino es un presupuesto.' },
    ],
  },
  {
    id: 'cliente',
    titulo: 'Paso 1 — Elegir el cliente',
    corto: 'El cliente',
    icono: UserPlus,
    bloques: [
      { t: 'p', texto: 'Arriba a la izquierda hay un buscador. Escribí **nombre, teléfono o DNI** y elegí de la lista.' },
      { t: 'subtitulo', texto: 'Si el cliente es nuevo' },
      { t: 'p', texto: 'Debajo del buscador hay un mini-formulario con tres campos: **Nombre**, **Apellido** y **Teléfono**. Con eso alcanza para vender; los datos que falten se completan después desde Clientes.' },
      { t: 'aviso', tono: 'ojo', texto: 'Si el teléfono que escribís ya existe en otro cliente, aparece un aviso de **"Ya existe"** con el nombre. Fijate antes de crear un duplicado: dos fichas del mismo cliente parten el historial en dos.' },
      { t: 'p', texto: 'Una vez elegido, el cliente queda fijo arriba y ya se puede cargar la venta.' },
    ],
  },
  {
    id: 'productos',
    titulo: 'Paso 2 — Cargar los productos',
    corto: 'Los productos',
    icono: PackageSearch,
    bloques: [
      { t: 'p', texto: 'La galería del medio muestra los productos del catálogo. Se puede filtrar escribiendo **nombre o código**, o eligiendo un **tipo de abertura** en el desplegable.' },
      { t: 'p', texto: 'Tocá un producto para sumarlo. Si lo tocás de nuevo, suma otra unidad.' },
      { t: 'subtitulo', texto: 'Ajustar lo cargado' },
      {
        t: 'lista',
        items: [
          '**Cantidad**: los botones **–** y **+** al lado del número.',
          '**Precio**: el precio sale del catálogo, pero se puede escribir otro a mano para esta venta. No cambia el precio del producto en el catálogo, solo el de esta venta.',
          'A la derecha de cada línea se ve el subtotal de ese ítem.',
        ],
      },
      { t: 'aviso', tono: 'ojo', texto: 'Si ponés más cantidad de la que hay, la línea avisa **"Sin stock suficiente (disp. N)"**. Podés seguir cargando otras cosas, pero el botón de confirmar no va a funcionar hasta que lo arregles.' },
    ],
  },
  {
    id: 'cobro',
    titulo: 'Paso 3 — Forma de pago y bonificación',
    corto: 'Cobro',
    icono: Wallet,
    bloques: [
      { t: 'p', texto: '**Forma de pago**: se elige del desplegable. Son las mismas formas que están cargadas en Configuración.' },
      { t: 'subtitulo', texto: 'Bonificación' },
      { t: 'p', texto: 'Hay botones de **5 %, 7 %, 10 % y 15 %**, y un campo **"Otro %"** para cualquier otro valor hasta 50. El botón **Quitar** la saca.' },
      { t: 'aviso', tono: 'regla', texto: 'La bonificación se calcula **solo sobre el subtotal de los productos**. El costo de envío nunca se bonifica.' },
      { t: 'p', texto: 'Abajo del todo se ve el resumen: **Subtotal**, **Bonificación** (si hay) y **Total**. Ese total es lo que se cobra.' },
    ],
  },
  {
    id: 'entrega',
    titulo: 'Paso 4 — Cómo se lleva la mercadería',
    corto: 'Entrega',
    icono: Truck,
    bloques: [
      { t: 'p', texto: 'Hay dos opciones, y cambian bastante lo que pasa después.' },
      { t: 'subtitulo', texto: 'Retira en local' },
      { t: 'p', texto: 'Aparece una tilde: **"Cliente retira ahora"**.' },
      {
        t: 'lista',
        items: [
          '**Tildada**: el cliente se lleva todo en el momento. El remito queda **entregado** y la operación **cerrada**. No queda nada pendiente.',
          '**Sin tildar**: la venta queda cobrada pero la mercadería todavía está en el local. El remito queda **emitido** y hay que marcarlo entregado desde Remitos cuando el cliente la pase a buscar.',
        ],
      },
      { t: 'subtitulo', texto: 'Envío a domicilio' },
      {
        t: 'lista',
        items: [
          '**Dirección de entrega**: dónde hay que llevarlo.',
          '**Medio de envío**: obligatorio, no deja confirmar sin elegirlo.',
          '**Costo de envío** (opcional): lo que se le cobra al cliente por el flete.',
        ],
      },
      { t: 'aviso', tono: 'regla', texto: 'Si hay envío a domicilio **no existe la opción de "retira ahora"**: la mercadería todavía tiene que salir. El remito queda emitido y se marca entregado cuando llegó.' },
      { t: 'aviso', tono: 'info', texto: 'El costo de envío genera un **recibo aparte**, con su propio número. Es a propósito: esa plata muchas veces va a un transportista de afuera y tiene que poder contabilizarse por separado de la venta.' },
    ],
  },
  {
    id: 'confirmar',
    titulo: 'Paso 5 — Confirmar la venta',
    corto: 'Confirmar',
    icono: FileCheck2,
    bloques: [
      { t: 'p', texto: 'El botón de abajo cierra la venta. Se activa cuando hay **cliente elegido** y **al menos un producto** cargado.' },
      { t: 'p', texto: 'En ese momento, y todo junto, el sistema:' },
      {
        t: 'lista',
        ordenada: true,
        items: [
          'Crea la **operación** ya aprobada (queda marcada como venta rápida).',
          'Emite el **recibo** por el total, con la bonificación aplicada.',
          'Emite un **segundo recibo** si cargaste costo de envío.',
          'Genera el **remito** y **descuenta el stock**.',
          'Si tildaste "retira ahora", marca el remito **entregado** y cierra la operación.',
        ],
      },
      { t: 'p', texto: 'Al terminar te muestra los números que se generaron: el de la operación, el del recibo y el del remito. Anotalos o imprimí el recibo desde Recibos.' },
      { t: 'aviso', tono: 'info', texto: 'Si un producto queda en **stock 0** después de la venta, el sistema lo saca solo de **"exhibido en salón"**. Es para que no quede ofrecido algo que ya no está.' },
    ],
  },
  {
    id: 'problemas',
    titulo: 'Cuando algo sale mal',
    corto: 'Problemas',
    icono: AlertTriangle,
    bloques: [
      {
        t: 'tabla',
        cols: ['Qué pasa', 'Por qué', 'Qué hacer'],
        filas: [
          ['El botón de confirmar está apagado', 'Falta el cliente o no hay ningún producto cargado', 'Completá lo que falte'],
          ['"Stock insuficiente"', 'Alguien vendió lo mismo mientras cargabas', 'Bajá la cantidad o sacá el producto'],
          ['"Elegí el medio de envío"', 'Pusiste envío a domicilio y no elegiste con qué', 'Elegilo en el desplegable'],
          ['"Ya existe" al cargar el teléfono', 'Ese teléfono está en otra ficha de cliente', 'Buscá al cliente que ya existe en vez de crear uno nuevo'],
        ],
      },
      { t: 'aviso', tono: 'ojo', texto: 'Si algo falla al confirmar, **no se crea nada a medias**: o sale todo (operación, recibo, remito y stock) o no sale nada. Podés corregir y volver a intentar sin miedo a que haya quedado un recibo suelto.' },
    ],
  },
  {
    id: 'deshacer',
    titulo: 'Si te equivocaste después de confirmar',
    corto: 'Deshacer',
    icono: Undo2,
    bloques: [
      { t: 'p', texto: 'La venta rápida no tiene un botón de "deshacer" porque ya generó recibo, remito y movimiento de stock. Se corrige desde donde corresponde:' },
      {
        t: 'tabla',
        cols: ['Qué te equivocaste', 'Dónde se arregla'],
        filas: [
          ['El importe o la forma de pago', 'Recibos → anular el recibo y emitir uno nuevo'],
          ['El cliente no se llevó la mercadería', 'Remitos → cancelar el remito (devuelve el stock)'],
          ['Cargaste de más o de menos', 'Existencias → ajuste de stock, y corregir el recibo'],
          ['El cliente es el equivocado', 'Anular recibo y remito, y rehacer la venta'],
        ],
      },
      { t: 'aviso', tono: 'ojo', texto: 'Cancelar un remito devuelve el stock, pero **no anula el recibo**. Son dos cosas distintas y hay que hacer las dos.' },
    ],
  },
];
