import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { Pool } from 'pg';
import { config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
  });

  await pool.query('SELECT 1');
  fastify.log.info('PostgreSQL connected');

  fastify.decorate('db', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
    fastify.log.info('PostgreSQL pool closed');
  });
};

export default fp(databasePlugin, { name: 'database' });
