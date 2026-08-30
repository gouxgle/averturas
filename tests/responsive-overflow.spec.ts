import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { login } from './auth';
import { MAIN_ROUTES, slug } from './routes';

// Falla si el contenido es más ancho que el viewport (desborde horizontal),
// incluso si el `overflow-x: hidden` global de index.css lo está tapando
// visualmente — es justo el tipo de bug silencioso que esto quiere atrapar.
// Guarda un screenshot full-page en tests/screenshots/ en cada corrida,
// pase o falle el assert, para poder inspeccionar el layout real.
async function checkNoOverflow(page: Page, testInfo: TestInfo, name: string) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Viewport no configurado para este proyecto de Playwright');

  // Deja asentar spinners/skeletons antes de medir.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);

  await page.screenshot({
    path: `tests/screenshots/${testInfo.project.name}--${name}.png`,
    fullPage: true,
  });

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(
    scrollWidth,
    `document.documentElement.scrollWidth (${scrollWidth}px) supera el viewport (${viewport.width}px) en ${testInfo.project.name} — hay desborde horizontal`
  ).toBeLessThanOrEqual(viewport.width);
}

test.describe('Desborde horizontal por breakpoint', () => {
  test('login (sin autenticar)', async ({ page }, testInfo) => {
    await page.goto('/login');
    await checkNoOverflow(page, testInfo, 'login');
  });

  test.describe('rutas autenticadas', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    for (const { label, path } of MAIN_ROUTES) {
      test(`${label} (${path})`, async ({ page }, testInfo) => {
        await page.goto(path);
        await checkNoOverflow(page, testInfo, slug(path));
      });
    }
  });
});
