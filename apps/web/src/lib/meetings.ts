import { notFound } from 'next/navigation';
import {
  API_ENDPOINTS,
  buildBearerAuthorization,
  getApiUrl,
  getMeetingEndpoint,
  getMeetingFilesEndpoint,
  HTTP_STATUS,
  isMissingResourceStatus,
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

function fetchFromApi(
  accessToken: string,
  endpoint: string,
): Promise<Response> {
  return fetch(`${getApiUrl()}${endpoint}`, {
    headers: { Authorization: buildBearerAuthorization(accessToken) },
  });
}

// Resolves to null when the API rejects the token (expired or forged), so the
// caller can send the visitor back to the login page.
async function findApiJson<T>(
  response: Response,
  endpoint: string,
): Promise<T | null> {
  if (response.status === HTTP_STATUS.UNAUTHORIZED) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Loading ${endpoint} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

// A meeting the visitor cannot see renders the segment's not-found page;
// notFound() throws, so this runs inside the page render.
async function findMeetingResource<T>(
  accessToken: string,
  endpoint: string,
): Promise<T | null> {
  const response = await fetchFromApi(accessToken, endpoint);
  if (isMissingResourceStatus(response.status)) {
    notFound();
  }
  return findApiJson<T>(response, endpoint);
}

export async function findMeetings(
  accessToken: string,
): Promise<Meeting[] | null> {
  return findApiJson(
    await fetchFromApi(accessToken, API_ENDPOINTS.MEETINGS),
    API_ENDPOINTS.MEETINGS,
  );
}

export function findMeeting(
  accessToken: string,
  meetingId: string,
): Promise<Meeting | null> {
  return findMeetingResource(accessToken, getMeetingEndpoint(meetingId));
}

export function findMeetingFiles(
  accessToken: string,
  meetingId: string,
): Promise<MeetingFile[] | null> {
  return findMeetingResource(accessToken, getMeetingFilesEndpoint(meetingId));
}
