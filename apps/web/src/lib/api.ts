export const API_ENDPOINTS = {
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
  MEETINGS: '/meetings',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
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

export function buildBearerAuthorization(accessToken: string): string {
  return `Bearer ${accessToken}`;
}
