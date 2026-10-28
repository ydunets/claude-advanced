import { ConflictException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  EmailAlreadyRegisteredError,
  UsersService,
} from '../../users/users.service.js';
import { AuthTokenService, type AuthToken } from '../auth-token.service.js';
import { hashPassword } from '../password.js';
import { RegisterCommand } from './register.command.js';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    private readonly usersService: UsersService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async execute({ email, password }: RegisterCommand): Promise<AuthToken> {
    const passwordHash = await hashPassword(password);
    try {
      const user = await this.usersService.createUser(email, passwordHash);
      return await this.authTokenService.createAuthToken(user);
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
