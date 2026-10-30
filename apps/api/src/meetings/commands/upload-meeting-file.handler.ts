import { rm } from 'node:fs/promises';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DATABASE, type Database } from '../../database/database.module.js';
import { meetingFiles } from '../../database/schema.js';
import {
  toMeetingFileResponse,
  type MeetingFileResponse,
} from '../meeting-file-response.js';
import { getOwnedMeeting } from '../owned-meeting.js';
import { UploadMeetingFileCommand } from './upload-meeting-file.command.js';

const UNKNOWN_MIME_TYPE = 'application/octet-stream';

@CommandHandler(UploadMeetingFileCommand)
export class UploadMeetingFileHandler implements ICommandHandler<UploadMeetingFileCommand> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async execute({
    ownerId,
    meetingId,
    file,
  }: UploadMeetingFileCommand): Promise<MeetingFileResponse> {
    try {
      await getOwnedMeeting(this.database, ownerId, meetingId);
      const [meetingFile] = await this.database
        .insert(meetingFiles)
        .values({
          meetingId,
          originalName: file.originalname,
          mimeType: file.mimetype || UNKNOWN_MIME_TYPE,
          sizeBytes: file.size,
          storageName: file.filename,
        })
        .returning();
      return toMeetingFileResponse(meetingFile);
    } catch (error) {
      await rm(file.path, { force: true });
      throw error;
    }
  }
}
