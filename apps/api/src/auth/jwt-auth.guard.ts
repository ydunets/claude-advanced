import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AuthTokenService,
  type AuthenticatedUser,
} from './auth-token.service.js';

const BEARER_PREFIX = 'Bearer ';

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

function findBearerToken(request: Request): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  return authorization.slice(BEARER_PREFIX.length);
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authTokenService: AuthTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = findBearerToken(request);
    if (!accessToken) {
      throw new UnauthorizedException();
    }
    try {
      request.user = await this.authTokenService.verifyAccessToken(accessToken);
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
