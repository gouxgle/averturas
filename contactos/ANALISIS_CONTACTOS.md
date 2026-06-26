# Análisis Contactos — CONTACTOS AL 04-06-2026.pdf

**Fecha análisis:** 2026-06-24  
**Archivo fuente:** `CONTACTOS AL  04-06-2026.pdf` (52 páginas)  
**Total estimado:** ~1.500 contactos  
**Estado:** PENDIENTE DE IMPORTACIÓN — no incorporado aún al sistema

---

## Columnas del PDF

| Campo | Notas |
|---|---|
| Apellido y Nombre | A veces alias, nombre de rol o incompleto |
| Teléfono 1 | Campo principal WhatsApp |
| EFON | Teléfono alternativo (pocos casos) |
| Email | Muy pocos tienen email |
| Etiqueta | Clasificación CRM del origen |

---

## Distribución por Etiqueta

| Etiqueta | Aprox. | Prioridad importación |
|---|---|---|
| Contacto Frío (sin actividad reciente) | ~450 | Media — campaña reactivación |
| Sin etiqueta | ~300 | Revisar antes de importar |
| LEAD "Preguntar nombre y apellido" LEAD N° | ~280 | Número válido, sin nombre — pendiente |
| Nunca compro | ~150 | Prospecto frío |
| Clientes Antiguos | ~130 | ALTA |
| Proveedores | ~90 | Importar como proveedor, NO cliente |
| CV Xxxxx (descartados) | ~80 | NO IMPORTAR |
| NO CONTACTAR / descartado | ~60 | NO IMPORTAR |
| Cliente Fiel (compró y volvería) | ~30 | MÁXIMA |
| Cliente Satisfecho | ~30 | MÁXIMA |
| Clientes Activos | ~15 | MÁXIMA |
| Interesado / En Pausa | ~15 | Alta, con seguimiento |
| Cliente Conflictivo | ~8 | Importar con nota de advertencia |
| Arquitectos | ~5 | Importar como segmento propio |
| Prospectos | ~5 | Alta |

---

## Formato de Teléfonos

**Formato estándar del archivo:** `+54 9 3704 XXXXXX`

Para importar al sistema el campo `telefono` debe quedar: `"3704 XXXXXX"` (sin el `+549` inicial)

### Prefijos presentes

| Prefijo | Zona | % aprox |
|---|---|---|
| +5493704XXXXXX | Formosa ciudad | ~80% |
| +5493705XXXXXX | Formosa provincia | ~5% |
| +54937183716XXXXXX | Zona Formosa | ~3% |
| +549113XXXXXXXX | CABA / GBA | ~4% |
| +54936243625XXXXXX | Resistencia / Chaco | ~2% |
| Otros (+54 9 34XX, 35XX, etc.) | Corrientes, Misiones, Rosario | ~6% |

### Números inválidos detectados (NO importar)

| Contacto | Número | Problema |
|---|---|---|
| Alan | +54924735130082015 | Demasiado largo (tipeo) |
| Raquel | +549595982572165 | Demasiado largo |
| valenzuela luis | +549595986969611 | Demasiado largo |
| Gomez Alejandro | +5492473704582328 | Demasiado largo |
| González Javier | +5492473704641675 | Demasiado largo |
| El Plomero | +4944438157 | Fijo sin código país |
| Herrajes cabezon | +4944443095 | Fijo sin código país |
| Empresa (fijo) | +4944451666 | Fijo sin código país |
| Contacto S.A. dueño | +4521446 | Muy corto, sin código |
| Bomberos | +549100 | Emergencia, no cliente |
| Policía | +549101 | Emergencia, no cliente |
| Defensa Civil | +549103 | Emergencia, no cliente |
| Prefectura | +549106 | Emergencia, no cliente |
| Emergencias Méd. | +549107 | Emergencia, no cliente |
| Emergencias | +549911 | Emergencia, no cliente |
| Posnet / Prisma | +54908109997676 / +54908103330300 | Servicio posnet |
| Acosta Luis | — | Etiqueta "Nº no existente" |

---

## Problemas de Calidad de Datos

### 1. Grupo "CV" — NO importar
~80 contactos con nombre "CV Juan", "CV Romina", "Cv Carlos", etc., todos con etiqueta "No Contactar (descartado)".  
Son candidatos a empleo capturados en el mismo CRM. Bloque completo a descartar.

### 2. LEADs sin nombre (~280)
Registrados como "Preguntar nombre y apellido LEAD 1" hasta LEAD 272+.  
Tienen número celular formoseño válido pero nombre real desconocido.  
**Decisión pendiente:** ¿importar como "Lead NNN" y completar después, o identificar primero?

### 3. Email genérico repetido
`cesarbritezdrive@gmail.com` aparece en ~5 contactos distintos (Aberturas 5, Aberturas Corrientes, Aberturas LDO, Abi, Centurion Lomitas).  
Parece email del local/dueño usado como placeholder. **No usar como email del cliente.**

### 4. Nombres alias / roles / sin apellido
Ejemplos: "Don Albañil", "El Plomero", "Flete don José", "Dr Pablo", "Sra Camioneta", "Técnico Split Titino", "Juan agua", "Tu agua".  
Importar con nota, completar nombre real después.

### 5. Duplicados detectados
- Sosa Daniel: `+5493704542812` aparece dos veces
- Falcón Carolina: `+5493704083499` y `+5493705083499` (posible error de prefijo)
- Liliana 230 / Liliana 3704-220205: mismo número `+5493704220205`  
**Recomendado:** antes de importar, detectar duplicados por número normalizado.

---

## Plan de Importación (3 etapas)

### Etapa 1 — Prioridad máxima (~200 contactos)
Clientes Activos + Fiel + Satisfecho + Clientes Antiguos + Interesados + Prospectos  
→ Importar a mano o por lote pequeño, con nombre completo verificado

### Etapa 2 — Lote masivo (~700 contactos)
Contacto Frío + Nunca compro + Sin etiqueta (con nombre real)  
→ Requiere script de importación o carga por CSV

### Etapa 3 — LEADs pendientes (~280)
Solo número, nombre a completar  
→ Importar con nombre "Lead NNN" y marcar como pendiente de identificación

### Etapa 4 — Proveedores (~90)
Importar separados como proveedores (no clientes)

### NO importar (~350 total)
- CV descartados (~80)
- NO CONTACTAR + descartados (~60)
- Emergencias / Posnet / servicios (~10)
- Números inválidos largos/cortos (~10)
- Cliente Conflictivo: evaluar caso a caso

---

## Preguntas a resolver antes de importar

1. ¿Los ~280 LEADs sin nombre se importan como "Lead NNN" o se esperan identificar primero?
2. ¿Los ~150 "Nunca compro" entran en alguna campaña de reactivación o se descartan?
3. El email `cesarbritezdrive@gmail.com` — ¿confirmás que es del local? Limpiar de clientes individuales.
4. ¿Se necesita un script CSV de importación masiva o se carga a mano?
5. ¿Los Proveedores van a la tabla `proveedores` del sistema o también como clientes?

---

## Notas técnicas para importación

- Campo `telefono` en DB: guardar sin `+549`, formato `"3704 XXXXXX"`
- Prefijos distintos: guardar completo el prefijo real (ej: `"11 12345678"` para CABA)
- Origen sugerido para todos: `"Base WhatsApp"` o `"Importación CRM"`
- Estado: `activo` por defecto
- Etiqueta CRM del PDF → mapear a campo `crm_etapa` o `notas` del sistema
