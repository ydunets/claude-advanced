import type { ConfigService } from '@nestjs/config';
import { getPositiveIntegerConfig } from '../config/positive-integer-config.js';

const BYTES_PER_MEGABYTE = 1024 * 1024;
const MEGABYTE_FRACTION_DIGITS = 1;

export function getMaxFileSizeBytes(config: ConfigService): number {
  return getPositiveIntegerConfig(config, 'MAX_FILE_SIZE_BYTES');
}

export function buildFileTooLargeMessage(maxFileSizeBytes: number): string {
  const limitInMegabytes = Number(
    (maxFileSizeBytes / BYTES_PER_MEGABYTE).toFixed(MEGABYTE_FRACTION_DIGITS),
  );
  return `The file is larger than the ${limitInMegabytes} MB limit.`;
}
