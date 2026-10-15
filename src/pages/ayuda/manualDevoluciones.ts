import {
  Undo2, Package, Calculator, Wallet, Banknote, ArrowLeftRight, FileWarning, Ban, BarChart3, HelpCircle,
} from 'lucide-react';
import type { SeccionManual } from './tipos';

/** Manual de Devoluciones y cambios. Ver `tipos.ts` para el formato de los bloques. */
export const MANUAL_DEVOLUCIONES: SeccionManual[] = [
  {
    id: 'para-que',
    titulo: 'Para qué sirve y qué cubre',
    corto: 'Para qué sirve',
    icono: Undo2,
    bloques: [
      { t: 'p', texto: 'Cuando un cliente trae de vuelta mercadería que ya le entregaste, en vez de cancelar el remito entero se registra una **devolución**: se elige **qué ítems** vuelven y **cuántas unidades**, y el sistema se ocupa del stock y de la plata.' },
      { t: 'p', texto: 'Una devolución **no modifica** el remito, el recibo ni el presupuesto originales: queda como un comprobante nuevo (**DEV-…**) y el historial se conserva completo.' },
      {
        t: 'tabla',
        cols: ['Si el cliente quiere…', 'Qué se hace'],
        filas: [
          ['Que le devuelvas la plata', 'Devolución y, de lo que ya había pagado, **devolver dinero**'],
          ['Cambiarlo por otro producto', 'Devolución con **cambio**: el producto nuevo se entrega en el momento'],
          ['Dejarlo para una compra futura', 'Devolución y **saldo a favor** (se descuenta en un próximo recibo)'],
        ],
      },
      { t: 'aviso', tono: 'info', texto: 'Las devoluciones se registran desde el **detalle del remito** (botón "Registrar devolución"), desde el **presupuesto entregado** o desde la sección **Devoluciones** → "Nueva devolución", donde se elige el remito.' },
    ],
  },
  {
    id: 'registrar',
    titulo: 'Registrar una devolución',
    corto: 'Registrar',
    icono: Package,
    bloques: [
      { t: 'flujo', nodos: ['Qué vuelve', '¿Se lleva otro producto?', 'Resultado', 'Confirmar'] },
      { t: 'subtitulo', texto: 'Paso 1 — Qué vuelve' },
      { t: 'lista', items: [
        'Con **+** y **−** se elige cuántas unidades de cada ítem vuelven. Solo se puede devolver lo que se entregó y todavía no se devolvió. "Devolver todo" marca todo de una.',
        '**Vuelve a stock**: la mercadería está bien y queda disponible para vender. Podés indicar si está nueva, buena o con detalles.',
        '**No reingresa**: está fallada o rota. No suma al stock, queda registrada como **pérdida** y hay que decir el motivo (falla de fábrica, rota, mal estado…).',
      ] },
      { t: 'subtitulo', texto: 'Paso 2 — ¿Se lleva otro producto?' },
      { t: 'p', texto: 'Si el cliente solo devuelve, se elige "Solo devolución". Si cambia por otro, se elige "Cambiar por otro producto" y se busca en el catálogo (solo aparecen los que tienen stock). Ver la sección **Cambio de producto**.' },
      { t: 'subtitulo', texto: 'Paso 3 — Resultado' },
      { t: 'p', texto: 'Antes de confirmar se ve exactamente cuánto vale lo devuelto, cuánto baja la deuda y cuánto queda a favor del cliente. Se pide el **motivo** de la devolución y se confirma. Si algo falla (por ejemplo no hay stock del producto nuevo), no se registra nada.' },
      { t: 'aviso', tono: 'ojo', texto: 'El botón **Registrar** se aprieta una sola vez. Si la conexión se corta, revisá en la sección Devoluciones si quedó registrada antes de volver a intentarlo.' },
    ],
  },
  {
    id: 'cuanto-vale',
    titulo: 'Cuánto vale lo que se devuelve',
    corto: 'Cuánto vale',
    icono: Calculator,
    bloques: [
      { t: 'p', texto: 'Cada unidad vale lo que costó **menos la bonificación proporcional** que tuvo esa compra: no se devuelve plata que el cliente nunca puso. La **instalación y el envío no se devuelven**, son servicios ya prestados.' },
      { t: 'p', texto: 'Después, el valor se reparte en este orden:' },
      { t: 'lista', ordenada: true, items: [
        '**Primero baja lo que el cliente todavía debía** de esa compra.',
        'Lo que sobra es **plata que el cliente ya había puesto**: queda a su favor o se le devuelve en dinero.',
      ] },
      {
        t: 'tabla',
        cols: ['Compra', 'Pagó', 'Devuelve', 'Baja la deuda', 'Le sobra'],
        filas: [
          ['$100.000', '$60.000', '1 ventana de $50.000', '$40.000', '$10.000'],
          ['$100.000 con $10.000 de bonificación', '$90.000', '1 ventana de $50.000', '$0', '$45.000'],
          ['$100.000', '$20.000', 'Un ítem de $30.000', '$30.000', '$0 (sigue debiendo $50.000)'],
        ],
      },
      { t: 'aviso', tono: 'regla', texto: 'Lo que se devuelve en dinero o queda a favor **nunca supera lo que el cliente efectivamente pagó** por esa compra.' },
    ],
  },
  {
    id: 'saldo-favor',
    titulo: 'Saldo a favor del cliente',
    corto: 'Saldo a favor',
    icono: Wallet,
    bloques: [
      { t: 'p', texto: 'Es la plata que el cliente ya pagó y quedó sin usar después de una devolución. Se ve en su **ficha** (etiqueta violeta "A favor"), en su **estado de cuenta** y al crear un recibo.' },
      { t: 'subtitulo', texto: 'Usarlo para pagar' },
      { t: 'lista', ordenada: true, items: [
        'En **Nuevo recibo**, al elegir el cliente aparece un aviso con lo que tiene a favor y el botón **Usar**.',
        'Se elige **«Saldo a favor»** como forma de pago. Si no alcanza, "Dividir en varios medios de pago" y se completa con otro.',
      ] },
      { t: 'aviso', tono: 'regla', texto: 'El saldo a favor **no es dinero que entra a caja**: los informes lo muestran aparte. Un recibo pagado con saldo a favor no se edita; si hay un error, se anula (el saldo vuelve al cliente) y se hace otro.' },
    ],
  },
  {
    id: 'devolver-dinero',
    titulo: 'Devolver dinero',
    corto: 'Devolver dinero',
    icono: Banknote,
    bloques: [
      { t: 'p', texto: 'De lo que le sobra al cliente, en el paso 3 se puede elegir **Dejar a favor**, **Devolver dinero** o **Repartir** (una parte en dinero y otra a favor). El dinero sale como **Efectivo**, **Transferencia** u **Otro** y genera un comprobante **REI-…**.' },
      { t: 'p', texto: 'Para devolver en dinero un saldo a favor que el cliente **ya tenía**: **Estado de cuenta del cliente → "Devolver en dinero"**.' },
      { t: 'lista', items: [
        'Lo puede hacer **un vendedor o un administrador**.',
        'Cada vez, **al administrador le llega un aviso** (campanita y cartel) con quién devolvió cuánto y cómo.',
        'Todo queda en **Actividad**. La lista está en **Devoluciones → Dinero devuelto**.',
        'Solo un **administrador** puede **anular** un reintegro: el dinero vuelve a quedar a favor del cliente.',
      ] },
      { t: 'aviso', tono: 'info', texto: 'En **Reportes** se ve el dinero devuelto y la **caja neta** (lo cobrado menos lo devuelto en dinero).' },
    ],
  },
  {
    id: 'cambio',
    titulo: 'Cambio de producto',
    corto: 'Cambio',
    icono: ArrowLeftRight,
    bloques: [
      { t: 'p', texto: 'En un cambio, la devolución y la venta del producto nuevo se registran **juntas**: el producto nuevo se entrega en el momento, con su remito, y sale del stock. Queda como una operación aparte enlazada a la devolución.' },
      { t: 'p', texto: 'El producto nuevo se paga **primero con la plata que sobra de la devolución**. Después:' },
      {
        t: 'tabla',
        cols: ['Si el producto nuevo…', 'Qué pasa'],
        filas: [
          ['Cuesta más', 'El cliente paga la **diferencia** con el medio que elija (contado, tarjeta, transferencia) o queda **para cobrar después**'],
          ['Cuesta menos', 'Lo que **sobra** queda a favor del cliente o se le devuelve en dinero'],
          ['Cuesta igual', 'No hay nada que cobrar ni devolver'],
        ],
      },
      { t: 'aviso', tono: 'ojo', texto: 'Solo se puede cambiar por productos **con stock**. El precio sugerido es el del catálogo (o el de la promoción vigente) y se puede editar. Si el cambio estuvo mal, no se anula: se registra la devolución del producto nuevo.' },
    ],
  },
  {
    id: 'a-medida',
    titulo: 'Productos a medida y servicios',
    corto: 'A medida y servicios',
    icono: Package,
    bloques: [
      { t: 'lista', items: [
        'Un producto **a medida** (fabricado para la obra) no admite devolución según los términos de la proforma. **Solo un administrador** puede registrarla, con un aviso, y **nunca vuelve a stock** porque no hay stock de a medida.',
        'Los **servicios** (instalación, flete) ya se prestaron: **no se devuelven**.',
      ] },
    ],
  },
  {
    id: 'facturacion',
    titulo: 'Si la venta estaba facturada',
    corto: 'Facturación',
    icono: FileWarning,
    bloques: [
      { t: 'p', texto: 'Si entre lo devuelto hay ítems que **ya estaban facturados**, la devolución se registra igual pero queda marcada **"Falta nota de crédito"**. El sistema **nunca la emite solo**: en el detalle de la devolución aparece un botón por cada factura de esa venta que abre la nota de crédito en Facturación.' },
      { t: 'aviso', tono: 'ojo', texto: 'Acreditá **solo los ítems devueltos** (el detalle de la devolución los lista). Cuando se emite una nota de crédito sobre esa venta, el aviso desaparece.' },
      { t: 'aviso', tono: 'info', texto: 'Mientras la facturación electrónica esté apagada o la venta no tenga facturas, este aviso no aparece.' },
    ],
  },
  {
    id: 'anular',
    titulo: 'Anular una devolución',
    corto: 'Anular',
    icono: Ban,
    bloques: [
      { t: 'p', texto: 'Si una devolución se cargó por error, **un administrador** puede anularla desde su detalle (botón "Anular devolución", con el motivo). Se revierte el stock que volvió, se quita el saldo a favor que dejó y la deuda de la venta vuelve a ser la de antes. Lo anulado se puede volver a devolver.' },
      { t: 'p', texto: 'No se puede anular, y el sistema dice por qué, cuando lo que generó ya se usó:' },
      {
        t: 'tabla',
        cols: ['Si…', 'Primero hay que…'],
        filas: [
          ['El saldo a favor ya se usó en un recibo', 'Anular ese recibo'],
          ['Salió dinero de caja por esa devolución', 'Anular el reintegro (en Dinero devuelto)'],
          ['Fue un cambio y el producto nuevo ya se entregó', 'Registrar la devolución del producto nuevo'],
          ['El cliente ya retiró parte de su saldo a favor', 'Resolver ese retiro (anular el reintegro)'],
          ['Lo que volvió a stock ya se vendió', 'Corregir el stock (Existencias)'],
        ],
      },
    ],
  },
  {
    id: 'informes',
    titulo: 'Dónde se ve en los informes',
    corto: 'Informes',
    icono: BarChart3,
    bloques: [
      { t: 'lista', items: [
        '**Reportes**: devoluciones del período, **ventas netas** (lo vendido menos lo devuelto), **pérdidas** por mercadería que no reingresó (al costo), dinero devuelto y caja neta.',
        '**Dashboard**: las "Ventas del mes" ya vienen netas de devoluciones.',
        '**Estado de cuenta**: la devolución figura como un abono que baja el saldo, y el saldo a favor aparece aparte.',
        '**Existencias**: la mercadería que vuelve figura como "Devol. de cliente".',
        '**Actividad**: cada devolución, cambio, reintegro y anulación queda registrado con quién lo hizo.',
      ] },
      { t: 'aviso', tono: 'info', texto: 'Cuando una devolución la registra un **vendedor**, al administrador le llega un aviso (campanita y cartel).' },
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
          ['"No hay mercadería entregada para devolver"', 'El remito tiene que estar **emitido o entregado**. Un borrador o cancelado no tiene nada que devolver'],
          ['"Ya se devolvió todo lo entregado"', 'Esas unidades ya se devolvieron. Si se anuló la devolución, vuelven a estar disponibles'],
          ['Falta el precio de un ítem', 'El ítem no figura ni en el remito ni en el presupuesto: cargá el precio a mano en el paso 1'],
          ['No aparece el producto nuevo en el cambio', 'Solo se ofrecen productos activos **con stock**'],
          ['No me deja devolver un ítem', 'Si es **a medida** lo hace un administrador; si es un **servicio**, no se devuelve'],
          ['El cliente tiene saldo a favor y no aparece en el recibo', 'Elegí primero el cliente; el aviso aparece solo si tiene saldo'],
        ],
      },
    ],
  },
];
