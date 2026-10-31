import { randomUUID } from 'node:crypto';
import { HttpStatus, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

const REGISTER_ENDPOINT = '/auth/register';
const TEST_PASSWORD = 'correct-horse-battery';
const TEST_NAME = 'Ada Lovelace';

// Every test uses its own email, so suites need no database cleanup and can
// run repeatedly against the same Postgres instance.
export function createUniqueEmail(): string {
  return `user-${randomUUID()}@example.com`;
}

// Goes through the real registration endpoint, so protected modules are
// exercised with exactly the tokens clients receive.
export async function registerUserAndGetToken(
  app: INestApplication<App>,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post(REGISTER_ENDPOINT)
    .send({
      email: createUniqueEmail(),
      password: TEST_PASSWORD,
      name: TEST_NAME,
    })
    .expect(HttpStatus.CREATED);
  return response.body.accessToken as string;
}
