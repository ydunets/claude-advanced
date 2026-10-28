import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DATABASE, type Database } from '../../database/database.module.js';
import { meetings } from '../../database/schema.js';
import {
  toMeetingResponse,
  type MeetingResponse,
} from '../meeting-response.js';
import { CreateMeetingCommand } from './create-meeting.command.js';

@CommandHandler(CreateMeetingCommand)
export class CreateMeetingHandler implements ICommandHandler<CreateMeetingCommand> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async execute(command: CreateMeetingCommand): Promise<MeetingResponse> {
    const [createdMeeting] = await this.database
      .insert(meetings)
      .values({
        ownerId: command.ownerId,
        title: command.title,
        date: command.date,
        participants: command.participants,
      })
      .returning();
    return toMeetingResponse(createdMeeting);
  }
}
