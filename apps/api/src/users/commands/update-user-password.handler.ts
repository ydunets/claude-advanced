import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { users, type User } from '../../database/schema.js';
import { UpdateUserPasswordCommand } from './update-user-password.command.js';

@CommandHandler(UpdateUserPasswordCommand)
export class UpdateUserPasswordHandler implements ICommandHandler<UpdateUserPasswordCommand> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async execute({
    userId,
    passwordHash,
  }: UpdateUserPasswordCommand): Promise<User | undefined> {
    const [updatedUser] = await this.database
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }
}
