import { generateKeyPairSync } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const outputDir = process.argv[2] ?? './keys';

mkdirSync(outputDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(join(outputDir, 'private.pem'), privateKey, { mode: 0o600 });
writeFileSync(join(outputDir, 'public.pem'), publicKey);

console.log(`✓ RSA-2048 keypair generated in ${outputDir}/`);
console.log('  private.pem  — KEEP SECRET, never commit (chmod 600 applied)');
console.log('  public.pem   — safe to distribute to all services');
