import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { createFileFormatFilter } from '../uploads/file-format.js';
import {
  ALLOWED_FILE_FORMATS,
  DISALLOWED_FILE_FORMAT_MESSAGE,
} from './allowed-file-formats.js';
import { CreateMeetingHandler } from './commands/create-meeting.handler.js';
import { UploadMeetingFileHandler } from './commands/upload-meeting-file.handler.js';
import { getMaxFileSizeBytes } from './file-size-limit.js';
import { MeetingsController } from './meetings.controller.js';
import { GetMeetingFileHandler } from './queries/get-meeting-file.handler.js';
import { GetMeetingHandler } from './queries/get-meeting.handler.js';
import { ListMeetingFilesHandler } from './queries/list-meeting-files.handler.js';
import { ListMeetingsHandler } from './queries/list-meetings.handler.js';

// Browsers send multipart file names as raw UTF-8; multer's latin1 default
// would garble any non-ASCII name.
const FILE_NAME_CHARSET = 'utf8';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dest: config.getOrThrow<string>('FILES_STORAGE_DIR'),
        defParamCharset: FILE_NAME_CHARSET,
        limits: { fileSize: getMaxFileSizeBytes(config) },
        fileFilter: createFileFormatFilter(
          ALLOWED_FILE_FORMATS,
          DISALLOWED_FILE_FORMAT_MESSAGE,
        ),
      }),
    }),
  ],
  controllers: [MeetingsController],
  providers: [
    CreateMeetingHandler,
    ListMeetingsHandler,
    GetMeetingHandler,
    UploadMeetingFileHandler,
    ListMeetingFilesHandler,
    GetMeetingFileHandler,
  ],
})
export class MeetingsModule {}
