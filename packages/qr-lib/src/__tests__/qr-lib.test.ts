import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { signQR } from '../sign';
import { validateQR } from '../validate';

function makeKeyPair() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

const { privateKey, publicKey } = makeKeyPair();

const basePayload = {
  sub: 'guest-uuid-aaa',
  venue_id: 'venue-uuid-bbb',
  event_id: 'event-uuid-ccc',
  type: 'guest' as const,
};

describe('qr-lib', () => {
  it('signs a payload and produces a 3-part JWT', async () => {
    const token = await signQR(basePayload, privateKey);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('validates a signed token and returns the original payload', async () => {
    const token = await signQR(basePayload, privateKey);
    const decoded = await validateQR(token, publicKey);

    expect(decoded.sub).toBe(basePayload.sub);
    expect(decoded.venue_id).toBe(basePayload.venue_id);
    expect(decoded.event_id).toBe(basePayload.event_id);
    expect(decoded.type).toBe(basePayload.type);
  });

  it('rejects a token signed with a different private key', async () => {
    const { privateKey: otherPrivate } = makeKeyPair();
    const token = await signQR(basePayload, otherPrivate);
    await expect(validateQR(token, publicKey)).rejects.toThrow();
  });

  it('rejects a tampered token', async () => {
    const token = await signQR(basePayload, privateKey);
    const [header, , sig] = token.split('.');
    const fakePayload = Buffer.from(JSON.stringify({ sub: 'attacker' })).toString('base64url');
    const tampered = `${header}.${fakePayload}.${sig}`;
    await expect(validateQR(tampered, publicKey)).rejects.toThrow();
  });

  it('accepts all valid QR types', async () => {
    const types = ['guest', 'keyholder', 'staff', 'table'] as const;
    for (const type of types) {
      const token = await signQR({ ...basePayload, type }, privateKey);
      const decoded = await validateQR(token, publicKey);
      expect(decoded.type).toBe(type);
    }
  });
});
