import { Inject, NotFoundException } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { and, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { meetings } from '../../database/schema.js';
import {
  toMeetingResponse,
  type MeetingResponse,
} from '../meeting-response.js';
import { GetMeetingQuery } from './get-meeting.query.js';

const MEETING_NOT_FOUND_MESSAGE = 'Meeting not found';

@QueryHandler(GetMeetingQuery)
export class GetMeetingHandler implements IQueryHandler<GetMeetingQuery> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // Filtering by owner makes another user's meeting indistinguishable from a
  // missing one, so the response never confirms that an id exists.
  async execute({
    ownerId,
    meetingId,
  }: GetMeetingQuery): Promise<MeetingResponse> {
    const [meeting] = await this.database
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.ownerId, ownerId)));
    if (!meeting) {
      throw new NotFoundException(MEETING_NOT_FOUND_MESSAGE);
    }
    return toMeetingResponse(meeting);
  }
}
