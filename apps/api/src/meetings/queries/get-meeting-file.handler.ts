import { join } from 'node:path';
import { Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { and, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { meetingFiles } from '../../database/schema.js';
import { findStoredFile } from '../../uploads/stored-file.js';
import { getOwnedMeeting } from '../owned-meeting.js';
import {
  GetMeetingFileQuery,
  type MeetingFileContent,
} from './get-meeting-file.query.js';

const FILE_NOT_FOUND_MESSAGE = 'File not found';

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
    const storedFile = await findStoredFile(
      join(this.storageDir, meetingFile.storageName),
    );
    if (!storedFile) {
      throw new NotFoundException(FILE_NOT_FOUND_MESSAGE);
    }
    return {
      name: meetingFile.originalName,
      mimeType: meetingFile.mimeType,
      size: meetingFile.sizeBytes,
      content: storedFile.createReadStream(),
    };
  }
}
