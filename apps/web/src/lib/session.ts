import { cookies } from 'next/headers';

export const ACCESS_TOKEN_COOKIE = 'accessToken';

export async function setAccessToken(accessToken: string): Promise<void> {
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

// The payload is decoded without verifying the signature, so the email is fit
// for display only. Every API call still verifies the token itself.
export function getTokenEmail(accessToken: string): string {
  const [, payload] = accessToken.split('.');
  const { email } = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as { email: string };
  return email;
}
