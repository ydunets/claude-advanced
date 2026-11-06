import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { findStoredFile } from '../../uploads/stored-file.js';
import { getAvatarStorageDir } from '../avatar-storage.js';
import { GetAvatarQuery, type AvatarContent } from './get-avatar.query.js';

const AVATAR_NOT_FOUND_MESSAGE = 'Avatar not found';

// Reads the avatar of the user JwtAuthGuard loaded from the token, so no
// request can name another user's image.
@QueryHandler(GetAvatarQuery)
export class GetAvatarHandler implements IQueryHandler<GetAvatarQuery> {
  private readonly storageDir: string;

  constructor(config: ConfigService) {
    this.storageDir = getAvatarStorageDir(config);
  }

  async execute({ user }: GetAvatarQuery): Promise<AvatarContent> {
    const { avatarStorageName, avatarMimeType } = user;
    if (!avatarStorageName || !avatarMimeType) {
      throw new NotFoundException(AVATAR_NOT_FOUND_MESSAGE);
    }
    const storedFile = await findStoredFile(
      join(this.storageDir, avatarStorageName),
    );
    if (!storedFile) {
      throw new NotFoundException(AVATAR_NOT_FOUND_MESSAGE);
    }
    let size: number;
    try {
      ({ size } = await storedFile.stat());
    } catch (error) {
      await storedFile.close();
      throw error;
    }
    return {
      mimeType: avatarMimeType,
      size,
      content: storedFile.createReadStream(),
    };
  }
}
