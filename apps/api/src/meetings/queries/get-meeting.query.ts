import { Query } from '@nestjs/cqrs';
import type { MeetingResponse } from '../meeting-response.js';

export class GetMeetingQuery extends Query<MeetingResponse> {
  constructor(
    readonly ownerId: string,
    readonly meetingId: string,
  ) {
    super();
  }
}
