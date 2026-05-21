import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config';
import databasePlugin from './plugins/database';
import redisPlugin from './plugins/redis';
import authPlugin from './plugins/auth';
import tenantPlugin from './plugins/tenant';
import authRoutes from './modules/auth/auth.routes';
import eventsRoutes from './modules/events/events.routes';
import keyholdersRoutes from './modules/keyholders/keyholders.routes';
import shareLinksRoutes from './modules/share-links/share-links.routes';
import shareLinksPublicRoutes from './modules/share-links/share-links-public.routes';
import guestsRoutes from './modules/guests/guests.routes';
import guestRegistrationRoutes from './modules/guests/guests-public.routes';
import doorRoutes from './modules/door/door.routes';

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

  // ── Public routes (no auth required) ─────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(guestRegistrationRoutes, { prefix: '/register' });
  await app.register(shareLinksPublicRoutes, { prefix: '/share-links' });

  // ── Protected routes (tenant context applied via onRequest hook) ──────────────
  await app.register(async function protectedScope(inner) {
    await inner.register(tenantPlugin);
    await inner.register(eventsRoutes, { prefix: '/events' });
    await inner.register(keyholdersRoutes, { prefix: '/keyholders' });
    await inner.register(shareLinksRoutes, { prefix: '/share-links' });
    await inner.register(guestsRoutes, { prefix: '/guests' });
    await inner.register(doorRoutes, { prefix: '/door' });
  });

  return app;
}
