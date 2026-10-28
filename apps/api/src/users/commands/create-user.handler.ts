import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DATABASE, type Database } from '../../database/database.module.js';
import { users, type User } from '../../database/schema.js';
import { normalizeEmail } from '../email.js';
import {
  CreateUserCommand,
  EmailAlreadyRegisteredError,
} from './create-user.command.js';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // Relies on the unique index instead of a prior lookup, so two concurrent
  // registrations of one email cannot both succeed.
  async execute({ email, passwordHash }: CreateUserCommand): Promise<User> {
    const [createdUser] = await this.database
      .insert(users)
      .values({ email: normalizeEmail(email), passwordHash })
      .onConflictDoNothing()
      .returning();
    if (!createdUser) {
      throw new EmailAlreadyRegisteredError();
    }
    return createdUser;
  }
}
