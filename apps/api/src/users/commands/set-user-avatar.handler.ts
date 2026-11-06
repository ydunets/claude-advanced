import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DATABASE, type Database } from '../../database/database.module.js';
import { replaceUserAvatar, type PreviousAvatar } from '../user-avatar.js';
import { SetUserAvatarCommand } from './set-user-avatar.command.js';

@CommandHandler(SetUserAvatarCommand)
export class SetUserAvatarHandler implements ICommandHandler<SetUserAvatarCommand> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async execute({
    userId,
    avatar,
  }: SetUserAvatarCommand): Promise<PreviousAvatar | undefined> {
    return replaceUserAvatar(this.database, userId, avatar);
  }
}
