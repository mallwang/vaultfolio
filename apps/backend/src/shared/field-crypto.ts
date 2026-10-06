import {
  EnvelopeDecryptionError,
  LEGACY_VERSION,
  ciphertextVersion,
  decodeMasterKey,
  decryptValue,
  encryptValue,
} from '@vaultfolio/encryption';

/** Raised for every decryption problem (format, key, tamper); never carries ciphertext or payload. */
export const FieldDecryptionError = EnvelopeDecryptionError;

export const decodeFieldKey = decodeMasterKey;

/** Writes the legacy `v1` format; only used to build pre-upgrade fixtures. */
export function encryptField(key: Buffer, aad: string, payload: unknown): string {
  return encryptValue(key, LEGACY_VERSION, aad, payload);
}

/** Reads a `v1` value; throws {@link FieldDecryptionError} on any failure, including other versions. */
export function decryptField<T>(key: Buffer, aad: string, encoded: string): T {
  if (ciphertextVersion(encoded) !== LEGACY_VERSION) {
    throw new FieldDecryptionError();
  }
  return decryptValue<T>(key, aad, encoded);
}
