export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
} as const;

export function getMeetingRoute(meetingId: string): string {
  return `/meetings/${meetingId}`;
}

export function getMeetingFilesRoute(meetingId: string): string {
  return `${getMeetingRoute(meetingId)}/files`;
}
