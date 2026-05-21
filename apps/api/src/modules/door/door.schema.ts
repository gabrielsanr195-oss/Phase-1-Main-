export const scanSchema = {
  body: {
    type: 'object',
    required: ['qrToken'],
    additionalProperties: false,
    properties: {
      qrToken: { type: 'string' },
    },
  },
} as const;

export interface ScanBody {
  qrToken: string;
}
