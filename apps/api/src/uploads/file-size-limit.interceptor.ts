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

const BYTES_PER_MEGABYTE = 1024 * 1024;
const MEGABYTE_FRACTION_DIGITS = 1;

export function buildFileTooLargeMessage(maxFileSizeBytes: number): string {
  const limitInMegabytes = Number(
    (maxFileSizeBytes / BYTES_PER_MEGABYTE).toFixed(MEGABYTE_FRACTION_DIGITS),
  );
  return `The file is larger than the ${limitInMegabytes} MB limit.`;
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
