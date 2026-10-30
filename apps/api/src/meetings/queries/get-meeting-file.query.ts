import type { Readable } from 'node:stream';
import { Query } from '@nestjs/cqrs';

export type MeetingFileContent = {
  name: string;
  mimeType: string;
  size: number;
  content: Readable;
};

export class GetMeetingFileQuery extends Query<MeetingFileContent> {
  constructor(
    readonly ownerId: string,
    readonly meetingId: string,
    readonly fileId: string,
  ) {
    super();
  }
}
