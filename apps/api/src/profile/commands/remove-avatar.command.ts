import { Command } from '@nestjs/cqrs';

export class RemoveAvatarCommand extends Command<void> {
  constructor(readonly userId: string) {
    super();
  }
}
