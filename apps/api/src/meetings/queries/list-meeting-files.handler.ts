import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { asc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { meetingFiles } from '../../database/schema.js';
import {
  toMeetingFileResponse,
  type MeetingFileResponse,
} from '../meeting-file-response.js';
import { getOwnedMeeting } from '../owned-meeting.js';
import { ListMeetingFilesQuery } from './list-meeting-files.query.js';

@QueryHandler(ListMeetingFilesQuery)
export class ListMeetingFilesHandler implements IQueryHandler<ListMeetingFilesQuery> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async execute({
    ownerId,
    meetingId,
  }: ListMeetingFilesQuery): Promise<MeetingFileResponse[]> {
    await getOwnedMeeting(this.database, ownerId, meetingId);
    const files = await this.database
      .select()
      .from(meetingFiles)
      .where(eq(meetingFiles.meetingId, meetingId))
      .orderBy(asc(meetingFiles.uploadedAt));
    return files.map(toMeetingFileResponse);
  }
}
