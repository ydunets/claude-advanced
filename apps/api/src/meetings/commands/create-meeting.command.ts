import { Command } from '@nestjs/cqrs';
import type { MeetingResponse } from '../meeting-response.js';

export class CreateMeetingCommand extends Command<MeetingResponse> {
  constructor(
    readonly ownerId: string,
    readonly title: string,
    readonly date: Date,
    readonly participants: string[],
  ) {
    super();
  }
}
