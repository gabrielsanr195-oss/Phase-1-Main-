export const guestRegistrationSchema = {
  body: {
    type: 'object',
    required: ['firstName', 'lastName', 'phone', 'gender'],
    additionalProperties: false,
    properties: {
      firstName: { type: 'string', minLength: 1, maxLength: 100 },
      lastName: { type: 'string', minLength: 1, maxLength: 100 },
      phone: { type: 'string', minLength: 7, maxLength: 30 },
      gender: { type: 'string', enum: ['male', 'female', 'other'] },
      dateOfBirth: { type: 'string' },
      whatsappOptIn: { type: 'boolean' },
    },
  },
} as const;

export const updateGuestStatusSchema = {
  body: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: {
        type: 'string',
        enum: ['en_lista', 'confirmed', 'rejected', 'paid', 'checked_in', 'checked_out'],
      },
      adminNote: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export interface GuestRegistrationBody {
  firstName: string;
  lastName: string;
  phone: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  whatsappOptIn?: boolean;
}

export interface UpdateGuestStatusBody {
  status: 'en_lista' | 'confirmed' | 'rejected' | 'paid' | 'checked_in' | 'checked_out';
  adminNote?: string;
}
