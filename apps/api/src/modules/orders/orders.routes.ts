import type { FastifyInstance } from 'fastify';
import { OrdersService, OrderError } from './orders.service';
import { createOrderSchema, lookupGuestSchema } from './orders.schema';
import type { CreateOrderBody, LookupGuestBody, AdvanceOrderBody } from './orders.schema';

export default async function ordersRoutes(app: FastifyInstance) {
  const svc = new OrdersService(app.db);

  // POST /orders/lookup — validate guest QR and return guest info + pass balance
  app.post<{ Body: LookupGuestBody }>(
    '/lookup',
    { schema: lookupGuestSchema, onRequest: [app.authenticate] },
    async (req, reply) => {
      if (!['waiter', 'admin'].includes(req.user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      try {
        const { getQRPublicKey } = await import('../../utils/qr-keys');
        const { validateQR } = await import('@phase1plus/qr-lib');
        const publicKey = await getQRPublicKey();
        const payload = await validateQR(req.body.qr, publicKey);

        if (payload.venue_id !== req.venueId) {
          return reply.status(403).send({ error: 'QR belongs to a different venue' });
        }
        if (payload.type !== 'guest') {
          return reply.status(422).send({ error: 'Not a guest QR' });
        }

        return svc.lookupGuest(req.venueId, payload.sub as string);
      } catch (err) {
        if (err instanceof OrderError) return reply.status(err.statusCode).send({ error: err.message });
        return reply.status(422).send({ error: 'Invalid QR code' });
      }
    },
  );

  // POST /orders — create order with auto-split
  app.post<{ Body: CreateOrderBody }>(
    '/',
    { schema: createOrderSchema, onRequest: [app.authenticate] },
    async (req, reply) => {
      if (!['waiter', 'admin'].includes(req.user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      try {
        const orders = await svc.createOrder(req.venueId, req.user.sub, req.body);
        return reply.status(201).send(orders);
      } catch (err) {
        if (err instanceof OrderError) return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  // GET /orders?eventId=&guestEventId=&destination=&statuses=1,2
  app.get<{
    Querystring: { eventId: string; guestEventId?: string; destination?: string; statuses?: string };
  }>(
    '/',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      if (!['admin', 'waiter', 'warehouse', 'bartender'].includes(req.user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      if (!req.query.eventId) return reply.status(400).send({ error: 'eventId required' });
      const statuses = req.query.statuses
        ? req.query.statuses.split(',').map(Number).filter((n) => !isNaN(n))
        : undefined;
      return svc.listOrders(req.venueId, req.query.eventId, {
        guestEventId: req.query.guestEventId,
        destination: req.query.destination,
        statuses,
      });
    },
  );

  // PATCH /orders/:id/status — advance to next state
  app.patch<{ Params: { id: string }; Body: AdvanceOrderBody }>(
    '/:id/status',
    {
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'integer', minimum: 2, maximum: 5 } },
        },
      },
      onRequest: [app.authenticate],
    },
    async (req, reply) => {
      if (!['admin', 'waiter', 'warehouse', 'bartender'].includes(req.user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      try {
        const updated = await svc.advanceStatus(req.venueId, req.params.id, req.body.status);
        // Broadcast to all station boards watching this event
        app.io.to(`event:${updated.event_id as string}`).emit('order_updated', {
          id: updated.id as string,
          status: updated.status as number,
          event_id: updated.event_id as string,
          destination: updated.destination as string,
        });
        // On delivery (status=5), notify pass balance if WhatsApp configured
        if ((updated.status as number) === 5) {
          void svc.notifyPassBalance(req.venueId, updated.id as string).catch(() => void 0);
        }
        return updated;
      } catch (err) {
        if (err instanceof OrderError) return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );
}
