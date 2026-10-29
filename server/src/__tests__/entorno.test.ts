import { describe, it, expect } from 'vitest';
import { entornoDe } from '../routes/pub.js';

describe('entornoDe (badge de entorno según APP_URL)', () => {
  it('test en el VPS de prod no se confunde con producción', () => {
    expect(entornoDe('https://test.cesarbritez.com.ar')).toBe('test');
    expect(entornoDe('https://aberturas.cesarbritez.com.ar')).toBe('produccion');
  });
  it('el test viejo sigue siendo test', () => {
    expect(entornoDe('https://aberturas.solucionesgps.com.ar')).toBe('test');
  });
  it('sin APP_URL o localhost es local', () => {
    expect(entornoDe(undefined)).toBe('local');
    expect(entornoDe('http://localhost:3000')).toBe('local');
    expect(entornoDe('no es una url')).toBe('local');
  });
});
