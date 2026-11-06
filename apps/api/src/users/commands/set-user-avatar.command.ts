import { Command } from '@nestjs/cqrs';
import type { PreviousAvatar, StoredAvatar } from '../user-avatar.js';

export class SetUserAvatarCommand extends Command<PreviousAvatar | undefined> {
  constructor(
    readonly userId: string,
    readonly avatar: StoredAvatar,
  ) {
    super();
  }
}
