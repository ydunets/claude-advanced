import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { users, type User } from '../../database/schema.js';
import { FindUserByIdQuery } from './find-user-by-id.query.js';

@QueryHandler(FindUserByIdQuery)
export class FindUserByIdHandler implements IQueryHandler<FindUserByIdQuery> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async execute({ userId }: FindUserByIdQuery): Promise<User | undefined> {
    return this.database.query.users.findFirst({
      where: eq(users.id, userId),
    });
  }
}
