import { formatFileSize } from './format';

// Server only: the variable has no NEXT_PUBLIC_ prefix, so the browser never
// receives it.
export function getMaxUploadSizeBytes(): number {
  const rawLimit = process.env.MAX_UPLOAD_SIZE_BYTES;
  const maxUploadSizeBytes = Number(rawLimit);
  if (!Number.isInteger(maxUploadSizeBytes) || maxUploadSizeBytes <= 0) {
    throw new Error(
      `MAX_UPLOAD_SIZE_BYTES must be a positive integer, got "${rawLimit}"; copy apps/web/.env.example to .env`,
    );
  }
  return maxUploadSizeBytes;
}

export function buildFileTooLargeMessage(maxUploadSizeBytes: number): string {
  return `The file is larger than the ${formatFileSize(maxUploadSizeBytes)} limit.`;
}
