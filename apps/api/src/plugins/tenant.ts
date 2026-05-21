import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { UserRole } from '@phase1plus/types';

declare module 'fastify' {
  interface FastifyRequest {
    venueId: string;
    userId: string;
    userRole: UserRole;
  }
}

/**
 * Registers an onRequest hook that extracts venue_id / user metadata from the
 * verified JWT and places them on the request object. Every protected route
 * registered AFTER this plugin will automatically have request.venueId,
 * request.userId, and request.userRole available — no per-route lookup needed.
 *
 * Immovable rule: venue_id always comes from the token, never from the request body.
 */
const tenantPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
      const { sub, venue_id, role } = request.user;

      if (!venue_id) {
        return reply.status(401).send({ error: 'Missing venue context in token' });
      }

      request.venueId = venue_id;
      request.userId = sub;
      request.userRole = role;
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
};

export default fp(tenantPlugin, { name: 'tenant', dependencies: ['auth'] });
