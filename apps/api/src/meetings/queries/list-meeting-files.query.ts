import { Query } from '@nestjs/cqrs';
import type { MeetingFileResponse } from '../meeting-file-response.js';

export class ListMeetingFilesQuery extends Query<MeetingFileResponse[]> {
  constructor(
    readonly ownerId: string,
    readonly meetingId: string,
  ) {
    super();
  }
}
