import { Command } from '@nestjs/cqrs';
import type { MeetingFileResponse } from '../meeting-file-response.js';

export class UploadMeetingFileCommand extends Command<MeetingFileResponse> {
  constructor(
    readonly ownerId: string,
    readonly meetingId: string,
    readonly file: Express.Multer.File,
  ) {
    super();
  }
}
