import type { FastifyPluginAsync } from 'fastify';
import { GuestsService, RegistrationError } from './guests.service';
import { guestRegistrationSchema, type GuestRegistrationBody } from './guests.schema';

const guestRegistrationRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new GuestsService(fastify.db);

  // GET /register/:token/status?phone=xxx — public: guest checks own registration
  fastify.get<{ Params: { token: string }; Querystring: { phone: string } }>(
    '/:token/status',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['phone'],
          properties: { phone: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const result = await fastify.db.query(
        `SELECT ge.id, ge.status, ge.qr_token, ge.invitation_expires_at, ge.confirmed_at, ge.paid_at,
                g.first_name, g.last_name,
                e.name as event_name, e.event_date,
                pt.name as tier_name, pt.price, pt.currency
         FROM share_links sl
         JOIN events e ON e.id = sl.event_id
         JOIN guests g ON g.venue_id = e.venue_id AND g.phone = $2
         JOIN guest_events ge ON ge.guest_id = g.id AND ge.event_id = e.id
         LEFT JOIN pass_tiers pt ON pt.id = ge.pass_tier_id
         WHERE sl.token = $1`,
        [req.params.token, req.query.phone],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'No registration found for this phone number' });
      }
      return reply.send(result.rows[0]);
    },
  );

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
