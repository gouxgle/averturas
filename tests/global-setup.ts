import { request } from '@playwright/test';

// Un único login para TODA la corrida. Corre en el proceso principal antes de que
// arranquen los workers, y process.env se hereda a cada worker. Sin esto, cada
// worker hacía su propio login y con 3 breakpoints × N workers se pasaba del rate
// limit global de /api/auth/* (10 por minuto por IP): 30 de 54 tests en 429.
export default async function globalSetup() {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error('Faltan E2E_EMAIL / E2E_PASSWORD (ver tests/README.md).');
  }
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', { data: { email, password } });
  if (!res.ok()) throw new Error(`Login de setup falló: ${res.status()} ${await res.text()}`);
  process.env.E2E_TOKEN = (await res.json() as { token: string }).token;
  await ctx.dispose();
}
