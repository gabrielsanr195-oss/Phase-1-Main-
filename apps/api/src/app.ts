import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config';
import databasePlugin from './plugins/database';
import redisPlugin from './plugins/redis';
import authPlugin from './plugins/auth';
import authRoutes from './modules/auth/auth.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: config.LOG_LEVEL,
            transport:
              config.NODE_ENV === 'development'
                ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
                : undefined,
          },
  });

  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? config.CORS_ORIGIN : true,
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(databasePlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);

  app.get('/health', async () => ({
    status: 'ok',
    ts: new Date().toISOString(),
    env: config.NODE_ENV,
  }));

  await app.register(authRoutes, { prefix: '/auth' });

  return app;
}
