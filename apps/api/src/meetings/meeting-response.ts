import type { Meeting } from '../database/schema.js';

export type MeetingResponse = {
  id: string;
  title: string;
  date: string;
  participants: string[];
};

export function toMeetingResponse(meeting: Meeting): MeetingResponse {
  return {
    id: meeting.id,
    title: meeting.title,
    date: meeting.date.toISOString(),
    participants: meeting.participants,
  };
}
