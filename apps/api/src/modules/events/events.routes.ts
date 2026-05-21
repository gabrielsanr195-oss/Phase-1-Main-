import type { FastifyPluginAsync } from 'fastify';
import { EventsService } from './events.service';
import { KeyholdersService } from '../keyholders/keyholders.service';
import {
  createEventSchema,
  createPassTierSchema,
  type CreateEventBody,
  type CreatePassTierBody,
} from './events.schema';

const PHASE_ORDER = ['phase_0', 'phase_1', 'phase_2', 'phase_3', 'phase_4', 'closed'];

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new EventsService(fastify.db);
  const khSvc = new KeyholdersService(fastify.db);

  fastify.post<{ Body: CreateEventBody }>('/', { schema: createEventSchema }, async (req, reply) => {
    if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Admin only' });
    const event = await svc.createEvent(req.venueId, req.userId, req.body);
    return reply.status(201).send(event);
  });

  fastify.get('/', async (req) => {
    if (req.userRole === 'keyholder') {
      const kh = await khSvc.getKeyholderByUserId(req.venueId, req.userId);
      if (!kh) return [];
      return svc.listEventsForKeyholder(req.venueId, kh.id as string);
    }
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

  fastify.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/:id/status',
    {
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: { status: { type: 'string', enum: PHASE_ORDER } },
        },
      },
    },
    async (req, reply) => {
      if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Admin only' });
      const event = await svc.getEvent(req.venueId, req.params.id);
      if (!event) return reply.status(404).send({ error: 'Event not found' });

      const currentIdx = PHASE_ORDER.indexOf(event.status as string);
      const nextIdx = PHASE_ORDER.indexOf(req.body.status);
      if (nextIdx !== currentIdx + 1) {
        return reply.status(422).send({ error: `Invalid transition: ${event.status as string} → ${req.body.status}` });
      }
      if (req.body.status === 'closed' && !event.inventory_audit_done) {
        return reply.status(422).send({ error: 'Inventory audit must be completed before closing the event' });
      }

      const updated = await svc.advanceStatus(req.venueId, req.params.id, req.body.status);
      return updated;
    },
  );
};

export default eventsRoutes;
