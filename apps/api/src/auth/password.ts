import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const HASH_SEPARATOR = ':';
const HEX_CHARS_PER_BYTE = 2;

// A well-formed hash that matches no password. Verifying against it when the
// email is unknown keeps login timing from revealing which emails exist.
export const UNMATCHABLE_PASSWORD_HASH = [
  '0'.repeat(SALT_BYTES * HEX_CHARS_PER_BYTE),
  '0'.repeat(KEY_BYTES * HEX_CHARS_PER_BYTE),
].join(HASH_SEPARATOR);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_BYTES);
  return [salt.toString('hex'), key.toString('hex')].join(HASH_SEPARATOR);
}

export async function isPasswordMatching(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const [saltHex, keyHex] = passwordHash.split(HASH_SEPARATOR);
  const expectedKey = Buffer.from(keyHex, 'hex');
  const actualKey = await scryptAsync(
    password,
    Buffer.from(saltHex, 'hex'),
    KEY_BYTES,
  );
  return timingSafeEqual(actualKey, expectedKey);
}
