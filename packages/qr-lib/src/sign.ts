import { SignJWT, importPKCS8 } from 'jose';
import type { QRPayload } from '@phase1plus/types';

export async function signQR(payload: QRPayload, privateKeyPem: string): Promise<string> {
  const privateKey = await importPKCS8(privateKeyPem, 'RS256');

  const jwt = new SignJWT({
    venue_id: payload.venue_id,
    event_id: payload.event_id,
    type: payload.type,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(payload.sub)
    .setIssuedAt();

  if (payload.exp) {
    jwt.setExpirationTime(new Date(payload.exp * 1000));
  } else {
    jwt.setExpirationTime('24h');
  }

  return jwt.sign(privateKey);
}
