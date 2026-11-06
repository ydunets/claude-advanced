import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module.js';
import { createFileFormatFilter } from '../uploads/file-format.js';
import {
  ALLOWED_AVATAR_FORMATS,
  DISALLOWED_AVATAR_FORMAT_MESSAGE,
} from './allowed-avatar-formats.js';
import {
  getAvatarStorageDir,
  getMaxAvatarSizeBytes,
} from './avatar-storage.js';
import { UpdateProfileHandler } from './commands/update-profile.handler.js';
import { UploadAvatarHandler } from './commands/upload-avatar.handler.js';
import { ProfileController } from './profile.controller.js';
import { GetProfileHandler } from './queries/get-profile.handler.js';

@Module({
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dest: getAvatarStorageDir(config),
        limits: { fileSize: getMaxAvatarSizeBytes(config) },
        fileFilter: createFileFormatFilter(
          ALLOWED_AVATAR_FORMATS,
          DISALLOWED_AVATAR_FORMAT_MESSAGE,
        ),
      }),
    }),
  ],
  controllers: [ProfileController],
  providers: [GetProfileHandler, UpdateProfileHandler, UploadAvatarHandler],
})
export class ProfileModule {}
