import type { FastifyPluginAsync } from 'fastify';
import { ShareLinksService } from './share-links.service';

const shareLinksPublicRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new ShareLinksService(fastify.db);

  fastify.get<{ Params: { token: string } }>('/:token', async (req, reply) => {
    const data = await svc.resolveToken(req.params.token);
    if (!data) return reply.status(404).send({ error: 'Link not found' });
    if (!data.is_active) return reply.status(410).send({ error: 'Link is no longer active' });
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return reply.status(410).send({ error: 'Link has expired' });
    }
    if (data.max_uses !== null && data.uses_count >= data.max_uses) {
      return reply.status(410).send({ error: 'Link has reached maximum uses' });
    }
    return reply.send(data);
  });
};

export default shareLinksPublicRoutes;
