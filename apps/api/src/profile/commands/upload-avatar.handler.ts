import { rm } from 'node:fs/promises';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SetUserAvatarCommand } from '../../users/commands/set-user-avatar.command.js';
import type { PreviousAvatar } from '../../users/user-avatar.js';
import { getAvatarMimeType } from '../allowed-avatar-formats.js';
import { deleteStoredAvatar, getAvatarStorageDir } from '../avatar-storage.js';
import {
  toProfileResponse,
  type ProfileResponse,
} from '../profile-response.js';
import { UploadAvatarCommand } from './upload-avatar.command.js';

@CommandHandler(UploadAvatarCommand)
export class UploadAvatarHandler implements ICommandHandler<UploadAvatarCommand> {
  private readonly storageDir: string;

  constructor(
    private readonly commandBus: CommandBus,
    config: ConfigService,
  ) {
    this.storageDir = getAvatarStorageDir(config);
  }

  async execute({ user, file }: UploadAvatarCommand): Promise<ProfileResponse> {
    const previousAvatar = await this.storeAvatar(user.id, file);
    await deleteStoredAvatar(this.storageDir, previousAvatar.storageName);
    return toProfileResponse({ ...user, avatarStorageName: file.filename });
  }

  // Multer has already written the file, so any failure here deletes it. A
  // valid token whose user no longer exists is treated as signed out.
  private async storeAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<PreviousAvatar> {
    try {
      const previousAvatar = await this.commandBus.execute(
        new SetUserAvatarCommand(userId, {
          storageName: file.filename,
          mimeType: getAvatarMimeType(file.originalname),
        }),
      );
      if (!previousAvatar) {
        throw new UnauthorizedException();
      }
      return previousAvatar;
    } catch (error) {
      await rm(file.path, { force: true });
      throw error;
    }
  }
}
