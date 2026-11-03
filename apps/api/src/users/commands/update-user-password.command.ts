import { Command } from '@nestjs/cqrs';
import type { User } from '../../database/schema.js';

export class UpdateUserPasswordCommand extends Command<User | undefined> {
  constructor(
    readonly userId: string,
    readonly passwordHash: string,
  ) {
    super();
  }
}
