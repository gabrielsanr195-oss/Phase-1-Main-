import type { FastifyPluginAsync } from 'fastify';
import { ShareLinksService } from './share-links.service';
import { createShareLinkSchema, type CreateShareLinkBody } from './share-links.schema';
import { KeyholdersService } from '../keyholders/keyholders.service';

const shareLinksRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new ShareLinksService(fastify.db);
  const khSvc = new KeyholdersService(fastify.db);

  fastify.post<{ Body: CreateShareLinkBody }>('/', { schema: createShareLinkSchema }, async (req, reply) => {
    if (req.userRole !== 'keyholder' && req.userRole !== 'admin') {
      return reply.status(403).send({ error: 'Keyholder or admin only' });
    }

    const kh = await khSvc.getKeyholderByUserId(req.venueId, req.userId);
    if (!kh) return reply.status(404).send({ error: 'Keyholder profile not found' });

    const assignmentResult = await fastify.db.query(
      `SELECT id FROM keyholder_events WHERE keyholder_id = $1 AND event_id = $2 AND is_active = true`,
      [kh.id, req.body.eventId],
    );
    if (assignmentResult.rows.length === 0) {
      return reply.status(403).send({ error: 'Not assigned to this event' });
    }

    const link = await svc.createShareLink(req.venueId, kh.id, req.body);
    return reply.status(201).send(link);
  });

  fastify.get('/', async (req) => {
    if (req.userRole === 'admin') {
      return svc.listShareLinks(req.venueId);
    }
    const kh = await khSvc.getKeyholderByUserId(req.venueId, req.userId);
    if (!kh) return [];
    return svc.listShareLinks(req.venueId, kh.id);
  });
};

export default shareLinksRoutes;
