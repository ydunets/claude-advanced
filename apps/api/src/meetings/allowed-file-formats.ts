import { extname } from 'node:path';

export const ALLOWED_FILE_FORMATS: readonly string[] = [
  'mp4',
  'webm',
  'mov',
  'mp3',
  'm4a',
  'wav',
  'ogg',
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'txt',
  'md',
];

export const DISALLOWED_FILE_FORMAT_MESSAGE = `This file format is not allowed. Allowed formats: ${ALLOWED_FILE_FORMATS.join(', ')}.`;

export function isAllowedFileFormat(fileName: string): boolean {
  const format = extname(fileName).slice(1).toLowerCase();
  return ALLOWED_FILE_FORMATS.includes(format);
}
