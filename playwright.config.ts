import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Carga tests/.env.e2e (E2E_EMAIL / E2E_PASSWORD) si existe, para que
// `npm run test:e2e` funcione sin exportar nada a mano. Las variables ya
// definidas en el entorno tienen prioridad. Sin dependencia de dotenv (no está en
// el package.json raíz) — son dos líneas de parseo.
try {
  for (const line of readFileSync('tests/.env.e2e', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch { /* sin archivo: se espera que vengan del entorno */ }

// Requiere que la app ya esté corriendo (docker compose up -d app, o `npm run dev`).
// No la levanta este config a propósito, para no pisar el preview local que ya
// usás para verificar visualmente los cambios de responsive.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // Usa el Google Chrome instalado en el host: no hay que descargar navegadores
    // ni instalar dependencias de sistema (que necesitarían sudo). Corre nativo,
    // sin el contenedor mcr.microsoft.com/playwright.
    channel: 'chrome',
  },
  // Un proyecto por breakpoint — cada uno corre la misma spec completa.
  projects: [
    { name: '375px',  use: { viewport: { width: 375,  height: 812 } } },
    { name: '768px',  use: { viewport: { width: 768,  height: 1024 } } },
    { name: '1440px', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
