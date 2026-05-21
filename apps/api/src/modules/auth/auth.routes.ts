import type { FastifyPluginAsync } from 'fastify';
import type { UserRole } from '@phase1plus/types';
import { AuthService, AuthError } from './auth.service';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  type RegisterBody,
  type LoginBody,
  type RefreshBody,
  type LogoutBody,
} from './auth.schema';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService(fastify.db, fastify.redis);

  // POST /auth/register  — creates venue + admin user
  fastify.post<{ Body: RegisterBody }>('/register', { schema: registerSchema }, async (req, reply) => {
    try {
      const user = await authService.register(req.body);

      const accessToken = fastify.jwt.sign({
        sub: user.id,
        venue_id: user.venueId,
        role: user.role as UserRole,
      });

      const refreshToken = await authService.storeRefreshToken(user.id, user.venueId);

      return reply.status(201).send({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as UserRole,
          venueId: user.venueId,
        },
      });
    } catch (err) {
      if (err instanceof Error && (err.message.includes('unique') || err.message.includes('duplicate'))) {
        return reply.status(409).send({ error: 'Email or venue slug already in use' });
      }
      throw err;
    }
  });

  // POST /auth/login
  fastify.post<{ Body: LoginBody }>('/login', { schema: loginSchema }, async (req, reply) => {
    try {
      const user = await authService.login(req.body);

      const accessToken = fastify.jwt.sign({
        sub: user.id,
        venue_id: user.venueId,
        role: user.role as UserRole,
      });

      const refreshToken = await authService.storeRefreshToken(user.id, user.venueId);

      return reply.send({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as UserRole,
          venueId: user.venueId,
        },
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /auth/refresh  — issue new access token from refresh token
  fastify.post<{ Body: RefreshBody }>('/refresh', { schema: refreshSchema }, async (req, reply) => {
    try {
      const { userId } = await authService.verifyRefreshToken(req.body.refreshToken);

      const userResult = await fastify.db.query<{
        id: string;
        venue_id: string;
        role: string;
        is_active: boolean;
      }>(
        `SELECT id, venue_id, role, is_active FROM users WHERE id = $1`,
        [userId],
      );

      const user = userResult.rows[0];
      if (!user || !user.is_active) {
        return reply.status(401).send({ error: 'User not found or inactive' });
      }

      const accessToken = fastify.jwt.sign({
        sub: user.id,
        venue_id: user.venue_id,
        role: user.role as UserRole,
      });

      return reply.send({ accessToken });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /auth/logout  — revoke refresh token
  fastify.post<{ Body: LogoutBody }>('/logout', { schema: logoutSchema }, async (req, reply) => {
    if (req.body.refreshToken) {
      await authService.revokeRefreshToken(req.body.refreshToken);
    }
    return reply.status(204).send();
  });
};

export default authRoutes;
