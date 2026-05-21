import { readFile } from 'fs/promises';
import { config } from '../config';

let privateKeyCache: string | null = null;
let publicKeyCache: string | null = null;

export async function getQRPrivateKey(): Promise<string> {
  if (!privateKeyCache) {
    privateKeyCache = await readFile(config.QR_PRIVATE_KEY_PATH, 'utf-8');
  }
  return privateKeyCache;
}

export async function getQRPublicKey(): Promise<string> {
  if (!publicKeyCache) {
    publicKeyCache = await readFile(config.QR_PUBLIC_KEY_PATH, 'utf-8');
  }
  return publicKeyCache;
}
