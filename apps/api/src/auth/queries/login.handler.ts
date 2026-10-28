import { UnauthorizedException } from '@nestjs/common';
import { QueryBus, QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { FindUserByEmailQuery } from '../../users/queries/find-user-by-email.query.js';
import { AuthTokenService, type AuthToken } from '../auth-token.service.js';
import { isPasswordMatching, UNMATCHABLE_PASSWORD_HASH } from '../password.js';
import { LoginQuery } from './login.query.js';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

@QueryHandler(LoginQuery)
export class LoginHandler implements IQueryHandler<LoginQuery> {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async execute({ email, password }: LoginQuery): Promise<AuthToken> {
    const user = await this.queryBus.execute(new FindUserByEmailQuery(email));
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
