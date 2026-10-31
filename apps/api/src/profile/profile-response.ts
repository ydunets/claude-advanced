import type { User } from '../database/schema.js';

export type ProfileResponse = {
  name: string;
  email: string;
};

export function toProfileResponse(user: User): ProfileResponse {
  return { name: user.name, email: user.email };
}
