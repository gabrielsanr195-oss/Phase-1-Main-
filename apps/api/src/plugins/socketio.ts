import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import { config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

export default fp(async function socketioPlugin(app: FastifyInstance) {
  const io = new Server(app.server, {
    cors: {
      origin: config.NODE_ENV === 'production' ? config.CORS_ORIGIN : '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join_event', (eventId: string) => {
      void socket.join(`event:${eventId}`);
    });
    socket.on('leave_event', (eventId: string) => {
      void socket.leave(`event:${eventId}`);
    });
  });

  app.decorate('io', io);

  app.addHook('onClose', (_, done) => {
    io.close(() => done());
  });
});
