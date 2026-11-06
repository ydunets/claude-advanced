import type { User } from '../database/schema.js';

// avatarId changes on every upload, so the web app can put it in the image
// address and never show a replaced avatar from the browser cache.
export type ProfileResponse = {
  name: string;
  email: string;
  avatarId: string | null;
};

export function toProfileResponse(
  user: Pick<User, 'name' | 'email' | 'avatarStorageName'>,
): ProfileResponse {
  return {
    name: user.name,
    email: user.email,
    avatarId: user.avatarStorageName,
  };
}
