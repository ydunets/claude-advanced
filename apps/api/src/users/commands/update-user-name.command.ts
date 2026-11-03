import { Command } from '@nestjs/cqrs';
import type { User } from '../../database/schema.js';

export class UpdateUserNameCommand extends Command<User | undefined> {
  constructor(
    readonly userId: string,
    readonly name: string,
  ) {
    super();
  }
}
