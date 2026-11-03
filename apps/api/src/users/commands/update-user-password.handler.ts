import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { users, type User } from '../../database/schema.js';
import { UpdateUserPasswordCommand } from './update-user-password.command.js';

@CommandHandler(UpdateUserPasswordCommand)
export class UpdateUserPasswordHandler implements ICommandHandler<UpdateUserPasswordCommand> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // Compare and set: when another change already moved the version past
  // expectedTokenVersion, no row matches and the result is undefined.
  async execute({
    userId,
    passwordHash,
    expectedTokenVersion,
  }: UpdateUserPasswordCommand): Promise<User | undefined> {
    const [updatedUser] = await this.database
      .update(users)
      // Every token signed with the previous version stops authenticating.
      .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(
        and(eq(users.id, userId), eq(users.tokenVersion, expectedTokenVersion)),
      )
      .returning();
    return updatedUser;
  }
}
