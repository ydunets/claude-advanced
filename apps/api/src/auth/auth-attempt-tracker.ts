import { normalizeEmail } from '../users/email.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

type AuthAttemptRequest = Partial<Pick<AuthenticatedRequest, 'user'>> & {
  body?: { email?: unknown };
};

// Attempts are counted per account, never per IP: the web app calls the API
// server to server, so every user arrives from the Next.js server's address.
// POST /auth/password runs after JwtAuthGuard and keys by user id; POST
// /auth/login keys by the submitted email, read before validation.
export function getAuthAttemptTracker(request: AuthAttemptRequest): string {
  if (request.user) {
    return request.user.id;
  }
  const email = request.body?.email;
  return typeof email === 'string' ? normalizeEmail(email) : '';
}
