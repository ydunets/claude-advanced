import type { ConfigService } from '@nestjs/config';

const BYTES_PER_MEGABYTE = 1024 * 1024;
const MEGABYTE_FRACTION_DIGITS = 1;

export function getMaxFileSizeBytes(config: ConfigService): number {
  const rawLimit = config.getOrThrow<string>('MAX_FILE_SIZE_BYTES');
  const maxFileSizeBytes = Number(rawLimit);
  if (!Number.isInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
    throw new Error(
      `MAX_FILE_SIZE_BYTES must be a positive integer, got "${rawLimit}"`,
    );
  }
  return maxFileSizeBytes;
}

export function buildFileTooLargeMessage(maxFileSizeBytes: number): string {
  const limitInMegabytes = Number(
    (maxFileSizeBytes / BYTES_PER_MEGABYTE).toFixed(MEGABYTE_FRACTION_DIGITS),
  );
  return `The file is larger than the ${limitInMegabytes} MB limit.`;
}
