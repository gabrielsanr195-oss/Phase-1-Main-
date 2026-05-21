import type { FastifySchema } from 'fastify';

export interface CreateProductBody {
  name: string;
  description?: string;
  type: 'bottle' | 'drink' | 'shot';
  sku?: string;
}

export interface AddPassTierItemBody {
  productId: string;
  quantity: number;
}

export const createProductSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      type: { type: 'string', enum: ['bottle', 'drink', 'shot'] },
      sku: { type: 'string' },
    },
  },
};

export const addPassTierItemSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['productId', 'quantity'],
    properties: {
      productId: { type: 'string', format: 'uuid' },
      quantity: { type: 'integer', minimum: 1 },
    },
  },
};
