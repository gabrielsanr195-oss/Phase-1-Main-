export const createShareLinkSchema = {
  body: {
    type: 'object',
    required: ['eventId', 'passTierId', 'linkType'],
    additionalProperties: false,
    properties: {
      eventId: { type: 'string' },
      passTierId: { type: 'string' },
      linkType: { type: 'string', enum: ['open', 'ratio_gated', 'threshold_gated'] },
      maxUses: { type: 'integer', minimum: 1 },
      expiresAt: { type: 'string', format: 'date-time' },
    },
  },
} as const;

export interface CreateShareLinkBody {
  eventId: string;
  passTierId: string;
  linkType: 'open' | 'ratio_gated' | 'threshold_gated';
  maxUses?: number;
  expiresAt?: string;
}
