import type { MeetingFile } from '../database/schema.js';

export type MeetingFileResponse = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export function toMeetingFileResponse(
  meetingFile: MeetingFile,
): MeetingFileResponse {
  return {
    id: meetingFile.id,
    name: meetingFile.originalName,
    mimeType: meetingFile.mimeType,
    size: meetingFile.sizeBytes,
    uploadedAt: meetingFile.uploadedAt.toISOString(),
  };
}
