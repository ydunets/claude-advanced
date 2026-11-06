import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module.js';
import { createFileFormatFilter } from '../uploads/file-format.js';
import {
  ALLOWED_AVATAR_FORMATS,
  buildDisallowedAvatarFormatMessage,
} from './allowed-avatar-formats.js';
import {
  getAvatarStorageDir,
  getMaxAvatarSizeBytes,
} from './avatar-storage.js';
import { RemoveAvatarHandler } from './commands/remove-avatar.handler.js';
import { UpdateProfileHandler } from './commands/update-profile.handler.js';
import { UploadAvatarHandler } from './commands/upload-avatar.handler.js';
import { ProfileController } from './profile.controller.js';
import { GetAvatarHandler } from './queries/get-avatar.handler.js';
import { GetProfileHandler } from './queries/get-profile.handler.js';

@Module({
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const maxAvatarSizeBytes = getMaxAvatarSizeBytes(config);
        return {
          dest: getAvatarStorageDir(config),
          limits: { fileSize: maxAvatarSizeBytes },
          fileFilter: createFileFormatFilter(
            ALLOWED_AVATAR_FORMATS,
            buildDisallowedAvatarFormatMessage(maxAvatarSizeBytes),
          ),
        };
      },
    }),
  ],
  controllers: [ProfileController],
  providers: [
    GetProfileHandler,
    UpdateProfileHandler,
    UploadAvatarHandler,
    RemoveAvatarHandler,
    GetAvatarHandler,
  ],
})
export class ProfileModule {}
