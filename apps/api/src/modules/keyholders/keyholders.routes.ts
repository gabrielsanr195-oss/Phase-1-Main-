import type { FastifyPluginAsync } from 'fastify';
import { KeyholdersService } from './keyholders.service';
import {
  createKeyholderSchema,
  assignToEventSchema,
  type CreateKeyholderBody,
  type AssignToEventBody,
} from './keyholders.schema';

const keyholdersRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new KeyholdersService(fastify.db);

  fastify.post<{ Body: CreateKeyholderBody }>('/', { schema: createKeyholderSchema }, async (req, reply) => {
    if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Admin only' });
    try {
      const result = await svc.createKeyholder(req.venueId, req.body);
      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof Error && (err.message.includes('unique') || err.message.includes('duplicate'))) {
        return reply.status(409).send({ error: 'Email already in use' });
      }
      throw err;
    }
  });

  fastify.get('/', async (req, reply) => {
    if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Admin only' });
    return svc.listKeyholders(req.venueId);
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Admin only' });
    const kh = await svc.getKeyholder(req.venueId, req.params.id);
    if (!kh) return reply.status(404).send({ error: 'Keyholder not found' });
    return kh;
  });

  fastify.post<{ Params: { id: string }; Body: AssignToEventBody }>(
    '/:id/events',
    { schema: assignToEventSchema },
    async (req, reply) => {
      if (req.userRole !== 'admin') return reply.status(403).send({ error: 'Admin only' });
      const kh = await svc.getKeyholder(req.venueId, req.params.id);
      if (!kh) return reply.status(404).send({ error: 'Keyholder not found' });
      const result = await svc.assignToEvent(req.venueId, req.params.id, req.body);
      return reply.status(201).send(result);
    },
  );
};

export default keyholdersRoutes;
