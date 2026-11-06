import { API_ENDPOINTS, fetchFromApi, findApiJson } from './api';

// Mirrors ProfileResponse in apps/api/src/profile/profile-response.ts.
export type Profile = {
  name: string;
  email: string;
  // Changes on every upload; null without an avatar.
  avatarId: string | null;
};

export async function findProfile(
  accessToken: string,
): Promise<Profile | null> {
  return findApiJson(
    await fetchFromApi(accessToken, API_ENDPOINTS.PROFILE),
    API_ENDPOINTS.PROFILE,
  );
}
