import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from './auth-token.service.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

// Only valid on routes protected by JwtAuthGuard, which sets request.user.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
