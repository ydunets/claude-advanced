import { Query } from '@nestjs/cqrs';
import type { AuthToken } from '../auth-token.service.js';

export class LoginQuery extends Query<AuthToken> {
  constructor(
    readonly email: string,
    readonly password: string,
  ) {
    super();
  }
}
