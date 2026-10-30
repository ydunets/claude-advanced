import { NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../database/database.module.js';
import { meetings, type Meeting } from '../database/schema.js';

const MEETING_NOT_FOUND_MESSAGE = 'Meeting not found';

// Filtering by owner makes another user's meeting indistinguishable from a
// missing one, so the response never confirms that an id exists.
export async function getOwnedMeeting(
  database: Database,
  ownerId: string,
  meetingId: string,
): Promise<Meeting> {
  const [meeting] = await database
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.ownerId, ownerId)));
  if (!meeting) {
    throw new NotFoundException(MEETING_NOT_FOUND_MESSAGE);
  }
  return meeting;
}
