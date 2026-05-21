export const createKeyholderSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'firstName', 'lastName'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email', maxLength: 254 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      firstName: { type: 'string', minLength: 1, maxLength: 100 },
      lastName: { type: 'string', minLength: 1, maxLength: 100 },
      phone: { type: 'string', maxLength: 30 },
      displayName: { type: 'string', maxLength: 200 },
    },
  },
} as const;

export const assignToEventSchema = {
  body: {
    type: 'object',
    required: ['eventId', 'threshold'],
    additionalProperties: false,
    properties: {
      eventId: { type: 'string' },
      threshold: { type: 'integer', minimum: 0 },
    },
  },
} as const;

export interface CreateKeyholderBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  displayName?: string;
}

export interface AssignToEventBody {
  eventId: string;
  threshold: number;
}
