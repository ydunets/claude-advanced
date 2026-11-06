import { extname } from 'node:path';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { MulterModuleOptions } from '@nestjs/platform-express';

type FileFormatFilter = NonNullable<MulterModuleOptions['fileFilter']>;

// The format is the file name's extension, compared case-insensitively; the
// browser-sent MIME type is never trusted.
export function getFileFormat(fileName: string): string {
  return extname(fileName).slice(1).toLowerCase();
}

export function isAllowedFileFormat(
  fileName: string,
  allowedFormats: readonly string[],
): boolean {
  return allowedFormats.includes(getFileFormat(fileName));
}

// Multer runs the filter before it opens the file, so a rejected format never
// reaches the disk.
export function createFileFormatFilter(
  allowedFormats: readonly string[],
  disallowedFormatMessage: string,
): FileFormatFilter {
  return (_request, file, accept) => {
    if (isAllowedFileFormat(file.originalname, allowedFormats)) {
      accept(null, true);
      return;
    }
    accept(new UnsupportedMediaTypeException(disallowedFormatMessage), false);
  };
}
