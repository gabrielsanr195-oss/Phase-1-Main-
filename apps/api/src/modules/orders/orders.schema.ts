import type { FastifySchema } from 'fastify';

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface CreateOrderBody {
  guestEventId: string;
  eventId: string;
  items: OrderItem[];
  tableRef?: string;
  notes?: string;
}

export interface LookupGuestBody {
  qr: string;
}

export interface AdvanceOrderBody {
  status: number;
}

export const createOrderSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['guestEventId', 'eventId', 'items'],
    properties: {
      guestEventId: { type: 'string', format: 'uuid' },
      eventId: { type: 'string', format: 'uuid' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1 },
          },
        },
      },
      tableRef: { type: 'string' },
      notes: { type: 'string' },
    },
  },
};

export const lookupGuestSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['qr'],
    properties: {
      qr: { type: 'string', minLength: 10 },
    },
  },
};
