import type { Page } from '@playwright/test';

// La app guarda el token en sessionStorage (no en cookies/localStorage), así que
// el storageState de Playwright no sirve para reusar sesión entre tests — hay que
// loguearse por UI en cada test. sessionStorage sí persiste entre navegaciones
// dentro de la misma `page`, así que esto solo corre una vez por test.
export async function login(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Faltan credenciales de test: definí E2E_EMAIL y E2E_PASSWORD ' +
      '(usuario válido del sistema) antes de correr `npm run test:e2e`.'
    );
  }

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}
