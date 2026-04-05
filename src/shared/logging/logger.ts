import pino from 'pino';

export const logger = pino(
  {
    base: null,
    level: process.env.LOG_LEVEL ?? 'info',
  },
  process.stderr,
);
