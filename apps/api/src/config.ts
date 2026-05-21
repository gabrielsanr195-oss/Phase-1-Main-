import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalNumber(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

function nodeEnv() {
  const val = optional('NODE_ENV', 'development');
  if (!['development', 'staging', 'production', 'test'].includes(val)) {
    throw new Error(`Invalid NODE_ENV: ${val}`);
  }
  return val as 'development' | 'staging' | 'production' | 'test';
}

export const config = {
  PORT: optionalNumber('PORT', 3000),
  NODE_ENV: nodeEnv(),
  LOG_LEVEL: optional('LOG_LEVEL', 'info'),
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_ACCESS_EXPIRES: optional('JWT_ACCESS_EXPIRES', '15m'),
  JWT_REFRESH_EXPIRES_DAYS: optionalNumber('JWT_REFRESH_EXPIRES_DAYS', 30),
  CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:5173'),
  QR_PRIVATE_KEY_PATH: optional('QR_PRIVATE_KEY_PATH', './keys/private.pem'),
  QR_PUBLIC_KEY_PATH: optional('QR_PUBLIC_KEY_PATH', './keys/public.pem'),
} as const;
