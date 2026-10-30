import {
  API_ENDPOINTS,
  buildBearerAuthorization,
  getApiUrl,
  getMeetingEndpoint,
  getMeetingFilesEndpoint,
  HTTP_STATUS,
} from './api';

// Mirrors MeetingResponse in apps/api/src/meetings/meeting-response.ts.
export type Meeting = {
  id: string;
  title: string;
  date: string;
  participants: string[];
};

// Mirrors MeetingFileResponse in apps/api/src/meetings/meeting-file-response.ts.
export type MeetingFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

// Resolves to null when the API rejects the token (expired or forged), so the
// caller can send the visitor back to the login page.
async function findFromApi<T>(
  accessToken: string,
  endpoint: string,
): Promise<T | null> {
  const response = await fetch(`${getApiUrl()}${endpoint}`, {
    headers: { Authorization: buildBearerAuthorization(accessToken) },
  });
  if (response.status === HTTP_STATUS.UNAUTHORIZED) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Loading ${endpoint} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export function findMeetings(accessToken: string): Promise<Meeting[] | null> {
  return findFromApi(accessToken, API_ENDPOINTS.MEETINGS);
}

export function findMeeting(
  accessToken: string,
  meetingId: string,
): Promise<Meeting | null> {
  return findFromApi(accessToken, getMeetingEndpoint(meetingId));
}

export function findMeetingFiles(
  accessToken: string,
  meetingId: string,
): Promise<MeetingFile[] | null> {
  return findFromApi(accessToken, getMeetingFilesEndpoint(meetingId));
}
