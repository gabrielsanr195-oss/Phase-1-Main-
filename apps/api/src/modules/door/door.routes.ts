import type { FastifyPluginAsync } from 'fastify';
import { DoorService, DoorError } from './door.service';
import { scanSchema, type ScanBody } from './door.schema';

const doorRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new DoorService(fastify.db);

  fastify.post<{ Body: ScanBody }>('/scan', { schema: scanSchema }, async (req, reply) => {
    if (!['door', 'admin'].includes(req.userRole)) {
      return reply.status(403).send({ error: 'Door staff only' });
    }
    try {
      const result = await svc.scan(req.venueId, req.body.qrToken);
      return reply.send(result);
    } catch (err) {
      if (err instanceof DoorError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });
};

export default doorRoutes;
