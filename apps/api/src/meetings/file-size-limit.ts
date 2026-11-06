import type { ConfigService } from '@nestjs/config';
import { getPositiveIntegerConfig } from '../config/positive-integer-config.js';

export function getMaxFileSizeBytes(config: ConfigService): number {
  return getPositiveIntegerConfig(config, 'MAX_FILE_SIZE_BYTES');
}
