import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../database/schema.js';

export type AuthToken = { accessToken: string };

export type AuthenticatedUser = { id: string; email: string };

type AccessTokenPayload = { sub: string; email: string };

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwtService: JwtService) {}

  async createAuthToken(user: User): Promise<AuthToken> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }

  // Rejects with the library's error when the signature or expiry is invalid.
  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const payload =
      await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken);
    return { id: payload.sub, email: payload.email };
  }
}
