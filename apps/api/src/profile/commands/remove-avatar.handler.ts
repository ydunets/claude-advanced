import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RemoveUserAvatarCommand } from '../../users/commands/remove-user-avatar.command.js';
import { deleteStoredAvatar, getAvatarStorageDir } from '../avatar-storage.js';
import { RemoveAvatarCommand } from './remove-avatar.command.js';

@CommandHandler(RemoveAvatarCommand)
export class RemoveAvatarHandler implements ICommandHandler<RemoveAvatarCommand> {
  private readonly storageDir: string;

  constructor(
    private readonly commandBus: CommandBus,
    config: ConfigService,
  ) {
    this.storageDir = getAvatarStorageDir(config);
  }

  // A valid token whose user no longer exists is treated as signed out.
  async execute({ userId }: RemoveAvatarCommand): Promise<void> {
    const previousAvatar = await this.commandBus.execute(
      new RemoveUserAvatarCommand(userId),
    );
    if (!previousAvatar) {
      throw new UnauthorizedException();
    }
    await deleteStoredAvatar(this.storageDir, previousAvatar.storageName);
  }
}
