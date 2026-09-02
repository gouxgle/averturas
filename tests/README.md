# Tests end-to-end (Playwright)

## Usuario fijo de pruebas — solo en la DB local

En vez de crear y borrar un usuario descartable en cada corrida (que era lo que se
venía haciendo, con un `bcrypt.hashSync` + INSERT + DELETE por tarea), la DB local
tiene un usuario permanente:

```
e2e@local.test / E2e-Local-2026!
```

**Vive solo en la base local.** No está en ninguna migración, así que nunca llega a
test ni a producción. Si se borra la DB local, se recrea con:

```bash
cd /home/sistemas/claude/aberturas
HASH=$(cd server && node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'E2e-Local-2026!')
docker compose exec -T db psql -U postgres -d postgres -c \
  "INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
   VALUES ('e2e@local.test', '$HASH', 'E2E', 'admin', true)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;"
```

Las credenciales se pasan por `tests/.env.e2e` (ignorado por git), no por línea de
comandos: el clasificador de seguridad bloquea comandos con contraseñas literales.

## Correr los tests

```bash
docker run --rm --network host -v "$PWD":/w -w /w --env-file tests/.env.e2e \
  mcr.microsoft.com/playwright:v1.62.1-noble npx playwright test --workers=1
```

Filtrar una ruta: agregar `-g 'Productos'`.

El rate limit de login está en 500 intentos en local (`LOGIN_RATE_LIMIT` en `.env`),
así que ya no hace falta reiniciar el contenedor a mitad de una corrida.

## Cuándo vale la pena sacar screenshots

Solo cuando el riesgo es visual y el typecheck no lo puede ver:

- cambios de layout/responsive, pantallas nuevas, modales anidados (z-index);
- cuando algo se superpone, desborda o depende del ancho.

**No** para renames de labels, cambios de texto, lógica de negocio ni queries: ahí
alcanza con typecheck + build, y si toca datos, una verificación por SQL o API.
