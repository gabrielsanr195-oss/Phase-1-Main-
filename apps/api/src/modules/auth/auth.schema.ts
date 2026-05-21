export const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'firstName', 'lastName', 'venueName', 'venueSlug'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email', maxLength: 254 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      firstName: { type: 'string', minLength: 1, maxLength: 100 },
      lastName: { type: 'string', minLength: 1, maxLength: 100 },
      phone: { type: 'string', maxLength: 30 },
      venueName: { type: 'string', minLength: 1, maxLength: 200 },
      venueSlug: {
        type: 'string',
        minLength: 3,
        maxLength: 60,
        pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
      },
    },
  },
} as const;

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'venueSlug'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
      venueSlug: { type: 'string' },
    },
  },
} as const;

export const refreshSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    additionalProperties: false,
    properties: {
      refreshToken: { type: 'string' },
    },
  },
} as const;

export const logoutSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      refreshToken: { type: 'string' },
    },
  },
} as const;

// Request body types (kept in sync with schemas above)
export interface RegisterBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  venueName: string;
  venueSlug: string;
}

export interface LoginBody {
  email: string;
  password: string;
  venueSlug: string;
}

export interface RefreshBody {
  refreshToken: string;
}

export interface LogoutBody {
  refreshToken?: string;
}
