import { getFileFormat } from '../uploads/file-format.js';
import { formatSizeInMegabytes } from '../uploads/file-size.js';

// The stored type comes from the extension, never from the browser, so the
// served Content-Type always matches one of these.
const AVATAR_MIME_TYPES_BY_FORMAT: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const ALLOWED_AVATAR_FORMATS: readonly string[] = Object.keys(
  AVATAR_MIME_TYPES_BY_FORMAT,
);

// States the size limit too, so a refused format shows every avatar rule.
export function buildDisallowedAvatarFormatMessage(
  maxAvatarSizeBytes: number,
): string {
  return `This image format is not allowed. Upload a JPEG, PNG or WebP image of at most ${formatSizeInMegabytes(maxAvatarSizeBytes)}.`;
}

export function getAvatarMimeType(fileName: string): string {
  const mimeType = AVATAR_MIME_TYPES_BY_FORMAT[getFileFormat(fileName)];
  if (!mimeType) {
    throw new Error(`"${fileName}" is not an allowed avatar format`);
  }
  return mimeType;
}
