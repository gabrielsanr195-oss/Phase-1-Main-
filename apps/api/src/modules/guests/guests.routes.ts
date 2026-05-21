import type { FastifyPluginAsync } from 'fastify';
import { GuestsService } from './guests.service';
import { updateGuestStatusSchema, type UpdateGuestStatusBody } from './guests.schema';
import { KeyholdersService } from '../keyholders/keyholders.service';

const guestsRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new GuestsService(fastify.db);
  const khSvc = new KeyholdersService(fastify.db);

  fastify.get<{ Querystring: { eventId: string } }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['eventId'],
          properties: { eventId: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      if (req.userRole === 'admin') {
        return svc.listGuestEvents(req.venueId, req.query.eventId);
      }
      if (req.userRole === 'keyholder') {
        const kh = await khSvc.getKeyholderByUserId(req.venueId, req.userId);
        if (!kh) return reply.status(403).send({ error: 'Keyholder profile not found' });
        return svc.listGuestEvents(req.venueId, req.query.eventId, kh.id);
      }
      return reply.status(403).send({ error: 'Admin or keyholder only' });
    },
  );

  fastify.patch<{ Params: { id: string }; Body: UpdateGuestStatusBody }>(
    '/:id/status',
    { schema: updateGuestStatusSchema },
    async (req, reply) => {
      if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Admin only' });
      const updated = await svc.updateGuestEventStatus(req.venueId, req.params.id, req.body);
      if (!updated) return reply.status(404).send({ error: 'Guest event not found' });
      return updated;
    },
  );
};

export default guestsRoutes;
