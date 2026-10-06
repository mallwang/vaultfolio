import { createHash } from 'node:crypto';

/** Non-reversible 16-hex-char id of a master key, stored next to each data key it wraps. */
export function keyFingerprint(masterKey: Buffer): string {
  return createHash('sha256')
    .update(Buffer.concat([Buffer.from('vaultfolio-kek|', 'utf8'), masterKey]))
    .digest()
    .subarray(0, 8)
    .toString('hex');
}
