import { API_ENDPOINTS, getApiUrl, HTTP_STATUS } from './api';

// Mirrors MeetingResponse in apps/api/src/meetings/meeting-response.ts.
export type Meeting = {
  id: string;
  title: string;
  date: string;
  participants: string[];
};

// Resolves to null when the API rejects the token (expired or forged), so the
// caller can send the visitor back to the login page.
export async function findMeetings(
  accessToken: string,
): Promise<Meeting[] | null> {
  const response = await fetch(`${getApiUrl()}${API_ENDPOINTS.MEETINGS}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === HTTP_STATUS.UNAUTHORIZED) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Loading meetings failed with ${response.status}`);
  }
  return (await response.json()) as Meeting[];
}
