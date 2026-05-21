import type { FastifyPluginAsync } from 'fastify';
import { GuestsService, RegistrationError } from './guests.service';
import { guestRegistrationSchema, type GuestRegistrationBody } from './guests.schema';

const guestRegistrationRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new GuestsService(fastify.db);

  fastify.post<{ Params: { token: string }; Body: GuestRegistrationBody }>(
    '/:token',
    { schema: guestRegistrationSchema },
    async (req, reply) => {
      try {
        const result = await svc.registerViaShareLink(req.params.token, req.body);
        if (result.alreadyRegistered) {
          return reply.status(200).send({ ...result.guestEvent, alreadyRegistered: true });
        }
        return reply.status(201).send(result.guestEvent);
      } catch (err) {
        if (err instanceof RegistrationError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );
};

export default guestRegistrationRoutes;
