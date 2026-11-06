import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CreateUserHandler } from './commands/create-user.handler.js';
import { RemoveUserAvatarHandler } from './commands/remove-user-avatar.handler.js';
import { SetUserAvatarHandler } from './commands/set-user-avatar.handler.js';
import { UpdateUserNameHandler } from './commands/update-user-name.handler.js';
import { UpdateUserPasswordHandler } from './commands/update-user-password.handler.js';
import { FindUserByEmailHandler } from './queries/find-user-by-email.handler.js';
import { FindUserByIdHandler } from './queries/find-user-by-id.handler.js';

// Exports nothing: other modules reach users only through the command and
// query buses, so they depend on the messages, not on this module's providers.
@Module({
  imports: [DatabaseModule],
  providers: [
    CreateUserHandler,
    UpdateUserNameHandler,
    UpdateUserPasswordHandler,
    SetUserAvatarHandler,
    RemoveUserAvatarHandler,
    FindUserByEmailHandler,
    FindUserByIdHandler,
  ],
})
export class UsersModule {}
