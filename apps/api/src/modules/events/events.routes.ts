import type { FastifyPluginAsync } from 'fastify';
import { EventsService } from './events.service';
import {
  createEventSchema,
  createPassTierSchema,
  type CreateEventBody,
  type CreatePassTierBody,
} from './events.schema';

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new EventsService(fastify.db);

  fastify.post<{ Body: CreateEventBody }>('/', { schema: createEventSchema }, async (req, reply) => {
    if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Admin only' });
    const event = await svc.createEvent(req.venueId, req.userId, req.body);
    return reply.status(201).send(event);
  });

  fastify.get('/', async (req) => {
    return svc.listEvents(req.venueId);
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const event = await svc.getEvent(req.venueId, req.params.id);
    if (!event) return reply.status(404).send({ error: 'Event not found' });
    return event;
  });

  fastify.post<{ Params: { id: string }; Body: CreatePassTierBody }>(
    '/:id/pass-tiers',
    { schema: createPassTierSchema },
    async (req, reply) => {
      if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Admin only' });
      const event = await svc.getEvent(req.venueId, req.params.id);
      if (!event) return reply.status(404).send({ error: 'Event not found' });
      const tier = await svc.createPassTier(req.venueId, req.params.id, req.body);
      return reply.status(201).send(tier);
    },
  );

  fastify.get<{ Params: { id: string } }>('/:id/pass-tiers', async (req, reply) => {
    const event = await svc.getEvent(req.venueId, req.params.id);
    if (!event) return reply.status(404).send({ error: 'Event not found' });
    return svc.listPassTiers(req.venueId, req.params.id);
  });
};

export default eventsRoutes;
