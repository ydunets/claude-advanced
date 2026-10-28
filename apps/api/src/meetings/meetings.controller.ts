import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthenticatedUser } from '../auth/auth-token.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateMeetingCommand } from './commands/create-meeting.command.js';
import { CreateMeetingDto } from './dto/create-meeting.dto.js';
import type { MeetingResponse } from './meeting-response.js';
import { GetMeetingQuery } from './queries/get-meeting.query.js';
import { ListMeetingsQuery } from './queries/list-meetings.query.js';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  createMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateMeetingDto,
  ): Promise<MeetingResponse> {
    return this.commandBus.execute(
      new CreateMeetingCommand(
        user.id,
        body.title,
        new Date(body.date),
        body.participants,
      ),
    );
  }

  @Get()
  listMeetings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MeetingResponse[]> {
    return this.queryBus.execute(new ListMeetingsQuery(user.id));
  }

  @Get(':id')
  getMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) meetingId: string,
  ): Promise<MeetingResponse> {
    return this.queryBus.execute(new GetMeetingQuery(user.id, meetingId));
  }
}
