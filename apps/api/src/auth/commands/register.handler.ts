import { ConflictException } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  CreateUserCommand,
  EmailAlreadyRegisteredError,
} from '../../users/commands/create-user.command.js';
import { AuthTokenService, type AuthToken } from '../auth-token.service.js';
import { hashPassword } from '../password.js';
import { RegisterCommand } from './register.command.js';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async execute({
    email,
    password,
    name,
  }: RegisterCommand): Promise<AuthToken> {
    const passwordHash = await hashPassword(password);
    const user = await this.commandBus
      .execute(new CreateUserCommand(email, passwordHash, name))
      .catch((error: unknown) => {
        if (error instanceof EmailAlreadyRegisteredError) {
          throw new ConflictException(error.message);
        }
        throw error;
      });
    return this.authTokenService.createAuthToken(user);
  }
}
