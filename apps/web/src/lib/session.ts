import { cookies } from 'next/headers';

export const ACCESS_TOKEN_COOKIE = 'accessToken';

// Reads the `{ accessToken }` body that sign-in, registration and a password
// change return, and stores the token as this browser's session.
export async function storeIssuedAccessToken(
  response: Response,
): Promise<void> {
  const { accessToken } = (await response.json()) as { accessToken: string };
  await setAccessToken(accessToken);
}

async function setAccessToken(accessToken: string): Promise<void> {
  // ponytail: session cookie, the API enforces the JWT expiry on each request.
  (await cookies()).set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function deleteAccessToken(): Promise<void> {
  (await cookies()).delete(ACCESS_TOKEN_COOKIE);
}

export async function findAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
}
