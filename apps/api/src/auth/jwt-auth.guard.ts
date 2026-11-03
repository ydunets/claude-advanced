import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import { FindUserByIdQuery } from '../users/queries/find-user-by-id.query.js';
import {
  AuthTokenService,
  type AccessTokenClaims,
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
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly queryBus: QueryBus,
  ) {}

  // A token signed before the user's last password change carries an older
  // version and is rejected like a deleted user's token.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = findBearerToken(request);
    if (!accessToken) {
      throw new UnauthorizedException();
    }
    let claims: AccessTokenClaims;
    try {
      claims = await this.authTokenService.verifyAccessToken(accessToken);
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.queryBus.execute(
      new FindUserByIdQuery(claims.userId),
    );
    if (!user || user.tokenVersion !== claims.tokenVersion) {
      throw new UnauthorizedException();
    }
    request.user = { id: user.id, email: user.email };
    return true;
  }
}
