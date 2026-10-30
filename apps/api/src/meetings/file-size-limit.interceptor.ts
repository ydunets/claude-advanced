import {
  Injectable,
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, throwError, type Observable } from 'rxjs';
import {
  buildFileTooLargeMessage,
  getMaxFileSizeBytes,
} from './file-size-limit.js';

// Multer rejects an oversized file with a bare "File too large"; this states
// the limit so the web app can show it. Apply it before FileInterceptor.
@Injectable()
export class FileSizeLimitInterceptor implements NestInterceptor {
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
