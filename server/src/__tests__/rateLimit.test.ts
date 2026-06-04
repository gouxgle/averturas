import { describe, it, expect, vi, beforeEach } from 'vitest';

// Lógica extraída del rate limiter para testear sin Hono
interface Bucket { count: number; resetAt: number }

function createRateLimiter(max: number, windowMs: number) {
  const store = new Map<string, Bucket>();

  return function check(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let bucket = store.get(ip);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      store.set(ip, bucket);
    }
    bucket.count++;
    const allowed = bucket.count <= max;
    const remaining = Math.max(0, max - bucket.count);
    return { allowed, remaining };
  };
}

describe('RateLimiter', () => {
  it('permite requests dentro del límite', () => {
    const check = createRateLimiter(5, 60_000);
    for (let i = 0; i < 5; i++) {
      expect(check('1.2.3.4').allowed).toBe(true);
    }
  });

  it('bloquea al superar el límite', () => {
    const check = createRateLimiter(3, 60_000);
    check('1.2.3.4');
    check('1.2.3.4');
    check('1.2.3.4');
    expect(check('1.2.3.4').allowed).toBe(false);
  });

  it('decrementa remaining correctamente', () => {
    const check = createRateLimiter(5, 60_000);
    expect(check('1.2.3.4').remaining).toBe(4);
    expect(check('1.2.3.4').remaining).toBe(3);
    expect(check('1.2.3.4').remaining).toBe(2);
  });

  it('IPs distintas no se afectan entre sí', () => {
    const check = createRateLimiter(2, 60_000);
    check('1.1.1.1');
    check('1.1.1.1');
    // ip1 bloqueada
    expect(check('1.1.1.1').allowed).toBe(false);
    // ip2 no afectada
    expect(check('2.2.2.2').allowed).toBe(true);
  });

  it('resetea el contador al vencer la ventana', () => {
    vi.useFakeTimers();
    const check = createRateLimiter(2, 1000);

    check('1.2.3.4');
    check('1.2.3.4');
    expect(check('1.2.3.4').allowed).toBe(false);

    // Avanzar más de 1 segundo (ventana expirada)
    vi.advanceTimersByTime(1100);
    expect(check('1.2.3.4').allowed).toBe(true);

    vi.useRealTimers();
  });

  it('remaining es 0 cuando está bloqueado', () => {
    const check = createRateLimiter(1, 60_000);
    check('1.2.3.4');
    expect(check('1.2.3.4').remaining).toBe(0);
  });
});
