import {
  Scale, Signpost, LayoutDashboard, CalendarCheck, RefreshCw, TrendingUp, Wand2, Sigma,
  FileSpreadsheet, Tags, History, SlidersHorizontal, BookOpen, CircleHelp,
} from 'lucide-react';
import type { SeccionManual } from './tipos';

/**
 * Manual de la Revisión integral de precios (Productos → /productos/precios).
 * Reescrito el 2026-10-06 para el operador: primero "qué situación tengo → qué pestaña uso",
 * después una guía paso a paso por pestaña con ejemplos, y las palabras técnicas al final.
 * Ver `tipos.ts` para el formato de los bloques. Si cambia la pantalla o el criterio de
 * `server/src/lib/precios.ts`, actualizar también este manual y el tema 'precios' de HelpDrawer.
 */
export const MANUAL_PRECIOS: SeccionManual[] = [
  // ── 1 ──────────────────────────────────────────────────────────
  {
    id: 'para-que',
    titulo: 'Para qué sirve (en dos minutos)',
    corto: 'Para qué sirve',
    icono: Scale,
    bloques: [
      { t: 'p', texto: 'Los costos cambian todo el tiempo: el proveedor manda lista nueva, sube el dólar, la última compra salió más cara. Si el precio de venta no acompaña, **se vende perdiendo plata sin darse cuenta**.' },
      { t: 'p', texto: 'Esta pantalla revisa **todos los productos de una vez** y te dice qué hacer con cada uno. Vos solo mirás y confirmás.' },
      { t: 'p', texto: 'Para cada producto, el sistema llega a una de estas respuestas:' },
      {
        t: 'tabla',
        cols: ['Respuesta', 'Qué quiere decir', 'Qué hacés vos'],
        filas: [
          ['**Está bien, renovalo**', 'Nada cambió. El precio sigue sirviendo.', 'Un clic: se renueva la fecha y el precio queda igual.'],
          ['**Conviene subirlo**', 'Algo subió (proveedor, compra, dólar) o gana menos de lo que debería.', 'Mirás cuánto propone y lo aplicás.'],
          ['**No coincide con la fórmula**', 'Producto estándar cuyo precio no da con la fórmula del negocio.', 'Elegís a cuáles llevar a la fórmula.'],
          ['**Parece mal cargado**', 'El costo o el precio no tienen sentido (por ejemplo, costo $ 1).', 'Corregís el producto en su ficha.'],
        ],
      },
      { t: 'aviso', tono: 'regla', texto: '**Nada cambia solo.** Todo lo que ves son sugerencias: ningún precio se modifica hasta que tocás "Aplicar" o "Renovar". Y el sistema **nunca baja un precio** por su cuenta.' },
      { t: 'aviso', tono: 'info', texto: 'Las proformas que ya se mandaron a los clientes **no cambian nunca**: guardan el precio con el que se enviaron. El precio nuevo se usa en las proformas que hagas desde ese momento.' },
    ],
  },

  // ── 2 ──────────────────────────────────────────────────────────
  {
    id: 'cual-uso',
    titulo: '¿Qué pestaña uso? Según lo que te pasa',
    corto: '¿Qué pestaña uso?',
    icono: Signpost,
    bloques: [
      { t: 'p', texto: 'La pantalla tiene **cuatro pestañas**. Cada una resuelve una situación distinta. Buscá la tuya:' },
      {
        t: 'tabla',
        cols: ['Si te pasa esto…', 'Usá esta pestaña'],
        filas: [
          ['Querés hacer la **revisión de rutina** y dejar todo al día.', '**Renovar validez** y después **Actualizar precios**'],
          ['Los semáforos están en **rojo** pero sabés que los precios están bien.', '**Renovar validez**'],
          ['Subió el **dólar** o la **última compra** salió más cara.', '**Actualizar precios**'],
          ['Querés hacer un **aumento general** (por ejemplo "todo +5 %").', '**Actualizar precios** → "Ver también los que no necesitan cambio"'],
          ['Querés que los productos **estándar** tengan el precio de la **fórmula** (÷ 0,60 + 15 % + 12 %, terminado en 900).', '**Por fórmula**'],
          ['Un **proveedor mandó su lista** de precios nueva (Excel) o avisó "aumentamos X %".', '**Lista del proveedor**'],
        ],
      },
      { t: 'flujo', nodos: ['Renovar lo que está bien', 'Subir lo que subió', 'Ajustar a la fórmula', 'Cargar listas de proveedores'] },
      { t: 'p', texto: 'No hace falta usar las cuatro siempre. Lo más común es: una vez por semana **Renovar** + **Actualizar**, y **Lista del proveedor** cada vez que llega una lista.' },
    ],
  },

  // ── 3 ──────────────────────────────────────────────────────────
  {
    id: 'donde',
    titulo: 'Cómo entrar y qué hay en la pantalla',
    corto: 'La pantalla',
    icono: LayoutDashboard,
    bloques: [
      { t: 'p', texto: 'Entrá a **Productos** y tocá el botón **"Revisión integral de precios"** (arriba a la derecha). También se llega desde **Proveedores → Precios → "Actualizar precios"**, que abre directo la pestaña de ese proveedor.' },
      { t: 'subtitulo', texto: 'La franja oscura de arriba' },
      {
        t: 'tabla',
        cols: ['Dato', 'Qué te dice'],
        filas: [
          ['**Dólar blue**', 'La cotización de hoy y cuánto se movió en 30 días. Se carga sola todos los días.'],
          ['**Inflación**', 'La del último mes y la de los últimos 3 meses (INDEC). Solo para tener de referencia.'],
          ['**Para actualizar**', 'Cuántos productos conviene subir.'],
          ['**Para renovar**', 'Cuántos están bien y solo hay que renovar la fecha.'],
          ['**Al día**', 'Cuántos se revisaron hace poco y no necesitan nada.'],
          ['**Sin costo**', 'Productos sin costo cargado (el sistema no los puede analizar). Solo aparece si hay alguno.'],
          ['**Recargo prom.**', 'En promedio, cuánto se le suma al costo para llegar al precio.'],
        ],
      },
      { t: 'subtitulo', texto: 'Las pestañas' },
      { t: 'p', texto: '**Renovar validez · Actualizar precios · Por fórmula · Lista del proveedor.** El número al lado de cada una es cuántos productos tiene para mirar.' },
      { t: 'subtitulo', texto: 'El semáforo de la fecha' },
      { t: 'p', texto: 'Cada producto tiene una **fecha de validez**: el último día en que alguien revisó su precio. El color dice cuánto hace:' },
      {
        t: 'tabla',
        cols: ['Color', 'Qué significa'],
        filas: [
          ['**Verde**', 'Revisado hace 7 días o menos. Está al día.'],
          ['**Amarillo**', 'Revisado hace 8 a 10 días. Mirarlo pronto.'],
          ['**Rojo**', 'Más de 10 días sin revisar. Renovarlo o actualizarlo.'],
        ],
      },
    ],
  },

  // ── 4 ──────────────────────────────────────────────────────────
  {
    id: 'rutina',
    titulo: 'La rutina de cada semana (10 minutos)',
    corto: 'Rutina semanal',
    icono: CalendarCheck,
    bloques: [
      { t: 'p', texto: 'Si solo vas a aprender una cosa de este manual, que sea esta:' },
      {
        t: 'lista',
        ordenada: true,
        items: [
          'Entrá a **Productos → Revisión integral de precios**.',
          'Pestaña **Renovar validez**: los productos ya vienen marcados. Tocá **"Renovar validez (N)"**. Listo, quedan en verde.',
          'Pestaña **Actualizar precios**: mirá la lista. Marcá los que quieras subir y tocá **"Actualizar precios (N)…"**.',
          'En la ventana que se abre dejá el criterio **"Sugerido"**, redondeo **a $ 100** o **terminado en 900**, y tocá **"Ver vista previa"**.',
          'Revisá los precios nuevos (podés corregir cualquiera a mano) y tocá **"Aplicar a N"**.',
          'Una vez al mes, o cuando cambie algo grande, pasá por la pestaña **Por fórmula** para ver si los estándar siguen en la fórmula.',
        ],
      },
      { t: 'aviso', tono: 'info', texto: 'Cuando un proveedor manda lista nueva, no esperes a la rutina: cargala ese mismo día en **Lista del proveedor**.' },
    ],
  },

  // ── 5 ──────────────────────────────────────────────────────────
  {
    id: 'renovar',
    titulo: 'Pestaña "Renovar validez": lo que está bien',
    corto: 'Renovar validez',
    icono: RefreshCw,
    bloques: [
      { t: 'p', texto: 'Acá aparecen los productos que **no tuvieron cambios**: ni el proveedor, ni la última compra, ni el dólar se movieron más de 3 %, y el producto gana lo que tiene que ganar. **El precio sigue sirviendo**; solo hay que renovarle la fecha para que el semáforo vuelva a verde.' },
      { t: 'subtitulo', texto: 'Qué muestra cada fila' },
      {
        t: 'lista',
        items: [
          '**El producto** (código, familia, línea y proveedor).',
          '**El costo**, no el precio de venta: así lo comparás con lo que cobra el proveedor. Si la lista del proveedor o la última compra dicen otro número, aparece debajo en chiquito.',
          '**"Renovado dd/mm/aa"** con el color del semáforo, y el precio de venta.',
          '**Por qué está acá**: normalmente "Sin cambios de costo ni de dólar".',
        ],
      },
      { t: 'subtitulo', texto: 'Paso a paso' },
      {
        t: 'lista',
        ordenada: true,
        items: [
          'Los productos **ya vienen marcados**. Si querés, filtrá por familia, proveedor o línea.',
          'Desmarcá los que **no** quieras renovar tocando su fila.',
          'Tocá **"Renovar validez (N)"** abajo a la derecha.',
        ],
      },
      { t: 'p', texto: 'Resultado: pasan a verde, **el precio no cambia**, y en el historial de cada uno queda que se renovó, quién lo hizo y el dólar de ese día.' },
      { t: 'subtitulo', texto: 'Renovar otros productos a mano o una familia entera' },
      { t: 'p', texto: 'Si querés renovar productos que el sistema no sugirió (por ejemplo, confirmaste los precios por teléfono con el proveedor), tocá **"Elegir a mano o por familia"**:' },
      {
        t: 'tabla',
        cols: ['Opción', 'Cómo se usa'],
        filas: [
          ['**Por familia**', 'Marcás familias completas (Ventanas, Puertas…). Al lado dice cuántos tiene vencidos.'],
          ['**Elegir productos**', 'Buscás y marcás de a uno, o "Marcar los N de la lista". Sirve también para los productos **sin familia** (filtro "Sin familia").'],
        ],
      },
    ],
  },

  // ── 6 ──────────────────────────────────────────────────────────
  {
    id: 'actualizar',
    titulo: 'Pestaña "Actualizar precios": lo que conviene subir',
    corto: 'Actualizar precios',
    icono: TrendingUp,
    bloques: [
      { t: 'p', texto: 'Acá aparecen los productos que **conviene subir**, con cuánto y por qué. El sistema mira cuatro cosas de cada producto:' },
      {
        t: 'tabla',
        cols: ['Mira…', 'Pregunta que se hace'],
        filas: [
          ['**La lista del proveedor**', '¿El proveedor cobra hoy más de lo que tengo cargado como costo?'],
          ['**La última compra**', '¿La última vez que lo compré lo pagué más caro?'],
          ['**El dólar blue**', '¿Cuánto subió el dólar desde la última vez que revisé este precio?'],
          ['**Lo que gana**', '¿Le estoy sumando al costo menos de lo que debería?'],
          ['**La fórmula** (solo estándar)', '¿El precio quedó por debajo de la fórmula del negocio?'],
        ],
      },
      { t: 'subtitulo', texto: 'Cómo calcula el precio que propone — con un ejemplo' },
      {
        t: 'tabla',
        cols: ['', 'Ejemplo'],
        filas: [
          ['Producto hoy', 'Costo **$ 100.000**, precio **$ 130.000** (le suma 30 % al costo)'],
          ['El proveedor subió 12 %', 'Costo nuevo $ 112.000. Sumándole el mismo 30 %: **$ 145.600**'],
          ['El dólar subió 8 %', '$ 130.000 + 8 % = $ 140.400'],
          ['Lo que propone', 'El **mayor** de los dos: **$ 145.600 (+12 %)**'],
        ],
      },
      { t: 'p', texto: 'Se queda con el mayor y **no los suma**: si el proveedor subió justamente porque subió el dólar, sumarlos sería cobrar el mismo aumento dos veces.' },
      { t: 'subtitulo', texto: 'Cómo leer cada fila' },
      {
        t: 'tabla',
        cols: ['Parte', 'Qué dice'],
        filas: [
          ['**Costo**', 'El costo cargado, y debajo el de la lista o la última compra si son distintos.'],
          ['**Recargo**', 'Cuánto se le suma hoy al costo. En **rojo con triángulo** si es muy distinto al resto de su familia (posible error de carga).'],
          ['**$ actual → $ propuesto**', 'El precio de hoy, el que propone y el % de aumento.'],
          ['**Etiquetas de colores**', 'El porqué: "Lista del proveedor +12 %", "Dólar +8 %", "Debajo de la fórmula (−5 %)"… (ver "Qué significa cada etiqueta").'],
          ['**Datos de abajo**', 'Fecha de la última revisión, vendidos en 90 días, proformas abiertas con ese producto, unidades en el salón.'],
          ['**Historial**', 'Despliega todos los cambios de precio del producto.'],
        ],
      },
      { t: 'subtitulo', texto: 'Herramientas para decidir' },
      {
        t: 'lista',
        items: [
          '**Agrupar por** familia, línea, proveedor o "a medida / por unidad": ves de un vistazo dónde subió más. Tocando el nombre del grupo marcás todos sus productos.',
          '**Ordenar por prioridad**: primero lo que más pesa (aumento grande + se vende mucho + precio viejo). También por mayor aumento, más vendidos, recargo más bajo o precio más viejo.',
          '**"Ver también los que no necesitan cambio"**: suma todos los productos, para un aumento general.',
        ],
      },
      { t: 'subtitulo', texto: 'Paso a paso' },
      {
        t: 'lista',
        ordenada: true,
        items: [
          'Marcá los productos (casilla de la izquierda, o el grupo entero).',
          'Tocá **"Actualizar precios (N)…"** abajo a la derecha.',
          'Se abre el **asistente**: elegís cómo calcular, revisás y aplicás (ver la sección siguiente).',
        ],
      },
      { t: 'aviso', tono: 'ojo', texto: 'Antes de subir un producto con **"recargo muy distinto al de su familia"** o **"posible error de carga"**, abrí su ficha: casi siempre es un costo mal escrito, y subirlo así empeora el error.' },
    ],
  },

  // ── 7 ──────────────────────────────────────────────────────────
  {
    id: 'asistente',
    titulo: 'La ventana para aplicar el aumento',
    corto: 'Aplicar el aumento',
    icono: Wand2,
    bloques: [
      { t: 'p', texto: 'Tiene **dos pasos**: elegir cómo calcular el precio nuevo, y ver el resultado antes de guardar.' },
      { t: 'subtitulo', texto: 'Paso 1 — ¿Cómo calculo el precio nuevo?' },
      {
        t: 'tabla',
        cols: ['Opción', 'Qué hace', 'Usala cuando…'],
        filas: [
          ['**Sugerido**', 'Cada producto toma el precio que propuso el sistema.', 'Lo normal. Confiás en el análisis.'],
          ['**Porcentaje fijo**', 'El mismo % para todos.', 'Aumento general: "todo +5 %".'],
          ['**Según el dólar blue**', 'Cada uno sube lo que subió el dólar desde su última revisión.', 'Productos atados al dólar (aluminio, importados).'],
          ['**Costo de reposición + recargo**', 'Precio = costo nuevo + lo que ya le sumabas. Puede actualizar también el costo cargado.', 'El proveedor ya te pasó los costos nuevos.'],
          ['**Porcentaje por grupo**', 'Un % distinto por familia, línea o proveedor.', 'Ej.: +8 % línea Módena, +5 % Herrero.'],
        ],
      },
      { t: 'p', texto: '**Redondeo** (siempre hacia arriba, para no perder margen):' },
      {
        t: 'tabla',
        cols: ['Redondeo', '$ 203.666 queda en…'],
        filas: [
          ['Sin redondeo', '$ 203.666'],
          ['A $ 10', '$ 203.670'],
          ['A $ 100', '$ 203.700'],
          ['A $ 1.000', '$ 204.000'],
          ['**Terminado en 900**', '**$ 203.900** (y $ 203.950 queda en $ 204.900)'],
        ],
      },
      { t: 'p', texto: 'Tocá **"Ver vista previa"**.' },
      { t: 'subtitulo', texto: 'Paso 2 — Revisar antes de guardar' },
      { t: 'p', texto: 'Arriba, cuatro números para dimensionar el cambio: **cuántos productos cambian**, el **aumento promedio**, el **recargo promedio antes → después** y **cuánto más se habría facturado** con lo vendido en los últimos 90 días.' },
      { t: 'p', texto: 'Debajo, un producto por fila: precio actual, **precio nuevo en un casillero que podés corregir a mano**, el % y lo que queda ganando. Con la casilla de la izquierda sacás o ponés cada producto.' },
      {
        t: 'tabla',
        cols: ['Si la fila dice…', 'Qué hacer'],
        filas: [
          ['**El precio baja**', 'El precio nuevo es menor. Si es lo que querés, al aplicar el sistema te pide **confirmarlo de nuevo**.'],
          ['**Queda bajo el objetivo**', 'Va a ganar menos de lo que debería. Podés subir el precio a mano.'],
          ['**Precio manual: excluido**', 'Tiene el precio fijado a mano en su ficha. No se toca salvo que lo marques.'],
          ['**Sin fórmula: no cambia**', '(Solo desde "Por fórmula") No es estándar: queda igual.'],
          ['**Posible error de carga**', 'Corregí el costo o el precio en la ficha antes de aplicar.'],
        ],
      },
      { t: 'p', texto: 'Cuando está todo bien, tocá **"Aplicar a N"**.' },
      { t: 'aviso', tono: 'regla', texto: 'Se guarda **todo junto o nada**: si algo falla no queda ningún producto a medias. Los actualizados quedan en verde y en su historial queda cómo se calculó, quién lo hizo y el dólar del día.' },
    ],
  },

  // ── 8 ──────────────────────────────────────────────────────────
  {
    id: 'formula',
    titulo: 'Pestaña "Por fórmula": el precio de los productos estándar',
    corto: 'Por fórmula',
    icono: Sigma,
    bloques: [
      { t: 'p', texto: 'Los productos **estándar** (los de medida fija, de stock) tienen una manera fija de calcular el precio de venta a partir del costo: **la fórmula del negocio**. Esta pestaña hace la cuenta para todos, te muestra cuáles coinciden y cuáles no, y **vos elegís a cuáles aplicarla**.' },
      { t: 'subtitulo', texto: 'La fórmula, paso a paso' },
      {
        t: 'tabla',
        cols: ['Paso', 'Qué se hace', 'Con costo $ 100.000'],
        filas: [
          ['1', 'Calcular el **12 % del costo** y guardarlo aparte', '$ 12.000'],
          ['2', '**Dividir el costo por 0,60**', '$ 166.666,67'],
          ['3', 'A eso **sumarle un 15 %**', '$ 191.666,67'],
          ['4', '**Sumar lo que se guardó** en el paso 1', '$ 203.666,67'],
          ['5', '**Redondear hacia arriba** a un número que termine en 900', '**$ 203.900**'],
        ],
      },
      { t: 'p', texto: 'En corto: **precio ≈ costo × 2,04**, y termina en 900.' },
      { t: 'subtitulo', texto: 'Qué ves arriba' },
      {
        t: 'lista',
        items: [
          'Los **números de la fórmula** (12 %, 0,60, 15 %, terminar en 900 cada 1.000). Al costado, un **ejemplo** con la cuenta completa: podés cambiar el costo del ejemplo para probar.',
          'Si cambiás un número, la lista de abajo se recalcula **al instante**, sin guardar nada: sirve para "ver qué pasaría si…". Para aplicar, primero hay que tocar **"Guardar fórmula"** (solo administradores). Si no te convence, **"Descartar cambios"**.',
          '**Excepciones**: si una familia o un proveedor lleva otros números, un administrador toca **"+ Excepción"**, elige la familia y/o el proveedor y ajusta sus números. A cada producto se le aplica la más puntual que le corresponda; si no tiene ninguna, la general.',
        ],
      },
      { t: 'subtitulo', texto: 'Los cinco grupos (las tarjetas de colores)' },
      { t: 'p', texto: 'Cada producto cae en uno de estos grupos. Tocá una tarjeta para ver sus productos:' },
      {
        t: 'tabla',
        cols: ['Tarjeta', 'Qué significa', '¿Viene marcado para aplicar?'],
        filas: [
          ['**Debajo de la fórmula** (naranja)', 'Se vende **más barato** de lo que da la fórmula.', '**Sí**, si la diferencia está entre el mínimo y el tope (ver abajo).'],
          ['**En la fórmula** (verde)', 'Está bien: la diferencia es chica (menos de 3 %).', 'No. No hace falta cambiar.'],
          ['**Encima de la fórmula** (celeste)', 'Se vende **más caro** que la fórmula.', 'No. Si lo marcás vos, **el precio baja**, y el sistema te pide confirmarlo.'],
          ['**Posible error de carga** (rojo)', 'El costo o el precio no tienen sentido (ej. costo $ 175,80 en vez de $ 175.800, o $ 1).', 'No se puede marcar. Usá **"Corregir el producto"** y arreglalo en la ficha.'],
          ['**Sin fórmula** (gris)', 'Productos a medida o con "precio manual".', 'No. Solo informativo.'],
        ],
      },
      { t: 'subtitulo', texto: 'Tres ajustes para decidir mejor' },
      {
        t: 'tabla',
        cols: ['Ajuste', 'Para qué sirve', 'Ejemplo'],
        filas: [
          ['**Costo para calcular**', '"Costo cargado" usa el costo de la ficha. "Costo de reposición" usa lo que costaría comprarlo hoy (si la lista del proveedor o la última compra subieron), y opcionalmente actualiza también el costo.', 'El proveedor subió y todavía no cargaste el costo nuevo → usá reposición.'],
          ['**No tocar si la diferencia es menor a (%)**', 'Evita cambios chiquitos que no valen la pena.', 'Con 3 %, un producto que debería subir 1 % queda como está.'],
          ['**No marcar aumentos mayores a (%)**', 'Un aumento muy grande suele esconder un costo desactualizado o mal cargado. Esos quedan **desmarcados** con la etiqueta **"sobre el tope"** para que los mires uno por uno.', 'Con 30 %, uno que subiría 45 % no se marca solo.'],
        ],
      },
      { t: 'subtitulo', texto: 'Cómo leer cada fila' },
      {
        t: 'lista',
        items: [
          '**costo**: el que se usó para la cuenta.',
          '**$ actual → $ fórmula**: el precio de hoy y el que da la fórmula.',
          '**+X %** y **+$**: cuánto sube (en naranja) o baja (en celeste).',
          '**"2,04 veces el costo"**: cuántas veces el costo es el precio actual. La fórmula da alrededor de 2,04.',
          '**"sobre el tope"** / **"baja de precio"**: avisos para mirar con cuidado.',
          '**Detalle**: la cuenta de la fórmula con los números de ese producto y su historial de precios.',
        ],
      },
      { t: 'subtitulo', texto: 'Paso a paso' },
      {
        t: 'lista',
        ordenada: true,
        items: [
          'Mirá que los números de la fórmula sean los correctos (el ejemplo de $ 100.000 tiene que dar $ 203.900).',
          'Tocá la tarjeta **"Debajo de la fórmula"**: los que conviene subir ya vienen marcados.',
          'Revisá los que dicen **"sobre el tope"**: abrí el **Detalle** y, si el aumento es correcto, marcalos.',
          'Desmarcá los que no quieras tocar. Con **"Marcar los N de la lista"** marcás o desmarcás todos los que estás viendo (sirve junto con los filtros por familia o proveedor).',
          'Mirá la tarjeta **"Posible error de carga"** y corregí esos productos en su ficha.',
          'Abajo, el **resumen** te dice cuántos se van a aplicar, el aumento promedio y cuántos quedan afuera y por qué.',
          'Tocá **"Vista previa y aplicar"**: se abre la misma ventana de revisión de siempre, donde todavía podés corregir cada precio. Tocá **"Aplicar a N"**.',
        ],
      },
      { t: 'flujo', nodos: ['Revisar la fórmula', 'Ver "Debajo"', 'Marcar / desmarcar', 'Corregir errores', 'Vista previa', 'Aplicar'] },
      { t: 'aviso', tono: 'regla', texto: 'La fórmula **es una sugerencia**: no se aplica sola cuando cambia un costo. Un precio que está **encima** de la fórmula **nunca baja** salvo que lo marques vos y lo confirmes.' },
    ],
  },

  // ── 9 ──────────────────────────────────────────────────────────
  {
    id: 'proveedor',
    titulo: 'Pestaña "Lista del proveedor": cuando llega una lista nueva',
    corto: 'Lista del proveedor',
    icono: FileSpreadsheet,
    bloques: [
      { t: 'p', texto: 'Cargás la lista que te mandó un proveedor y el sistema compara **solo los productos de ese proveedor**. Los de otros proveedores no se tocan.' },
      { t: 'subtitulo', texto: 'Cómo tiene que venir el archivo' },
      {
        t: 'lista',
        items: [
          '**Excel (.xlsx)** o **CSV**. El Excel viejo (.xls) no se puede leer: abrilo y guardalo como .xlsx.',
          'Una columna con el **código** del proveedor y otra con el **precio**. La descripción es opcional.',
          'El sistema encuentra solo las columnas por sus títulos ("Código", "SKU", "Precio", "Descripción"…), aunque estén en otro orden o haya filas de título arriba.',
          'Los precios pueden venir como "$ 1.234,56", "1234.56" o "12.500".',
          'Las filas sin código o sin precio (por ejemplo "consultar") se descartan y el sistema dice cuántas.',
        ],
      },
      { t: 'subtitulo', texto: 'Paso a paso' },
      {
        t: 'lista',
        ordenada: true,
        items: [
          'Elegí el **proveedor**.',
          'Elegí **"Lista en archivo"** y tocá **"Elegir archivo"**. Fijate que las columnas que tomó sean las correctas.',
          'Si el proveedor no mandó lista sino que avisó "aumentamos X %", elegí **"Porcentaje"** y escribí el %.',
          'Tocá **"Analizar solo los productos de…"**.',
          'Revisá el resultado y elegí qué hacer con cada producto.',
          'Tocá **"Aplicar"**.',
        ],
      },
      { t: 'subtitulo', texto: 'Cómo leer el resultado' },
      {
        t: 'tabla',
        cols: ['Etiqueta', 'Significa', 'Lo que propone el sistema'],
        filas: [
          ['**Sube**', 'El proveedor cobra más que el costo cargado.', 'Actualizar costo y precio.'],
          ['**Sin cambio**', 'Mismo costo.', 'Solo renovar la fecha.'],
          ['**Baja**', 'El proveedor bajó el precio.', 'No tocar: decidís vos.'],
          ['**A revisar**', 'Cambio raro (baja, o suba de más de 30 %): puede ser un error de la lista o un cambio de código.', 'No tocar: decidís vos.'],
          ['**Códigos nuevos**', 'Códigos de la lista que no están enlazados a ningún producto nuestro.', 'Enlazarlos si corresponde.'],
          ['**No vinieron**', 'Productos del proveedor que no están en la lista.', 'Puede ser una baja o un cambio de código.'],
        ],
      },
      { t: 'p', texto: 'Cada producto muestra **costo actual → nuevo** y **precio actual → nuevo** (el precio nuevo mantiene lo que le sumabas al costo). Si solo querés actualizar el costo, destildá **"Actualizar también el precio de venta"**. A la derecha de cada uno podés cambiar la decisión: **Actualizar**, **Solo renovar** o **No tocar**.' },
      { t: 'subtitulo', texto: 'Enlazar códigos nuevos' },
      { t: 'p', texto: 'Si un código de la lista es un producto nuestro que el sistema no reconoció (por ejemplo, el proveedor cambió el código), elegí el producto en **"Enlazar con…"** y tocá **"Volver a analizar con los enlaces"**. Desde la próxima lista lo reconoce solo.' },
      { t: 'aviso', tono: 'regla', texto: 'Al aplicar se guarda la lista completa del proveedor, se actualizan los costos y precios elegidos, se renueva la fecha de los que no cambiaron, y en el historial queda "Lista de [proveedor]".' },
    ],
  },

  // ── 10 ─────────────────────────────────────────────────────────
  {
    id: 'etiquetas',
    titulo: 'Qué significa cada etiqueta',
    corto: 'Etiquetas',
    icono: Tags,
    bloques: [
      {
        t: 'tabla',
        cols: ['Etiqueta', 'Qué quiere decir', 'Qué hacer'],
        filas: [
          ['**Lista del proveedor +X %**', 'El proveedor cobra hoy X % más que el costo cargado.', 'Actualizar.'],
          ['**Última compra +X %**', 'La última compra se pagó X % más que el costo cargado.', 'Actualizar.'],
          ['**Dólar +X %**', 'El dólar blue subió X % desde la última revisión.', 'Actualizar, sobre todo si el producto depende del dólar.'],
          ['**Recargo X % (objetivo Y %)**', 'Gana menos de lo que debería.', 'Actualizar.'],
          ['**Debajo de la fórmula (−X %)**', 'Producto estándar más barato que la fórmula.', 'Ver la pestaña "Por fórmula".'],
          ['**Por encima de la fórmula (+X %): revisar**', 'Producto estándar más caro que la fórmula.', 'Confirmar que sea a propósito. No se baja solo.'],
          ['**Posible error de carga**', 'El precio es menos de 1,2 o más de 4 veces el costo, o el costo es de $ 10 o menos.', 'Corregir el producto en su ficha.'],
          ['**Recargo muy distinto al de su familia**', 'Gana mucho más o mucho menos que productos parecidos.', 'Revisar costo y precio en la ficha.'],
          ['**El proveedor bajó el precio: ¿conviene bajar?**', 'La lista del proveedor bajó.', 'Decidís vos; el sistema no baja precios.'],
          ['**La última compra difiere mucho: revisar**', 'La compra es menos de la mitad o más del doble del costo.', 'Probablemente un error de carga o otra presentación.'],
          ['**Inflación +X %**', 'Inflación acumulada desde la última revisión.', 'Solo de referencia.'],
          ['**Sin costo cargado**', 'No se puede analizar.', 'Cargar el costo en la ficha.'],
        ],
      },
    ],
  },

  // ── 11 ─────────────────────────────────────────────────────────
  {
    id: 'historial',
    titulo: 'Historial de precios',
    corto: 'Historial',
    icono: History,
    bloques: [
      { t: 'p', texto: 'Cada cambio de precio o de costo, y cada renovación, queda anotado. Se ve tocando **"Historial"** (en Actualizar precios) o **"Detalle"** (en Por fórmula).' },
      { t: 'p', texto: 'Cada línea dice: **cuándo**, **qué pasó** (cambio de precio, de costo o renovación), **antes → después**, el **dólar blue de ese día**, **cómo se calculó** (por ejemplo "Fórmula Estándar" o "Lista de Alumar") y **quién** lo hizo.' },
      { t: 'p', texto: 'Se anota desde todos lados: la ficha del producto, esta revisión, la lista del proveedor y la renovación por familia.' },
    ],
  },

  // ── 12 ─────────────────────────────────────────────────────────
  {
    id: 'parametros',
    titulo: 'Parámetros (solo administradores)',
    corto: 'Parámetros',
    icono: SlidersHorizontal,
    bloques: [
      { t: 'p', texto: 'El botón **"Parámetros"** de arriba ajusta tres valores que usa toda la revisión:' },
      {
        t: 'tabla',
        cols: ['Parámetro', 'Qué cambia', 'Valor inicial'],
        filas: [
          ['**Variación mínima para sugerir actualizar**', 'Por debajo de este % se considera "sin cambios" (y en Por fórmula, "en la fórmula").', '3 %'],
          ['**Días "al día" (verde)**', 'Los revisados hace estos días o menos no se proponen.', '7 días'],
          ['**Días "vencido" (rojo)**', 'Desde estos días el precio se marca en rojo.', '10 días'],
        ],
      },
      { t: 'p', texto: 'Los números de la **fórmula de precio** no están acá: se cambian en la pestaña **Por fórmula**, arriba de todo.' },
    ],
  },

  // ── 13 ─────────────────────────────────────────────────────────
  {
    id: 'palabras',
    titulo: 'Palabras que vas a ver',
    corto: 'Palabras',
    icono: BookOpen,
    bloques: [
      {
        t: 'tabla',
        cols: ['Palabra', 'Qué es', 'Ejemplo'],
        filas: [
          ['**Costo**', 'Lo que nos cuesta el producto.', '$ 100.000'],
          ['**Precio de venta**', 'Lo que cobramos.', '$ 130.000'],
          ['**Recargo sobre costo**', 'Cuánto se le suma al costo para llegar al precio, en %.', '$ 130.000 sobre $ 100.000 = **30 %**'],
          ['**Recargo objetivo**', 'El recargo que debería tener. Se configura en el producto, la familia o el proveedor.', '35 %'],
          ['**Ganancia sobre precio**', 'Qué parte del precio es ganancia. Es otra forma de ver lo mismo (la usa la ficha del producto).', 'Mismo ejemplo: **23 %**'],
          ['**Costo de reposición**', 'Lo que costaría volver a comprarlo hoy: el más alto entre el costo cargado, la lista del proveedor y la última compra.', 'Cargado $ 100.000, lista $ 112.000 → **$ 112.000**'],
          ['**Fecha de validez**', 'El último día en que alguien revisó ese precio.', '"Renovado 01/10/26"'],
          ['**Renovar**', 'Confirmar que el precio sigue bien: cambia la fecha, no el precio.', ''],
          ['**Fórmula de precio**', 'La cuenta fija del negocio para los estándar.', '$ 100.000 → $ 203.900'],
          ['**Veces el costo**', 'Precio dividido costo.', '$ 203.900 / $ 100.000 = **2,04**'],
          ['**Precio manual**', 'Producto con el precio fijado a mano en su ficha: la revisión no lo toca salvo que lo marques.', ''],
        ],
      },
    ],
  },

  // ── 14 ─────────────────────────────────────────────────────────
  {
    id: 'preguntas',
    titulo: 'Preguntas frecuentes',
    corto: 'Preguntas',
    icono: CircleHelp,
    bloques: [
      { t: 'subtitulo', texto: '¿Cada cuánto conviene hacer la revisión?' },
      { t: 'p', texto: 'Una vez por semana (ver "La rutina de cada semana"). Y cada vez que llega una lista de un proveedor, ese mismo día.' },
      { t: 'subtitulo', texto: '¿Qué diferencia hay entre "Actualizar precios" y "Por fórmula"?' },
      { t: 'p', texto: '**Actualizar precios** sigue a los costos: si el proveedor o el dólar subieron, propone subir **manteniendo lo que el producto ya ganaba**. **Por fórmula** no mira lo que ganaba antes: calcula el precio que **debería tener** un estándar según la cuenta del negocio. Si un estándar aparece en las dos, lo más simple es resolverlo desde **Por fórmula**.' },
      { t: 'subtitulo', texto: '¿Si actualizo un precio, cambian las proformas que ya mandé?' },
      { t: 'p', texto: 'No. Las proformas enviadas guardan su precio. El nuevo se usa desde ese momento.' },
      { t: 'subtitulo', texto: '¿La fórmula cambia los precios sola cuando cargo un costo nuevo?' },
      { t: 'p', texto: 'No. La fórmula solo **sugiere**. Para aplicarla hay que entrar a "Por fórmula", marcar y confirmar.' },
      { t: 'subtitulo', texto: 'Un producto estándar quedó en "Encima de la fórmula". ¿Está mal?' },
      { t: 'p', texto: 'No necesariamente: puede ser un producto que se vende bien a ese precio. El sistema no lo baja. Si querés llevarlo a la fórmula, marcalo y confirmá la baja en la vista previa.' },
      { t: 'subtitulo', texto: '¿Por qué un producto está en "Posible error de carga"?' },
      { t: 'p', texto: 'Porque el precio es menos de 1,2 o más de 4 veces el costo, o el costo es de $ 10 o menos. Lo típico: el costo se escribió sin los miles ($ 175,80 en vez de $ 175.800). Tocá **"Corregir el producto"**, arreglá el costo en la ficha y volvé.' },
      { t: 'subtitulo', texto: '¿De dónde sale el dólar? ¿Hay que cargarlo?' },
      { t: 'p', texto: 'No. El sistema guarda solo el dólar blue de cada día y la inflación mensual del INDEC.' },
      { t: 'subtitulo', texto: 'Un producto no aparece en ninguna pestaña' },
      { t: 'p', texto: 'Puede estar **al día** (revisado hace pocos días), **inactivo** o **sin costo**. Para elegirlo igual: "Elegir a mano o por familia" en Renovar, o "Ver también los que no necesitan cambio" en Actualizar.' },
      { t: 'subtitulo', texto: 'La lista del proveedor no reconoce mis productos' },
      { t: 'p', texto: 'El sistema cruza por el **código del proveedor**. Enlazalos una vez con "Enlazar con…" y desde la próxima lista los reconoce solo. También se puede cargar el código en la ficha del producto.' },
      { t: 'subtitulo', texto: 'Me equivoqué con un aumento' },
      { t: 'p', texto: 'Mirá el **historial** del producto para ver el precio anterior y volvé a ponerlo desde la ficha, o con el asistente corrigiendo el precio a mano en la vista previa.' },
      { t: 'aviso', tono: 'info', texto: 'Los usuarios de **solo consulta** pueden ver todo, pero no renovar ni cambiar precios. Cambiar la fórmula y los parámetros es solo para **administradores**.' },
    ],
  },
];
