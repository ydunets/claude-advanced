import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { CreateMeetingHandler } from './commands/create-meeting.handler.js';
import { MeetingsController } from './meetings.controller.js';
import { GetMeetingHandler } from './queries/get-meeting.handler.js';
import { ListMeetingsHandler } from './queries/list-meetings.handler.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [MeetingsController],
  providers: [CreateMeetingHandler, ListMeetingsHandler, GetMeetingHandler],
})
export class MeetingsModule {}
