import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { getPositiveIntegerConfig } from '../config/positive-integer-config.js';

// A folder of its own inside FILES_STORAGE_DIR keeps avatars apart from
// meeting files.
const AVATAR_DIRECTORY = 'avatars';

export function getAvatarStorageDir(config: ConfigService): string {
  return join(config.getOrThrow<string>('FILES_STORAGE_DIR'), AVATAR_DIRECTORY);
}

export function getMaxAvatarSizeBytes(config: ConfigService): number {
  return getPositiveIntegerConfig(config, 'MAX_AVATAR_SIZE_BYTES');
}

export async function deleteStoredAvatar(
  storageDir: string,
  storageName: string | null,
): Promise<void> {
  if (storageName) {
    await rm(join(storageDir, storageName), { force: true });
  }
}
