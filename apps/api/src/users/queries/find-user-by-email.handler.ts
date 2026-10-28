import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { users, type User } from '../../database/schema.js';
import { normalizeEmail } from '../email.js';
import { FindUserByEmailQuery } from './find-user-by-email.query.js';

@QueryHandler(FindUserByEmailQuery)
export class FindUserByEmailHandler implements IQueryHandler<FindUserByEmailQuery> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async execute({ email }: FindUserByEmailQuery): Promise<User | undefined> {
    return this.database.query.users.findFirst({
      where: eq(users.email, normalizeEmail(email)),
    });
  }
}
