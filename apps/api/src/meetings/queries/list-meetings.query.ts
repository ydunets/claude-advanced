import { Query } from '@nestjs/cqrs';
import type { MeetingResponse } from '../meeting-response.js';

export class ListMeetingsQuery extends Query<MeetingResponse[]> {
  constructor(readonly ownerId: string) {
    super();
  }
}
