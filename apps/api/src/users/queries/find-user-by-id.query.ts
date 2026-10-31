import { Query } from '@nestjs/cqrs';
import type { User } from '../../database/schema.js';

export class FindUserByIdQuery extends Query<User | undefined> {
  constructor(readonly userId: string) {
    super();
  }
}
