export const createEventSchema = {
  body: {
    type: 'object',
    required: ['name', 'eventDate', 'totalPax'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 2000 },
      eventDate: { type: 'string', format: 'date-time' },
      doorsOpenAt: { type: 'string', format: 'date-time' },
      endsAt: { type: 'string', format: 'date-time' },
      totalPax: { type: 'integer', minimum: 1, maximum: 10000 },
      ratioTargetWomen: { type: 'number', minimum: 0, maximum: 1 },
      invitationExpiresHours: { type: 'integer', minimum: 1, maximum: 8760 },
    },
  },
} as const;

export const createPassTierSchema = {
  body: {
    type: 'object',
    required: ['name', 'price', 'currency'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 1000 },
      price: { type: 'number', minimum: 0 },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      maxQuantity: { type: 'integer', minimum: 1 },
    },
  },
} as const;

export interface CreateEventBody {
  name: string;
  description?: string;
  eventDate: string;
  doorsOpenAt?: string;
  endsAt?: string;
  totalPax: number;
  ratioTargetWomen?: number;
  invitationExpiresHours?: number;
}

export interface CreatePassTierBody {
  name: string;
  description?: string;
  price: number;
  currency: string;
  maxQuantity?: number;
}
