import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CreateUserHandler } from './commands/create-user.handler.js';
import { FindUserByEmailHandler } from './queries/find-user-by-email.handler.js';
import { FindUserByIdHandler } from './queries/find-user-by-id.handler.js';

// Exports nothing: other modules reach users only through the command and
// query buses, so they depend on the messages, not on this module's providers.
@Module({
  imports: [DatabaseModule],
  providers: [CreateUserHandler, FindUserByEmailHandler, FindUserByIdHandler],
})
export class UsersModule {}
