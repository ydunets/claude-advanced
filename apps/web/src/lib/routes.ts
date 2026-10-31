export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  PROFILE: '/profile',
} as const;

export function getMeetingRoute(meetingId: string): string {
  return `/meetings/${meetingId}`;
}

export function getMeetingFilesRoute(meetingId: string): string {
  return `${getMeetingRoute(meetingId)}/files`;
}

export function getMeetingFileRoute(meetingId: string, fileId: string): string {
  return `${getMeetingFilesRoute(meetingId)}/${fileId}`;
}
