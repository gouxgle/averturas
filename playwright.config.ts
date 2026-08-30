import { defineConfig } from '@playwright/test';

// Requiere que la app ya esté corriendo (docker compose up -d app, o `npm run dev`).
// No la levanta este config a propósito, para no pisar el preview local que ya
// usás para verificar visualmente los cambios de responsive.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  // Un proyecto por breakpoint — cada uno corre la misma spec completa.
  projects: [
    { name: '375px',  use: { viewport: { width: 375,  height: 812 } } },
    { name: '768px',  use: { viewport: { width: 768,  height: 1024 } } },
    { name: '1440px', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
