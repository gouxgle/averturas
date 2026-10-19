import {
  Undo2, Package, Calculator, Wallet, Banknote, ArrowLeftRight, FileWarning, Ban, BarChart3, HelpCircle, Workflow, ListChecks,
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
      { t: 'aviso', tono: 'info', texto: 'Las devoluciones se registran desde el **detalle del remito** (botón "Registrar devolución"), desde el **presupuesto entregado**, desde la **ficha del cliente** (menú ⋮ → "Registrar devolución") o desde la sección **Devoluciones** → "Nueva devolución", donde se busca el remito por número, cliente, presupuesto o producto.' },
    ],
  },
  {
    id: 'ciclo',
    titulo: 'Ciclo de vida: de la devolución a la plata',
    corto: 'Ciclo de vida',
    icono: Workflow,
    bloques: [
      { t: 'p', texto: 'Una devolución recorre siempre el mismo camino. Lo que cambia es **qué se hace con la plata** al final.' },
      { t: 'flujo', nodos: ['Venta entregada', 'Devolución (DEV-)', 'Stock y deuda se ajustan', 'Plata: saldo a favor, dinero o cambio', 'Se usa o se devuelve'] },
      { t: 'subtitulo', texto: '1 — La devolución (DEV-…)' },
      {
        t: 'tabla',
        cols: ['Estado', 'Qué significa'],
        filas: [
          ['**Emitida**', 'Está vigente: el stock volvió (o quedó como pérdida), la deuda bajó y la plata quedó a favor, se devolvió o se usó en un cambio'],
          ['**Anulada**', 'La deshizo un administrador: se revierte todo lo que había hecho. Lo devuelto se puede volver a devolver'],
        ],
      },
      { t: 'p', texto: 'Al confirmar, en **un solo paso** (todo o nada): se registra el DEV-, vuelve la mercadería al stock, baja la deuda de la venta, se acredita el saldo a favor o se saca el dinero de caja, y si hubo cambio se entrega el producto nuevo. Si algo falla, no se registra nada.' },
      { t: 'subtitulo', texto: '2 — Qué se hace con la plata que sobra' },
      {
        t: 'tabla',
        cols: ['Camino', 'Cómo sigue', 'Cómo termina'],
        filas: [
          ['**Saldo a favor**', 'Queda en la ficha del cliente', 'Se **usa** como medio de pago en un recibo, o se **devuelve en dinero** más adelante'],
          ['**Devolver dinero**', 'Sale de caja con un comprobante REI-', 'Fin. Solo un administrador puede anularlo (el dinero vuelve a quedar a favor)'],
          ['**Cambio**', 'La plata paga el producto nuevo, que se entrega en el momento', 'Si cuesta más se cobra la diferencia; si cuesta menos, lo que sobra queda a favor o se devuelve'],
          ['**Repartir**', 'Una parte en dinero y otra a favor', 'Cada parte sigue su camino'],
        ],
      },
      { t: 'subtitulo', texto: '3 — Vida del saldo a favor' },
      { t: 'lista', ordenada: true, items: [
        '**Se crea** cuando una devolución deja plata sin usar (o un cambio sale más barato).',
        '**Se ve** en la ficha del cliente, en el estado de cuenta y en Nuevo recibo.',
        '**Se gasta** eligiendo «Saldo a favor» como forma de pago (solo o combinado con otro medio). No es caja: los informes lo muestran aparte.',
        '**Se devuelve en dinero** desde el Estado de cuenta ("Devolver en dinero"): genera un REI-.',
        '**Vuelve** si se anula el recibo que lo gastó, el reintegro que lo sacó o la devolución que lo creó (esta última solo si todavía no se usó).',
      ] },
      { t: 'subtitulo', texto: '4 — Vida del dinero devuelto (REI-)' },
      {
        t: 'tabla',
        cols: ['Estado', 'Qué significa'],
        filas: [
          ['**Emitido**', 'El dinero salió de caja y el cliente firma el comprobante. Entra en la **caja neta** de Reportes'],
          ['**Anulado**', 'Lo anuló un administrador: el dinero vuelve a quedar como saldo a favor del cliente'],
        ],
      },
      { t: 'subtitulo', texto: '5 — Qué avisa el sistema' },
      { t: 'lista', items: [
        'Cada **reintegro** de dinero le llega al **administrador** (campanita y cartel), lo haga quien lo haga.',
        'Una devolución registrada por un **vendedor** también le avisa al administrador.',
        'Si la venta estaba facturada, la devolución queda con **"Falta nota de crédito"** hasta que se emita (nunca se emite sola).',
        'Todo queda en **Actividad** con quién lo hizo.',
      ] },
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
        'Cada reintegro tiene su **comprobante imprimible** (botón "Imprimir" en Dinero devuelto, o al terminar la devolución): el cliente firma que recibió el dinero.',
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
      { t: 'p', texto: 'Si una devolución se cargó por error, **un administrador** puede anularla desde su detalle (botón "Anular devolución", con el motivo). Se revierte el stock que volvió, se quita el saldo a favor que dejó y la deuda de la venta vuelve a ser la de antes; si la devolución había cerrado compromisos de pago porque la venta quedaba saldada, **se reabren**. Lo anulado se puede volver a devolver.' },
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
    id: 'ejemplos',
    titulo: 'Casos completos paso a paso',
    corto: 'Casos completos',
    icono: ListChecks,
    bloques: [
      { t: 'subtitulo', texto: 'Caso 1 — Devuelve y se queda con saldo a favor' },
      { t: 'p', texto: 'Compra de $100.000, pagó $60.000 y devuelve una ventana de $50.000 en buen estado.' },
      { t: 'lista', ordenada: true, items: [
        'Remito → **Registrar devolución** → la ventana **vuelve a stock**.',
        'Resultado: baja la deuda en **$40.000** (lo que debía) y le sobran **$10.000** de plata que ya había puesto.',
        'Se elige **Dejar a favor**: el cliente queda con **$10.000 a favor**. La compra queda saldada.',
        'En una compra futura, en Nuevo recibo se elige «Saldo a favor» y se descuentan esos $10.000.',
      ] },
      { t: 'subtitulo', texto: 'Caso 2 — Devuelve y se le reintegra el dinero' },
      { t: 'p', texto: 'Mismo caso, pero el cliente quiere el dinero.' },
      { t: 'lista', ordenada: true, items: [
        'En el paso 3 se elige **Devolver dinero** y la forma (efectivo o transferencia).',
        'Se emite el **REI-…** y el sistema avisa al administrador. Se imprime el comprobante y el cliente **firma que lo recibió**.',
        'En **Reportes** el dinero devuelto resta de la caja neta.',
      ] },
      { t: 'subtitulo', texto: 'Caso 3 — Lo devuelto está roto' },
      { t: 'lista', ordenada: true, items: [
        'Se marca el ítem como **No reingresa** y se carga el motivo (falla de fábrica, rota…).',
        'El stock **no** se mueve: queda registrado como **pérdida** al costo y aparece en Reportes.',
        'La plata se trata igual que en los casos anteriores.',
      ] },
      { t: 'subtitulo', texto: 'Caso 4 — Cambio por otro producto' },
      { t: 'p', texto: 'Devuelve una ventana de $50.000 (ya la había pagado) y se lleva una de $65.000.' },
      { t: 'lista', ordenada: true, items: [
        'Paso 2: **Cambiar por otro producto** y se elige el nuevo (con stock).',
        'La plata de la devolución ($50.000) paga la mayor parte del producto nuevo.',
        'El cliente paga la **diferencia de $15.000** con el medio que elija, o queda para cobrar después.',
        'El producto nuevo sale con su remito, en el momento, y descuenta stock.',
      ] },
      { t: 'subtitulo', texto: 'Caso 5 — Compra con bonificación' },
      { t: 'p', texto: 'Compra de $100.000 con $10.000 de bonificación del presupuesto, pagó $90.000 y devuelve una ventana de $50.000.' },
      { t: 'lista', items: [
        'La ventana vale **$45.000** (se le descuenta la parte proporcional de la bonificación: no se devuelve plata que no puso).',
        'Como ya estaba saldada, los **$45.000** quedan a favor o se devuelven en dinero.',
      ] },
      { t: 'subtitulo', texto: 'Caso 6 — Se cargó mal' },
      { t: 'lista', ordenada: true, items: [
        'Un **administrador** abre la devolución → **Anular devolución** con el motivo.',
        'Si el sistema se niega, dice qué hay que deshacer primero (el recibo que gastó el saldo, el reintegro, la entrega del cambio…).',
        'Al anular, el stock y la deuda vuelven a lo que eran y los compromisos de pago que se habían cerrado se **reabren**.',
      ] },
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
