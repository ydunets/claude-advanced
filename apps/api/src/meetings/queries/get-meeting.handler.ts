import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { DATABASE, type Database } from '../../database/database.module.js';
import {
  toMeetingResponse,
  type MeetingResponse,
} from '../meeting-response.js';
import { getOwnedMeeting } from '../owned-meeting.js';
import { GetMeetingQuery } from './get-meeting.query.js';

@QueryHandler(GetMeetingQuery)
export class GetMeetingHandler implements IQueryHandler<GetMeetingQuery> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async execute({
    ownerId,
    meetingId,
  }: GetMeetingQuery): Promise<MeetingResponse> {
    return toMeetingResponse(
      await getOwnedMeeting(this.database, ownerId, meetingId),
    );
  }
}
