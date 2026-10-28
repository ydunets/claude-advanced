import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { users, type User } from '../database/schema.js';

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email is already registered');
  }
}

function normalizeEmail(email: string): string {
  return email.toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async findUserByEmail(email: string): Promise<User | undefined> {
    return this.database.query.users.findFirst({
      where: eq(users.email, normalizeEmail(email)),
    });
  }

  // Relies on the unique index instead of a prior lookup, so two concurrent
  // registrations of one email cannot both succeed.
  async createUser(email: string, passwordHash: string): Promise<User> {
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
