import {
  Scale, LayoutDashboard, Calculator, RefreshCw, ListChecks, TrendingUp, Wand2, FileSpreadsheet,
  Tags, History, SlidersHorizontal, CircleHelp,
} from 'lucide-react';
import type { SeccionManual } from './tipos';

/**
 * Manual de la Revisión integral de precios (Productos → /productos/precios).
 * Ver `tipos.ts` para el formato de los bloques. Si cambia la pantalla o el criterio de
 * `server/src/lib/precios.ts`, actualizar también este manual y el tema 'precios' de HelpDrawer.
 */
export const MANUAL_PRECIOS: SeccionManual[] = [
  {
    id: 'para-que',
    titulo: 'Para qué sirve',
    corto: 'Para qué sirve',
    icono: Scale,
    bloques: [
      { t: 'p', texto: 'Cada producto tiene un **precio de venta** y una **fecha de validez**: el día en que alguien revisó ese precio y dijo "está bien". Con el tiempo los costos suben (el proveedor manda lista nueva, sube el dólar, hay inflación) y un precio viejo hace perder plata sin que nadie se dé cuenta.' },
      { t: 'p', texto: 'La **Revisión integral de precios** hace ese control por vos: mira todos los productos, compara su precio con lo que pasó desde la última vez que se revisó y te dice:' },
      {
        t: 'lista',
        items: [
          '**Cuáles conviene solo renovar**: no cambió nada importante, el precio sigue sirviendo. Se renueva la fecha y listo.',
          '**Cuáles conviene actualizar**: algo subió (el proveedor, la última compra o el dólar) o el producto está ganando menos de lo que debería. Te dice cuánto y por qué.',
          '**Cómo cargar la lista de precios de un proveedor** y ver de una vez qué productos de ese proveedor suben, cuáles no cambian y cuáles faltan.',
        ],
      },
      { t: 'flujo', nodos: ['Entrar a la revisión', 'Renovar lo que no cambió', 'Actualizar lo que subió', 'Cargar listas de proveedores'] },
      { t: 'subtitulo', texto: 'El semáforo de la fecha' },
      {
        t: 'tabla',
        cols: ['Color', 'Significa'],
        filas: [
          ['**Verde**', 'Precio revisado hace 7 días o menos. Está al día.'],
          ['**Amarillo**', 'Revisado hace 8 a 10 días. Conviene mirarlo pronto.'],
          ['**Rojo**', 'Más de 10 días sin revisar. Hay que renovarlo o actualizarlo.'],
        ],
      },
      { t: 'aviso', tono: 'info', texto: 'El sistema **solo sugiere**: ningún precio cambia hasta que vos lo confirmás. Y las proformas que ya se mandaron a los clientes **no cambian nunca**: guardan el precio con el que se enviaron.' },
    ],
  },
  {
    id: 'donde',
    titulo: 'Dónde está y qué muestra arriba',
    corto: 'La pantalla',
    icono: LayoutDashboard,
    bloques: [
      { t: 'p', texto: 'En **Productos**, arriba a la derecha, el botón **"Revisión integral de precios"**. También se llega desde **Proveedores → Precios → "Actualizar precios"**, que abre directo la pestaña del proveedor.' },
      { t: 'p', texto: 'Arriba de todo hay una franja oscura con los números del día:' },
      {
        t: 'tabla',
        cols: ['Dato', 'Qué es'],
        filas: [
          ['**Dólar blue**', 'La cotización de hoy y cuánto subió o bajó en los últimos 30 días. Se actualiza solo, todos los días.'],
          ['**Inflación**', 'La inflación del último mes publicado por el INDEC y la de los últimos 3 meses. Es solo de referencia.'],
          ['**Para actualizar**', 'Cuántos productos conviene subir de precio.'],
          ['**Para renovar**', 'Cuántos productos no cambiaron y solo hay que renovarles la fecha.'],
          ['**Al día**', 'Cuántos se revisaron hace pocos días y no necesitan nada.'],
          ['**Sin costo**', 'Productos que no tienen el costo cargado: el sistema no los puede analizar. Solo aparece si hay alguno.'],
          ['**Recargo prom.**', 'Cuánto se le suma en promedio al costo para llegar al precio de venta.'],
        ],
      },
      { t: 'p', texto: 'Debajo están las tres pestañas: **Renovar validez**, **Actualizar precios** y **Lista del proveedor**. Las dos primeras muestran entre paréntesis cuántos productos tienen.' },
    ],
  },
  {
    id: 'como-decide',
    titulo: 'Cómo decide el sistema (en palabras simples)',
    corto: 'Cómo decide',
    icono: Calculator,
    bloques: [
      { t: 'subtitulo', texto: 'Primero, tres palabras que se usan en toda la pantalla' },
      {
        t: 'tabla',
        cols: ['Palabra', 'Qué es', 'Ejemplo'],
        filas: [
          ['**Costo**', 'Lo que nos cuesta el producto.', '$ 100.000'],
          ['**Recargo sobre costo**', 'Cuánto se le suma al costo para llegar al precio de venta.', 'Precio $ 130.000 → recargo **30 %**'],
          ['**Ganancia sobre precio**', 'Qué parte del precio de venta es ganancia. Es otra forma de ver lo mismo (la usa la ficha del producto).', 'Con el mismo ejemplo: **23 %**'],
        ],
      },
      { t: 'p', texto: 'El **recargo objetivo** es el recargo que debería tener el producto. Se configura en el producto, en su familia (Configuración) o en el proveedor. Si no hay ninguno configurado, el sistema toma el recargo que el producto ya tiene.' },
      { t: 'subtitulo', texto: 'Qué compara de cada producto' },
      {
        t: 'lista',
        items: [
          '**La lista del proveedor**: si el costo en la lista vigente del proveedor es distinto del costo cargado.',
          '**La última compra**: lo que se pagó en la última orden de compra, si es posterior a la última revisión del precio.',
          '**El dólar blue**: el del día en que se revisó el precio por última vez, contra el de hoy.',
          '**El recargo**: si el producto está ganando menos que su recargo objetivo.',
          '**La inflación** desde entonces (solo se muestra, no cambia la sugerencia).',
        ],
      },
      { t: 'subtitulo', texto: '¿Renovar o actualizar?' },
      { t: 'p', texto: 'Si nada se movió más de **3 %** (se puede cambiar en Parámetros), el producto va a **Renovar validez**. Si algo se movió más, va a **Actualizar precios** con un precio sugerido.' },
      { t: 'subtitulo', texto: 'Cómo calcula el precio sugerido' },
      {
        t: 'lista',
        ordenada: true,
        items: [
          'Busca el **costo de reposición**: lo que costaría volver a comprarlo hoy. Es el más alto entre el costo cargado, el de la lista del proveedor y el de la última compra.',
          'Calcula el precio **manteniendo el recargo** sobre ese costo nuevo (o llevándolo al objetivo, si el producto estaba ganando de menos).',
          'Calcula el precio **siguiendo al dólar**: el precio actual más lo que subió el dólar.',
          'Se queda con **el mayor de los dos**. No los suma: si el proveedor subió justamente por el dólar, sumarlos sería cobrar el aumento dos veces.',
        ],
      },
      {
        t: 'tabla',
        cols: ['Ejemplo', 'Cálculo'],
        filas: [
          ['Producto hoy', 'Costo $ 100.000 · precio $ 130.000 (recargo 30 %)'],
          ['El proveedor subió 12 %', 'Costo de reposición $ 112.000 → con el mismo 30 %: **$ 145.600**'],
          ['El dólar subió 8 %', '$ 130.000 + 8 % = $ 140.400'],
          ['Sugerido', 'El mayor: **$ 145.600 (+12 %)**'],
        ],
      },
      { t: 'aviso', tono: 'regla', texto: 'El sistema **nunca propone bajar un precio**. Si un producto ya gana más que su objetivo, conserva su recargo. Si el proveedor bajó el precio, lo avisa con una etiqueta ("¿conviene bajar?") para que lo decidas vos.' },
      { t: 'aviso', tono: 'ojo', texto: 'Si la última compra es muy distinta del costo cargado (menos de la mitad o más del doble), el sistema **no la usa** y avisa "difiere mucho: revisar". Casi siempre es un error de carga o una compra de otra presentación.' },
    ],
  },
  {
    id: 'renovar',
    titulo: 'Pestaña "Renovar validez"',
    corto: 'Renovar validez',
    icono: RefreshCw,
    bloques: [
      { t: 'p', texto: 'Acá están los productos que **no tuvieron variación**: ni la lista del proveedor, ni la última compra, ni el dólar se movieron lo suficiente, y el recargo está bien. El precio sigue sirviendo; solo hay que renovarle la fecha.' },
      { t: 'p', texto: 'Los productos **vienen ya marcados**, los que no cambiaron hace más tiempo primero. Cada fila muestra:' },
      {
        t: 'lista',
        items: [
          '**El producto**, con su código, familia, línea y proveedor.',
          '**El costo** (no el precio de venta), para comparar con lo que cobra el proveedor. Si la lista del proveedor o la última compra dicen otra cosa, aparece debajo en chiquito.',
          '**"Renovado dd/mm/aa"**: la fecha de la última revisión, con el color del semáforo y hace cuántos días fue. Debajo, el precio de venta.',
          '**El motivo**: normalmente "Sin cambios de costo ni de dólar".',
        ],
      },
      { t: 'subtitulo', texto: 'Paso a paso' },
      {
        t: 'lista',
        ordenada: true,
        items: [
          'Si querés, filtrá por familia, proveedor o línea, o buscá un producto.',
          'Desmarcá los que **no** quieras renovar (tocando la fila). Con **"Marcar todos / Desmarcar todos"** se cambian todos los de la lista de una vez.',
          'Tocá **"Renovar validez (N)"** abajo a la derecha.',
        ],
      },
      { t: 'p', texto: 'Listo: esos productos pasan a verde, el precio queda igual y en el historial de cada uno queda anotado que se renovó, quién lo hizo y el dólar de ese día.' },
    ],
  },
  {
    id: 'a-mano',
    titulo: 'Renovar a mano o por familia',
    corto: 'A mano o por familia',
    icono: ListChecks,
    bloques: [
      { t: 'p', texto: 'Si querés renovar productos que el sistema no sugirió (por ejemplo, revisaste uno a uno con el proveedor por teléfono), en la pestaña Renovar validez tocá **"Elegir a mano o por familia"**. Se abre una ventana con dos opciones:' },
      {
        t: 'tabla',
        cols: ['Opción', 'Cómo se usa'],
        filas: [
          ['**Por familia**', 'Marcás familias completas (Ventanas, Puertas, Mosquiteros…). Al lado de cada una dice cuántos productos tiene vencidos o por vencer.'],
          ['**Elegir productos**', 'Buscás por nombre, código, color o proveedor; filtrás por familia, proveedor o estado (Vencidos / Por vencer / Al día) y marcás de a uno, o "Marcar los N de la lista". Cada producto muestra su **costo** y la **fecha en que se renovó**.'],
        ],
      },
      { t: 'p', texto: 'La opción "Elegir productos" también sirve para los productos **sin familia**: elegí "Sin familia" en el filtro.' },
    ],
  },
  {
    id: 'actualizar',
    titulo: 'Pestaña "Actualizar precios": analizar y decidir',
    corto: 'Actualizar precios',
    icono: TrendingUp,
    bloques: [
      { t: 'p', texto: 'Acá están los productos que **conviene subir de precio**. Antes de tocar nada, la pantalla te da todo lo necesario para decidir.' },
      { t: 'subtitulo', texto: 'Cómo leer cada fila' },
      {
        t: 'tabla',
        cols: ['Parte', 'Qué dice'],
        filas: [
          ['**Costo**', 'El costo cargado, y debajo el de la lista del proveedor o la última compra si son distintos.'],
          ['**Recargo**', 'Cuánto se le está sumando hoy al costo. Si tiene objetivo, lo muestra debajo. En **rojo con un triángulo** si es muy distinto al del resto de su familia.'],
          ['**$ actual → $ sugerido**', 'El precio de hoy y el que propone el sistema, con el porcentaje de aumento.'],
          ['**Etiquetas**', 'Por qué lo sugiere: "Lista del proveedor +12 %", "Dólar +8 %", "Recargo 18 % (objetivo 30 %)", etc.'],
          ['**Datos de abajo**', 'Fecha de la última revisión, unidades vendidas en 90 días, proformas abiertas con ese producto y unidades en el salón.'],
          ['**Historial**', 'A la derecha: despliega todos los cambios de precio del producto, con el dólar de cada día.'],
        ],
      },
      { t: 'subtitulo', texto: 'Herramientas para decidir' },
      {
        t: 'lista',
        items: [
          '**Agrupar por** familia, línea / sistema, proveedor, o "a medida / por unidad". Cada grupo muestra su recargo promedio, cuánto subió el costo y el aumento sugerido promedio. En aberturas los aumentos suelen venir por línea o por proveedor (aluminio, vidrio, herrajes): agrupado se ve enseguida dónde pegó más. Tocando el nombre del grupo se marcan todos sus productos.',
          '**Ordenar por**: **Prioridad** (lo que más pesa: mucho aumento, mucha venta y precio viejo, primero), mayor aumento sugerido, más vendidos, recargo más bajo o precio más viejo.',
          '**"Ver también los que no necesitan cambio"**: suma a la lista los demás productos, por si querés aplicarles igual un aumento general.',
          '**Recargo muy distinto al de su familia**: si un producto tiene un recargo muy por arriba o muy por abajo del resto de su familia, se marca. Suele ser un costo o un precio mal cargado: conviene revisarlo en la ficha antes de aumentarlo.',
        ],
      },
      { t: 'subtitulo', texto: 'Datos a tener en cuenta' },
      {
        t: 'lista',
        items: [
          '**Proformas abiertas**: hay proformas enviadas y vigentes con ese producto. Al cambiar el precio **no cambian**; pero si el cliente pide otra, saldrá con el precio nuevo.',
          '**En salón**: hay stock que se compró con el costo anterior.',
          '**Precio manual**: ese producto tiene el precio fijado a mano en su ficha. El asistente lo deja afuera salvo que lo marques a propósito.',
        ],
      },
      { t: 'p', texto: 'Cuando decidiste, marcá los productos (casilla a la izquierda o el grupo entero) y tocá **"Actualizar precios (N)…"** abajo a la derecha. Se abre el asistente.' },
    ],
  },
  {
    id: 'asistente',
    titulo: 'El asistente para aplicar el aumento',
    corto: 'Aplicar aumento',
    icono: Wand2,
    bloques: [
      { t: 'p', texto: 'El asistente tiene dos pasos: elegir **cómo** calcular el precio nuevo, y **revisar** el resultado antes de guardar.' },
      { t: 'subtitulo', texto: 'Paso 1 — Criterio' },
      {
        t: 'tabla',
        cols: ['Criterio', 'Qué hace', 'Cuándo usarlo'],
        filas: [
          ['**Sugerido**', 'Cada producto toma el precio que propuso el análisis.', 'Lo normal: confiás en el análisis.'],
          ['**Porcentaje fijo**', 'El mismo aumento para todos (escribís el %).', 'Un aumento general, por ejemplo "todo +5 %".'],
          ['**Según el dólar blue**', 'Cada producto sube lo que subió el dólar desde su última revisión.', 'Productos atados al dólar (aluminio, importados).'],
          ['**Costo de reposición + recargo**', 'Precio = costo actualizado × (1 + recargo). Se puede tildar que también actualice el costo cargado.', 'Cuando el proveedor ya te pasó los costos nuevos.'],
          ['**Porcentaje por grupo**', 'Un % distinto para cada familia, línea, proveedor o por m². Los grupos sin % quedan igual.', 'Ej.: +8 % la línea Módena y +5 % Herrero.'],
        ],
      },
      { t: 'p', texto: '**Redondeo**: sin redondeo, o a $ 10, $ 100 o $ 1.000. Siempre redondea **hacia arriba**, para no perder margen. Ejemplo: $ 57.750 con redondeo a $ 100 queda $ 57.800.' },
      { t: 'p', texto: 'Tocá **"Ver vista previa"**.' },
      { t: 'subtitulo', texto: 'Paso 2 — Vista previa' },
      { t: 'p', texto: 'Arriba hay un resumen con cuatro números:' },
      {
        t: 'lista',
        items: [
          '**Productos que cambian**: cuántos se van a guardar del total.',
          '**Aumento promedio**.',
          '**Recargo promedio**: antes → después.',
          '**Sobre lo vendido en 90 días**: cuánto más se habría facturado si se hubiera vendido lo mismo a los precios nuevos. Sirve para dimensionar el aumento.',
        ],
      },
      { t: 'p', texto: 'Debajo, un producto por fila con el precio actual, el **precio nuevo en un casillero que se puede corregir a mano**, el porcentaje y el recargo que queda. Con la casilla de la izquierda se saca o se pone cada producto.' },
      {
        t: 'tabla',
        cols: ['Aviso en la fila', 'Qué hacer'],
        filas: [
          ['**El precio baja**', 'El precio nuevo es menor que el actual. Verificá que sea lo que querés.'],
          ['**Queda bajo el objetivo**', 'El recargo que resulta es menor que el objetivo del producto. Podés subir el precio a mano.'],
          ['**Precio manual: excluido**', 'El producto tiene precio fijado a mano. No se toca salvo que lo marques.'],
        ],
      },
      { t: 'p', texto: 'Si querés probar otro criterio, **"Cambiar criterio"** vuelve al paso 1. Cuando está todo bien, **"Aplicar a N"**.' },
      { t: 'aviso', tono: 'regla', texto: 'Se guarda **todo junto o nada**: si algo falla, no queda ningún producto a medias. Los productos actualizados quedan en verde y en su historial queda el criterio usado, quién lo hizo y el dólar del día.' },
    ],
  },
  {
    id: 'proveedor',
    titulo: 'Pestaña "Lista del proveedor"',
    corto: 'Lista del proveedor',
    icono: FileSpreadsheet,
    bloques: [
      { t: 'p', texto: 'Cuando un proveedor manda su lista de precios nueva, acá se carga y el sistema analiza **solo los productos de ese proveedor**. Los demás no se tocan.' },
      { t: 'subtitulo', texto: 'Cómo tiene que venir el archivo' },
      {
        t: 'lista',
        items: [
          'Una planilla de **Excel (.xlsx)** o un archivo **CSV**. El Excel viejo (.xls) no se puede leer: abrilo y guardalo como .xlsx.',
          'Tiene que tener una columna con el **código** del proveedor y otra con el **precio**. La descripción es opcional.',
          'El sistema encuentra solo las columnas mirando los títulos ("Código", "SKU", "Precio", "Precio lista", "Descripción"…), aunque estén en otro orden o haya filas de título arriba.',
          'Los precios pueden venir como "$ 1.234,56", "1234.56" o "12.500": los entiende igual.',
          'Las filas sin código o sin precio (por ejemplo "consultar") se descartan y el sistema dice cuántas.',
        ],
      },
      { t: 'subtitulo', texto: 'Paso a paso' },
      {
        t: 'lista',
        ordenada: true,
        items: [
          '**Proveedor**: elegilo del desplegable (dice cuántos productos tiene).',
          'Elegí **"Lista en archivo"** y tocá **"Elegir archivo"**. Aparece cuántos códigos se leyeron y qué columnas tomó: fijate que sean las correctas.',
          'Tocá **"Analizar solo los productos de…"**.',
          'Revisá el resultado (ver abajo) y elegí qué hacer con cada producto.',
          'Tocá **"Aplicar"**.',
        ],
      },
      { t: 'p', texto: 'Si el proveedor no mandó lista sino que avisó "aumentamos un X %", elegí **"Porcentaje"**, escribí el % y analizá: se calcula el costo nuevo de todos sus productos.' },
      { t: 'subtitulo', texto: 'Cómo leer el resultado' },
      {
        t: 'tabla',
        cols: ['Etiqueta', 'Significa'],
        filas: [
          ['**Sube**', 'El costo de la lista es mayor que el cargado.'],
          ['**Sin cambio**', 'El costo es el mismo: se propone **solo renovar la validez**.'],
          ['**Baja**', 'El proveedor bajó el precio.'],
          ['**A revisar**', 'Variación rara: una baja o una suba de más de 30 %. Puede ser un error de la lista o un cambio de código.'],
          ['**Códigos nuevos**', 'Códigos de la lista que no están enlazados a ningún producto nuestro.'],
          ['**No vinieron**', 'Productos de ese proveedor que no aparecen en la lista: puede ser una baja o un cambio de código.'],
        ],
      },
      { t: 'p', texto: 'Cada producto muestra el **costo actual → costo nuevo** y el **precio de venta actual → nuevo**. El precio nuevo mantiene el recargo del producto (o lo lleva al objetivo si estaba por debajo). Si no querés tocar los precios de venta, destildá **"Actualizar también el precio de venta"**: se actualiza solo el costo.' },
      { t: 'p', texto: 'A la derecha de cada producto elegís qué hacer: **Actualizar costo y precio**, **Solo renovar validez** o **No tocar**. El sistema ya lo propone: lo que sube se actualiza, lo que no cambió se renueva, y lo que baja o es raro queda en "No tocar" para que lo decidas vos.' },
      { t: 'subtitulo', texto: 'Enlazar códigos nuevos' },
      { t: 'p', texto: 'Si un código de la lista corresponde a un producto nuestro que el sistema no reconoció (por ejemplo, el proveedor cambió el código), en "Códigos de la lista que no están enlazados" elegí el producto en **"Enlazar con…"** y tocá **"Volver a analizar con los enlaces"**. Al aplicar, el enlace queda guardado y desde la próxima lista el sistema lo reconoce solo. Si es un producto que no vendemos, dejalo así: el código igual queda guardado en la lista del proveedor.' },
      { t: 'aviso', tono: 'regla', texto: 'Al aplicar: se guarda la lista completa del proveedor, se actualizan los costos y precios elegidos, se renueva la fecha de los que no cambiaron, y en el historial de cada producto queda "Lista de [proveedor] ([archivo])".' },
    ],
  },
  {
    id: 'etiquetas',
    titulo: 'Qué significa cada etiqueta',
    corto: 'Etiquetas',
    icono: Tags,
    bloques: [
      {
        t: 'tabla',
        cols: ['Etiqueta', 'Qué quiere decir'],
        filas: [
          ['**Lista del proveedor +X %**', 'El costo en la lista vigente del proveedor es X % más alto que el costo cargado.'],
          ['**Última compra +X %**', 'La última orden de compra se pagó X % más que el costo cargado.'],
          ['**Dólar +X %**', 'El dólar blue subió X % desde la última revisión del precio.'],
          ['**Recargo X % (objetivo Y %)**', 'El producto está ganando menos de lo que debería.'],
          ['**Inflación +X %**', 'Inflación acumulada desde la última revisión. Solo de referencia.'],
          ['**El proveedor bajó el precio: ¿conviene bajar?**', 'La lista del proveedor bajó. El sistema no baja precios solo: decidilo vos.'],
          ['**La última compra difiere mucho: revisar**', 'La compra es menos de la mitad o más del doble del costo: probablemente un error de carga.'],
          ['**Recargo muy distinto al de su familia**', 'El recargo se aleja mucho del promedio de su familia: revisá costo y precio en la ficha.'],
          ['**Sin costo cargado**', 'No se puede calcular el recargo: cargá el costo en la ficha del producto.'],
        ],
      },
    ],
  },
  {
    id: 'historial',
    titulo: 'Historial de precios',
    corto: 'Historial',
    icono: History,
    bloques: [
      { t: 'p', texto: 'Desde ahora, cada cambio de precio o de costo, y cada renovación de validez, queda registrado. Se ve en la pestaña Actualizar precios tocando **"Historial"** en la fila del producto.' },
      { t: 'p', texto: 'Cada línea dice: fecha y hora, qué pasó (cambio de precio, de costo o renovación), precio y costo antes → después con el porcentaje, el **dólar blue de ese día**, el criterio usado y quién lo hizo.' },
      { t: 'p', texto: 'Se registra desde todos lados: la ficha del producto, la revisión, la lista del proveedor y la renovación por familia.' },
      { t: 'aviso', tono: 'info', texto: 'Con el tiempo, el historial permite ver cuánto aumentó cada producto en el año y compararlo con el dólar y la inflación.' },
    ],
  },
  {
    id: 'parametros',
    titulo: 'Parámetros (solo administradores)',
    corto: 'Parámetros',
    icono: SlidersHorizontal,
    bloques: [
      { t: 'p', texto: 'El botón **"Parámetros"** de arriba (solo lo ven los administradores) permite ajustar tres valores:' },
      {
        t: 'tabla',
        cols: ['Parámetro', 'Qué cambia', 'Valor inicial'],
        filas: [
          ['**Variación mínima para sugerir actualizar**', 'Por debajo de este % se considera "sin variación" y se sugiere solo renovar.', '3 %'],
          ['**Días "al día" (verde)**', 'Precios revisados hace estos días o menos no se proponen.', '7 días'],
          ['**Días "vencido" (rojo)**', 'Desde estos días el precio se marca en rojo.', '10 días'],
        ],
      },
      { t: 'p', texto: 'Una variación mínima más alta hace que el sistema sugiera menos actualizaciones (solo cuando el movimiento es grande); más baja, que sea más exigente.' },
    ],
  },
  {
    id: 'preguntas',
    titulo: 'Preguntas frecuentes y buenas prácticas',
    corto: 'Preguntas',
    icono: CircleHelp,
    bloques: [
      { t: 'subtitulo', texto: '¿Cada cuánto conviene hacer la revisión?' },
      { t: 'p', texto: 'Una vez por semana alcanza: entrar, renovar lo que no cambió (un clic) y mirar la pestaña Actualizar. Y cada vez que un proveedor manda lista nueva, cargarla en la pestaña Lista del proveedor.' },
      { t: 'subtitulo', texto: '¿Si actualizo un precio, cambian las proformas que ya mandé?' },
      { t: 'p', texto: 'No. Las proformas enviadas guardan su propio precio. El precio nuevo se usa en las proformas que se hagan desde ese momento.' },
      { t: 'subtitulo', texto: '¿De dónde sale el dólar? ¿Hay que cargarlo?' },
      { t: 'p', texto: 'No hay que cargar nada: el sistema guarda solo la cotización del dólar blue todos los días y la inflación mensual del INDEC.' },
      { t: 'subtitulo', texto: 'Un producto no aparece en ninguna pestaña' },
      { t: 'p', texto: 'Puede estar **al día** (revisado hace pocos días), **inactivo**, o **sin costo cargado**. Para elegirlo igual, usá "Elegir a mano o por familia" o "Ver también los que no necesitan cambio".' },
      { t: 'subtitulo', texto: 'La lista del proveedor no reconoce mis productos' },
      { t: 'p', texto: 'El sistema cruza por el **código del proveedor** (SKU). Si nunca se cargó, enlazá los códigos una vez con "Enlazar con…" y desde la próxima lista los reconoce solo. También se puede cargar el código en la ficha de cada producto.' },
      { t: 'subtitulo', texto: 'Me equivoqué con un aumento' },
      { t: 'p', texto: 'Mirá el **historial** del producto para ver el precio anterior y volvé a ponerlo desde la ficha del producto o con el asistente (criterio porcentaje, o corrigiendo el precio a mano en la vista previa).' },
      { t: 'aviso', tono: 'info', texto: 'Los usuarios de **solo consulta** pueden ver la revisión y el análisis, pero no renovar ni cambiar precios.' },
    ],
  },
];
