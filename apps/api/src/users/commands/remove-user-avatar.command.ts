import { Command } from '@nestjs/cqrs';
import type { PreviousAvatar } from '../user-avatar.js';

export class RemoveUserAvatarCommand extends Command<
  PreviousAvatar | undefined
> {
  constructor(readonly userId: string) {
    super();
  }
}
