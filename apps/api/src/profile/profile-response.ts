import type { User } from '../database/schema.js';

// avatarId is the stored avatar's random name, so every upload changes it;
// null without an avatar.
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
