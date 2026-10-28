import { UnauthorizedException } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { UsersService } from '../../users/users.service.js';
import { AuthTokenService, type AuthToken } from '../auth-token.service.js';
import { isPasswordMatching, UNMATCHABLE_PASSWORD_HASH } from '../password.js';
import { LoginQuery } from './login.query.js';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

@QueryHandler(LoginQuery)
export class LoginHandler implements IQueryHandler<LoginQuery> {
  constructor(
    private readonly usersService: UsersService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async execute({ email, password }: LoginQuery): Promise<AuthToken> {
    const user = await this.usersService.findUserByEmail(email);
    const isMatching = await isPasswordMatching(
      password,
      user?.passwordHash ?? UNMATCHABLE_PASSWORD_HASH,
    );
    if (!user || !isMatching) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    return this.authTokenService.createAuthToken(user);
  }
}
