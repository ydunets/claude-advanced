import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { INITIAL_TOKEN_VERSION, type User } from '../database/schema.js';

export type AuthToken = { accessToken: string };

// Never carries passwordHash: controllers across modules read request.user.
export type AuthenticatedUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'tokenVersion'
  | 'avatarStorageName'
  | 'avatarMimeType'
>;

export type AccessTokenClaims = { userId: string; tokenVersion: number };

// tokenVersion is optional because tokens issued before token versioning
// carry no claim; they count as the initial version, so those sessions stay
// valid until the user's first password change.
type AccessTokenPayload = {
  sub: string;
  email: string;
  tokenVersion?: number;
};

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwtService: JwtService) {}

  async createAuthToken(user: User): Promise<AuthToken> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }

  // Rejects with the library's error when the signature or expiry is invalid.
  async verifyAccessToken(accessToken: string): Promise<AccessTokenClaims> {
    const payload =
      await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken);
    return {
      userId: payload.sub,
      tokenVersion: payload.tokenVersion ?? INITIAL_TOKEN_VERSION,
    };
  }
}
