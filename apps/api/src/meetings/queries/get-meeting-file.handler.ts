import { open, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { and, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { meetingFiles } from '../../database/schema.js';
import { getOwnedMeeting } from '../owned-meeting.js';
import {
  GetMeetingFileQuery,
  type MeetingFileContent,
} from './get-meeting-file.query.js';

const FILE_NOT_FOUND_MESSAGE = 'File not found';
const FILE_MISSING_ERROR_CODE = 'ENOENT';

// Opening before the response starts turns a lost disk file into a 404;
// a stream that fails later would answer 400 through StreamableFile.
async function openStoredFile(filePath: string): Promise<FileHandle> {
  try {
    return await open(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === FILE_MISSING_ERROR_CODE) {
      throw new NotFoundException(FILE_NOT_FOUND_MESSAGE);
    }
    throw error;
  }
}

@QueryHandler(GetMeetingFileQuery)
export class GetMeetingFileHandler implements IQueryHandler<GetMeetingFileQuery> {
  private readonly storageDir: string;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    config: ConfigService,
  ) {
    this.storageDir = config.getOrThrow<string>('FILES_STORAGE_DIR');
  }

  async execute({
    ownerId,
    meetingId,
    fileId,
  }: GetMeetingFileQuery): Promise<MeetingFileContent> {
    await getOwnedMeeting(this.database, ownerId, meetingId);
    const [meetingFile] = await this.database
      .select()
      .from(meetingFiles)
      .where(
        and(eq(meetingFiles.id, fileId), eq(meetingFiles.meetingId, meetingId)),
      );
    if (!meetingFile) {
      throw new NotFoundException(FILE_NOT_FOUND_MESSAGE);
    }
    const storedFile = await openStoredFile(
      join(this.storageDir, meetingFile.storageName),
    );
    return {
      name: meetingFile.originalName,
      mimeType: meetingFile.mimeType,
      size: meetingFile.sizeBytes,
      content: storedFile.createReadStream(),
    };
  }
}
