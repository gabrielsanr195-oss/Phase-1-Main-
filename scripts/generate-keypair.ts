#!/usr/bin/env tsx
/**
 * Generates an RSA-2048 keypair for QR JWT signing (RS256).
 * Usage: pnpm --filter @phase1plus/qr-lib generate-keypair [output-dir]
 * Default output: ./keys/  (gitignored)
 */
import { generateKeyPairSync } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const outputDir = resolve(process.argv[2] ?? './keys');

mkdirSync(outputDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(join(outputDir, 'private.pem'), privateKey, { mode: 0o600 });
writeFileSync(join(outputDir, 'public.pem'), publicKey);

console.log(`✓ RSA-2048 keypair written to ${outputDir}/`);
console.log('');
console.log('  private.pem  ← KEEP SECRET. Never commit. chmod 600 set.');
console.log('  public.pem   ← Distribute to all services that validate QRs.');
console.log('');
console.log('Next: set QR_PRIVATE_KEY_PATH and QR_PUBLIC_KEY_PATH in your .env');
