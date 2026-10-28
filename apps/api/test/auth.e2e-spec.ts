import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { createUniqueEmail } from './test-users.js';

const ENDPOINTS = {
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
};

const VALID_PASSWORD = 'correct-horse-battery';
const WRONG_PASSWORD = 'wrong-horse-battery';
const TOO_SHORT_PASSWORD = 'short';
const JWT_SEGMENT_COUNT = 3;

type JwtPayload = { sub: string; email: string; exp: number };

// Reads the claims without verifying the signature: the tests check what the
// token carries, the signature is the JWT library's responsibility.
function decodeJwtPayload(token: string): JwtPayload {
  const segments = token.split('.');
  expect(segments).toHaveLength(JWT_SEGMENT_COUNT);
  return JSON.parse(
    Buffer.from(segments[1], 'base64url').toString('utf8'),
  ) as JwtPayload;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function registerUser(email: string, password: string) {
    return request(app.getHttpServer())
      .post(ENDPOINTS.REGISTER)
      .send({ email, password });
  }

  function loginUser(email: string, password: string) {
    return request(app.getHttpServer())
      .post(ENDPOINTS.LOGIN)
      .send({ email, password });
  }

  describe(`POST ${ENDPOINTS.REGISTER}`, () => {
    it('creates a user and returns a JWT that identifies it', async () => {
      const email = createUniqueEmail();

      const response = await registerUser(email, VALID_PASSWORD).expect(
        HttpStatus.CREATED,
      );

      expect(response.body).toEqual({ accessToken: expect.any(String) });
      const payload = decodeJwtPayload(response.body.accessToken);
      expect(payload.email).toBe(email);
      expect(payload.sub).toEqual(expect.any(String));
      expect(payload.exp * 1000).toBeGreaterThan(Date.now());
    });

    it('never returns the password or its hash', async () => {
      const response = await registerUser(
        createUniqueEmail(),
        VALID_PASSWORD,
      ).expect(HttpStatus.CREATED);

      expect(JSON.stringify(response.body)).not.toContain(VALID_PASSWORD);
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('rejects a second registration with the same email', async () => {
      const email = createUniqueEmail();
      await registerUser(email, VALID_PASSWORD).expect(HttpStatus.CREATED);

      await registerUser(email, VALID_PASSWORD).expect(HttpStatus.CONFLICT);
    });

    it('treats email case-insensitively when checking for duplicates', async () => {
      const email = createUniqueEmail();
      await registerUser(email, VALID_PASSWORD).expect(HttpStatus.CREATED);

      await registerUser(email.toUpperCase(), VALID_PASSWORD).expect(
        HttpStatus.CONFLICT,
      );
    });

    it.each([
      [
        'a malformed email',
        { email: 'not-an-email', password: VALID_PASSWORD },
      ],
      ['a missing email', { password: VALID_PASSWORD }],
      [
        'a password that is too short',
        { email: createUniqueEmail(), password: TOO_SHORT_PASSWORD },
      ],
      ['a missing password', { email: createUniqueEmail() }],
    ])('rejects %s', async (_case, body) => {
      await request(app.getHttpServer())
        .post(ENDPOINTS.REGISTER)
        .send(body)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe(`POST ${ENDPOINTS.LOGIN}`, () => {
    it('returns a JWT for the same user that registration created', async () => {
      const email = createUniqueEmail();
      const registration = await registerUser(email, VALID_PASSWORD).expect(
        HttpStatus.CREATED,
      );

      const response = await loginUser(email, VALID_PASSWORD).expect(
        HttpStatus.OK,
      );

      expect(response.body).toEqual({ accessToken: expect.any(String) });
      const loginPayload = decodeJwtPayload(response.body.accessToken);
      const registrationPayload = decodeJwtPayload(
        registration.body.accessToken,
      );
      expect(loginPayload.email).toBe(email);
      expect(loginPayload.sub).toBe(registrationPayload.sub);
    });

    it('finds the user regardless of email case', async () => {
      const email = createUniqueEmail();
      await registerUser(email, VALID_PASSWORD).expect(HttpStatus.CREATED);

      await loginUser(email.toUpperCase(), VALID_PASSWORD).expect(
        HttpStatus.OK,
      );
    });

    it('rejects a wrong password', async () => {
      const email = createUniqueEmail();
      await registerUser(email, VALID_PASSWORD).expect(HttpStatus.CREATED);

      await loginUser(email, WRONG_PASSWORD).expect(HttpStatus.UNAUTHORIZED);
    });

    it('rejects an unknown email with the same status as a wrong password', async () => {
      await loginUser(createUniqueEmail(), VALID_PASSWORD).expect(
        HttpStatus.UNAUTHORIZED,
      );
    });

    it('does not create a user when the email is unknown', async () => {
      const email = createUniqueEmail();
      await loginUser(email, VALID_PASSWORD).expect(HttpStatus.UNAUTHORIZED);

      // A second failed login proves nothing was stored by the first one,
      // and a successful registration proves the email is still free.
      await loginUser(email, VALID_PASSWORD).expect(HttpStatus.UNAUTHORIZED);
      await registerUser(email, VALID_PASSWORD).expect(HttpStatus.CREATED);
    });

    it('rejects a malformed request body', async () => {
      await request(app.getHttpServer())
        .post(ENDPOINTS.LOGIN)
        .send({ email: 'not-an-email' })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });
});
