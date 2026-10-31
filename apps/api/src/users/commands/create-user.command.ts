import { Command } from '@nestjs/cqrs';
import type { User } from '../../database/schema.js';

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email is already registered');
  }
}

// Rejects with EmailAlreadyRegisteredError when the email is taken.
export class CreateUserCommand extends Command<User> {
  constructor(
    readonly email: string,
    readonly passwordHash: string,
    readonly name: string,
  ) {
    super();
  }
}
