import { randomUUID } from 'node:crypto';

// Every test uses its own email, so suites need no database cleanup and can
// run repeatedly against the same Postgres instance.
export function createUniqueEmail(): string {
  return `user-${randomUUID()}@example.com`;
}
