import { Command } from '@nestjs/cqrs';
import type { AuthToken } from '../auth-token.service.js';

export class RegisterCommand extends Command<AuthToken> {
  constructor(
    readonly email: string,
    readonly password: string,
    readonly name: string,
  ) {
    super();
  }
}
