import { Query } from '@nestjs/cqrs';
import type { User } from '../../database/schema.js';

export class FindUserByEmailQuery extends Query<User | undefined> {
  constructor(readonly email: string) {
    super();
  }
}
