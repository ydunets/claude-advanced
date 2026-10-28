import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { asc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { meetings } from '../../database/schema.js';
import {
  toMeetingResponse,
  type MeetingResponse,
} from '../meeting-response.js';
import { ListMeetingsQuery } from './list-meetings.query.js';

@QueryHandler(ListMeetingsQuery)
export class ListMeetingsHandler implements IQueryHandler<ListMeetingsQuery> {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async execute({ ownerId }: ListMeetingsQuery): Promise<MeetingResponse[]> {
    const ownedMeetings = await this.database
      .select()
      .from(meetings)
      .where(eq(meetings.ownerId, ownerId))
      .orderBy(asc(meetings.date));
    return ownedMeetings.map(toMeetingResponse);
  }
}
