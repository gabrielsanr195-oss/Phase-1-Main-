import type { FastifyInstance } from 'fastify';
import { ProductsService, ProductError } from './products.service';
import { createProductSchema, addPassTierItemSchema } from './products.schema';
import type { CreateProductBody, AddPassTierItemBody } from './products.schema';

export default async function productsRoutes(app: FastifyInstance) {
  const svc = new ProductsService(app.db);

  // GET /products — list venue products
  app.get('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!['admin', 'waiter', 'warehouse', 'bartender'].includes(req.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    return svc.listProducts(req.venueId);
  });

  // POST /products — create product (admin only)
  app.post<{ Body: CreateProductBody }>(
    '/',
    { schema: createProductSchema, onRequest: [app.authenticate] },
    async (req, reply) => {
      if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
      return reply.status(201).send(await svc.createProduct(req.venueId, req.body));
    },
  );

  // GET /products/pass-tiers/:tierId/items
  app.get<{ Params: { tierId: string } }>(
    '/pass-tiers/:tierId/items',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      if (!['admin', 'waiter'].includes(req.user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      return svc.listPassTierItems(req.venueId, req.params.tierId);
    },
  );

  // POST /products/pass-tiers/:tierId/items
  app.post<{ Params: { tierId: string }; Body: AddPassTierItemBody }>(
    '/pass-tiers/:tierId/items',
    { schema: addPassTierItemSchema, onRequest: [app.authenticate] },
    async (req, reply) => {
      if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
      try {
        return reply.status(201).send(
          await svc.addPassTierItem(req.venueId, req.params.tierId, req.body),
        );
      } catch (err) {
        if (err instanceof ProductError) return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  // DELETE /products/pass-tiers/:tierId/items/:productId
  app.delete<{ Params: { tierId: string; productId: string } }>(
    '/pass-tiers/:tierId/items/:productId',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      if (req.user.role !== 'admin') return reply.status(403).send({ error: 'Forbidden' });
      await svc.removePassTierItem(req.venueId, req.params.tierId, req.params.productId);
      return reply.status(204).send();
    },
  );
}
