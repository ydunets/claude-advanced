import { Command } from '@nestjs/cqrs';
import type { AuthToken } from '../auth-token.service.js';

export class ChangePasswordCommand extends Command<AuthToken> {
  constructor(
    readonly userId: string,
    readonly currentPassword: string,
    readonly newPassword: string,
  ) {
    super();
  }
}
