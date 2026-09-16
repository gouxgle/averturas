import type { Page } from '@playwright/test';

// La app guarda el token en sessionStorage (no en cookies/localStorage), así que el
// storageState de Playwright no sirve. Antes se logueaba por UI en cada test
// (formulario + bcrypt + redirect): 3-5 s por test, y con varios workers en
// paralelo el waitForURL de 15 s se pasaba seguido — flake real, visto dos días
// seguidos. Ahora: un POST a /api/auth/login (≈200 ms) y se inyecta el token en
// sessionStorage ANTES de que cargue la app, con addInitScript. Cero formulario.
//
// El token se cachea por proceso: N tests del mismo worker = 1 login.
let tokenCache: string | null = null;

export async function login(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Faltan credenciales de test: definí E2E_EMAIL y E2E_PASSWORD ' +
      '(usuario válido del sistema) antes de correr `npm run test:e2e`.'
    );
  }

  // Preferir el token que globalSetup dejó en process.env (un solo login por
  // corrida). El POST directo queda como fallback para usar login() fuera de la
  // suite (p.ej. un spec suelto corrido sin config).
  if (!tokenCache) {
    tokenCache = process.env.E2E_TOKEN ?? null;
  }
  if (!tokenCache) {
    const res = await page.request.post('/api/auth/login', { data: { email, password } });
    if (!res.ok()) throw new Error(`Login API falló: ${res.status()} ${await res.text()}`);
    tokenCache = (await res.json() as { token: string }).token;
  }

  const token = tokenCache;
  await page.addInitScript((t: string) => {
    try { sessionStorage.setItem('aberturas_token', t); } catch { /* sin storage */ }
  }, token);
}
