import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production',
});
