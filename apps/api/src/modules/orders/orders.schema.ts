import type { FastifySchema } from 'fastify';

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface CreateOrderBody {
  eventId: string;
  tableRef: string;           // required — primary customer identifier
  guestEventId?: string;      // optional — only when guest pass QR was scanned
  items: OrderItem[];
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
    required: ['eventId', 'tableRef', 'items'],
    properties: {
      eventId:      { type: 'string', format: 'uuid' },
      tableRef:     { type: 'string', minLength: 1 },
      guestEventId: { type: 'string', format: 'uuid' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'string', format: 'uuid' },
            quantity:  { type: 'integer', minimum: 1 },
          },
        },
      },
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
