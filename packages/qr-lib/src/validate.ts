import { jwtVerify, importSPKI } from 'jose';
import type { QRPayload } from '@phase1plus/types';

export async function validateQR(token: string, publicKeyPem: string): Promise<QRPayload> {
  const publicKey = await importSPKI(publicKeyPem, 'RS256');

  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ['RS256'],
  });

  if (!payload.sub || !payload['venue_id'] || !payload['event_id'] || !payload['type']) {
    throw new Error('QR token missing required fields');
  }

  return {
    sub: payload.sub,
    venue_id: payload['venue_id'] as string,
    event_id: payload['event_id'] as string,
    type: payload['type'] as QRPayload['type'],
    iat: payload.iat,
    exp: payload.exp,
  };
}
