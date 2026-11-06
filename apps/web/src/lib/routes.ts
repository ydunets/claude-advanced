export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  PROFILE: '/profile',
  PROFILE_AVATAR: '/profile/avatar',
} as const;

// The id changes on every upload, so a replaced image never comes from the
// browser cache.
export function getAvatarImageRoute(avatarId: string): string {
  return `${ROUTES.PROFILE_AVATAR}?v=${encodeURIComponent(avatarId)}`;
}

export function getMeetingRoute(meetingId: string): string {
  return `/meetings/${meetingId}`;
}

export function getMeetingFilesRoute(meetingId: string): string {
  return `${getMeetingRoute(meetingId)}/files`;
}

export function getMeetingFileRoute(meetingId: string, fileId: string): string {
  return `${getMeetingFilesRoute(meetingId)}/${fileId}`;
}
