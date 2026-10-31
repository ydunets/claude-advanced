export const API_ENDPOINTS = {
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
  MEETINGS: '/meetings',
  PROFILE: '/profile',
} as const;

// The multipart field the API's FileInterceptor reads.
export const MEETING_FILE_FIELD = 'file';

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
} as const;

export function getApiUrl(): string {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    throw new Error('API_URL is not set; copy apps/web/.env.example to .env');
  }
  return apiUrl;
}

// The id comes from the page URL, so it is encoded to keep it one segment.
export function getMeetingEndpoint(meetingId: string): string {
  return `${API_ENDPOINTS.MEETINGS}/${encodeURIComponent(meetingId)}`;
}

export function getMeetingFilesEndpoint(meetingId: string): string {
  return `${getMeetingEndpoint(meetingId)}/files`;
}

export function getMeetingFileEndpoint(
  meetingId: string,
  fileId: string,
): string {
  return `${getMeetingFilesEndpoint(meetingId)}/${encodeURIComponent(fileId)}`;
}

// The API answers 404 for another owner's resource and 400 for an id that is
// not a UUID; for the visitor both mean the resource does not exist.
export function isMissingResourceStatus(status: number): boolean {
  return status === HTTP_STATUS.NOT_FOUND || status === HTTP_STATUS.BAD_REQUEST;
}

export function buildBearerAuthorization(accessToken: string): string {
  return `Bearer ${accessToken}`;
}

export function fetchFromApi(
  accessToken: string,
  endpoint: string,
): Promise<Response> {
  return fetch(`${getApiUrl()}${endpoint}`, {
    headers: { Authorization: buildBearerAuthorization(accessToken) },
  });
}

// Resolves to null when the API rejects the token (expired or forged), so the
// caller can send the visitor back to the login page.
export async function findApiJson<T>(
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
