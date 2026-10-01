# Facturación electrónica — puesta en marcha (etapa F9)

Todo el desarrollo está hecho y probado contra un simulador de ARCA. Para facturar de
verdad falta cargar los datos reales. **La facturación queda apagada hasta completar estos
pasos.** Hacerlos primero en homologación (pruebas) y recién después en producción.

## Antes de empezar (con el contador)

- [ ] Confirmar la **alícuota de IVA** de los productos que no sean del 21 %.
- [ ] Definir cómo se facturan las **señas**: factura por cada cobro, o una sola al final
      descontando los anticipos.
- [ ] Revisar si algún cliente grande obliga a **Factura de Crédito Electrónica MiPyME**.
- [ ] Revisar si hace falta alguna **leyenda** especial (IIBB de Formosa u otra).
- [ ] Confirmar la **condición de venta** a imprimir (contado / cuenta corriente) si la pide.
- [ ] Decidir qué pasa con los **talonarios CAI**. Los remitos siguen con CAI.

## 1. Servidor (lo hace Claude con autorización)

- [ ] **Producción:** agregar `FISCAL_KEY_SECRET` (al menos 16 caracteres al azar) y el
      volumen `./secrets:/app/secrets` en `/opt/docker/cesarbritez/docker-compose.yml`.
      Test ya lo tiene.
- [ ] **Hacer una copia segura de `FISCAL_KEY_SECRET`.** Si se pierde, la clave no se puede
      leer y hay que pedir otro certificado.
- [ ] La hora del servidor tiene que estar sincronizada (NTP). "Probar conexión" lo controla.

## 2. Homologación (ambiente de pruebas de ARCA)

1. Configuración > Facturación con ARCA: cargar CUIT, razón social, domicilio fiscal,
   Ingresos Brutos e inicio de actividades. Dejar el ambiente en **Homologación**.
2. "Generar y descargar solicitud": se descarga un `.csr`.
3. En ARCA, con clave fiscal: servicio **"WSASS – Autogestión certificados homologación"**.
   Crear el certificado pegando el contenido del `.csr` y descargar el `.crt`.
4. En WSASS, autorizar el certificado para los servicios **wsfe** y
   **ws_sr_constancia_inscripcion**.
5. Volver a Configuración y "Elegir archivo .crt" (ambiente Homologación).
6. Cargar un punto de venta online (en homologación sirve cualquier número, por ejemplo 1)
   y uno de contingencia CAEA (por ejemplo 2).
7. "Probar conexión": todo en verde. Después "Habilitar".
8. Emitir una factura B, una factura A, una nota de crédito y una nota de débito. Probar
   "Traer de ARCA" con un CUIT real, el PDF y el envío por WhatsApp. Todo sale marcado
   "COMPROBANTE DE PRUEBA".

## 3. Producción

1. **Deshabilitar** la facturación y cambiar el ambiente a **Producción**.
2. En ARCA (clave fiscal): **"Administración de certificados digitales"** → agregar alias →
   subir el **mismo** `.csr` (o generar uno nuevo) → descargar el `.crt`.
3. **"Administrador de relaciones de clave fiscal"** → nueva relación → asociar el
   certificado (computador fiscal) a **"Facturación electrónica"** (wsfe) y a **"Consulta de
   constancia de inscripción"** (ws_sr_constancia_inscripcion).
4. **"Administración de puntos de venta y domicilios"** → dar de alta:
   - un punto de venta **nuevo** con sistema **"Factura electrónica – Monotributo /
     Responsable inscripto – Web services"** (no el que se usa en Comprobantes en línea);
   - otro para **CAEA** (contingencia), si el contador lo aprueba.
5. En Configuración: cargar el `.crt` (ambiente Producción) y los dos puntos de venta.
6. "Probar conexión" con todo en verde → "Habilitar".
7. Emitir una **primera factura real de monto bajo** y verificarla en **"Mis comprobantes"**
   de ARCA y con el QR.
8. Al terminar el mes: Facturación > Libro IVA > "Controlar con ARCA" y "Descargar para el
   contador".

## Si algo falla

- **Error 600 / "No validó la firma digital":** el certificado es de otro ambiente o no está
  asociado al servicio.
- **"ya posee un TA válido":** se pidió acceso desde otro lugar con el mismo certificado. Se
  libera solo en unas horas.
- **Error 10005 / 11002:** el punto de venta no es de tipo web service o está mal cargado.
- **Error 10016:** alguien emitió con ese punto de venta por fuera del sistema. No usar el
  mismo punto de venta en Comprobantes en línea.
- **ARCA caído:** usar "Emitir en contingencia". El sistema informa solo cuando vuelve.
