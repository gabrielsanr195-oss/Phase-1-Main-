import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fjwt from '@fastify/jwt';
import { config } from '../config';
import type { JWTPayload, UserRole } from '@phase1plus/types';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: Omit<JWTPayload, 'iat' | 'exp'>;
    user: {
      sub: string;
      venue_id: string;
      role: UserRole;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fjwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_ACCESS_EXPIRES },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
};

export default fp(authPlugin, { name: 'auth' });
