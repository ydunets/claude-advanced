import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { users, type User } from '../../database/schema.js';
import { UpdateUserNameCommand } from './update-user-name.command.js';

@CommandHandler(UpdateUserNameCommand)
export class UpdateUserNameHandler implements ICommandHandler<UpdateUserNameCommand> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async execute({
    userId,
    name,
  }: UpdateUserNameCommand): Promise<User | undefined> {
    const [updatedUser] = await this.database
      .update(users)
      .set({ name })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }
}
