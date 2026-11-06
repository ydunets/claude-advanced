import {
  Injectable,
  mixin,
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  type Type,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, throwError, type Observable } from 'rxjs';
import { formatSizeInMegabytes } from './file-size.js';

export function buildFileTooLargeMessage(maxFileSizeBytes: number): string {
  return `The file is larger than the ${formatSizeInMegabytes(maxFileSizeBytes)} limit.`;
}

// Multer rejects an oversized file with a bare "File too large"; the returned
// interceptor states the route's limit, read through getMaxFileSizeBytes, so
// the web app can show it. Apply it before FileInterceptor.
export function createFileSizeLimitInterceptor(
  getMaxFileSizeBytes: (config: ConfigService) => number,
): Type<NestInterceptor> {
  @Injectable()
  class FileSizeLimitInterceptor implements NestInterceptor {
    constructor(private readonly config: ConfigService) {}

    intercept(
      _context: ExecutionContext,
      next: CallHandler,
    ): Observable<unknown> {
      return next
        .handle()
        .pipe(
          catchError((error: unknown) =>
            throwError(() =>
              error instanceof PayloadTooLargeException
                ? new PayloadTooLargeException(
                    buildFileTooLargeMessage(getMaxFileSizeBytes(this.config)),
                  )
                : error,
            ),
          ),
        );
    }
  }
  return mixin(FileSizeLimitInterceptor);
}
