import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { createUniqueEmail } from './test-users.js';

const ENDPOINTS = {
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
  PASSWORD: '/auth/password',
  PROFILE: '/profile',
  MEETINGS: '/meetings',
};

const VALID_PASSWORD = 'correct-horse-battery';
const NEW_PASSWORD = 'staple-battery-horse';
const OTHER_NEW_PASSWORD = 'battery-staple-correct';
const WRONG_PASSWORD = 'wrong-horse-battery';
const TOO_SHORT_PASSWORD = 'short';
const VALID_NAME = 'Ada Lovelace';
const MAX_NAME_LENGTH = 100;
const TOO_LONG_NAME_LENGTH = MAX_NAME_LENGTH + 1;
const TOO_LONG_NAME = 'a'.repeat(TOO_LONG_NAME_LENGTH);
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

// Read from the env that AppModule's ConfigModule loads, so call it only
// after the app has started.
function getAuthAttemptLimit(): number {
  const limit = Number(process.env.AUTH_ATTEMPT_LIMIT);
  // A missing value would run zero attempts and fail for the wrong reason.
  expect(limit).toBeGreaterThan(0);
  return limit;
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
      .send({ email, password, name: VALID_NAME });
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

    it('rejects a registration without a name', async () => {
      const email = createUniqueEmail();

      await request(app.getHttpServer())
        .post(ENDPOINTS.REGISTER)
        .send({ email, password: VALID_PASSWORD })
        .expect(HttpStatus.BAD_REQUEST);

      // The email is still free, so the refused request stored nothing.
      await registerUser(email, VALID_PASSWORD).expect(HttpStatus.CREATED);
    });

    it('rejects a registration with a name over 100 characters', async () => {
      const email = createUniqueEmail();

      await request(app.getHttpServer())
        .post(ENDPOINTS.REGISTER)
        .send({ email, password: VALID_PASSWORD, name: TOO_LONG_NAME })
        .expect(HttpStatus.BAD_REQUEST);

      await registerUser(email, VALID_PASSWORD).expect(HttpStatus.CREATED);
    });

    it.each([
      [
        'a malformed email',
        { email: 'not-an-email', password: VALID_PASSWORD, name: VALID_NAME },
      ],
      ['a missing email', { password: VALID_PASSWORD, name: VALID_NAME }],
      [
        'a password that is too short',
        {
          email: createUniqueEmail(),
          password: TOO_SHORT_PASSWORD,
          name: VALID_NAME,
        },
      ],
      ['a missing password', { email: createUniqueEmail(), name: VALID_NAME }],
      [
        'an empty name',
        { email: createUniqueEmail(), password: VALID_PASSWORD, name: '' },
      ],
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

    // Counted per account, not per IP: the web app signs every user in from
    // the same server.
    it('limits sign-in attempts per account', async () => {
      const email = createUniqueEmail();
      const otherEmail = createUniqueEmail();
      await registerUser(email, VALID_PASSWORD).expect(HttpStatus.CREATED);
      await registerUser(otherEmail, VALID_PASSWORD).expect(HttpStatus.CREATED);

      for (let attempt = 0; attempt < getAuthAttemptLimit(); attempt++) {
        await loginUser(email, WRONG_PASSWORD).expect(HttpStatus.UNAUTHORIZED);
      }

      await loginUser(email.toUpperCase(), VALID_PASSWORD).expect(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      await loginUser(otherEmail, VALID_PASSWORD).expect(HttpStatus.OK);
    });
  });

  describe(`POST ${ENDPOINTS.PASSWORD}`, () => {
    async function registerAndGetToken(email: string): Promise<string> {
      const response = await registerUser(email, VALID_PASSWORD).expect(
        HttpStatus.CREATED,
      );
      return response.body.accessToken as string;
    }

    function changePassword(
      accessToken: string,
      currentPassword: string,
      newPassword: string,
    ) {
      return request(app.getHttpServer())
        .post(ENDPOINTS.PASSWORD)
        .auth(accessToken, { type: 'bearer' })
        .send({ currentPassword, newPassword });
    }

    async function expectProtectedEndpointsStatus(
      accessToken: string,
      status: HttpStatus,
    ) {
      for (const endpoint of [ENDPOINTS.PROFILE, ENDPOINTS.MEETINGS]) {
        await request(app.getHttpServer())
          .get(endpoint)
          .auth(accessToken, { type: 'bearer' })
          .expect(status);
      }
    }

    it('changes the password so only the new one signs in', async () => {
      const email = createUniqueEmail();
      const accessToken = await registerAndGetToken(email);

      const response = await changePassword(
        accessToken,
        VALID_PASSWORD,
        NEW_PASSWORD,
      ).expect(HttpStatus.OK);

      expect(response.body).toEqual({ accessToken: expect.any(String) });
      expect(decodeJwtPayload(response.body.accessToken).sub).toBe(
        decodeJwtPayload(accessToken).sub,
      );
      await loginUser(email, VALID_PASSWORD).expect(HttpStatus.UNAUTHORIZED);
      await loginUser(email, NEW_PASSWORD).expect(HttpStatus.OK);
    });

    it('refuses a wrong current password and keeps the old one', async () => {
      const email = createUniqueEmail();
      const accessToken = await registerAndGetToken(email);

      await changePassword(accessToken, WRONG_PASSWORD, NEW_PASSWORD).expect(
        HttpStatus.FORBIDDEN,
      );

      await loginUser(email, VALID_PASSWORD).expect(HttpStatus.OK);
      await loginUser(email, NEW_PASSWORD).expect(HttpStatus.UNAUTHORIZED);
    });

    it('refuses a new password under 8 characters', async () => {
      const email = createUniqueEmail();
      const accessToken = await registerAndGetToken(email);

      await changePassword(
        accessToken,
        VALID_PASSWORD,
        TOO_SHORT_PASSWORD,
      ).expect(HttpStatus.BAD_REQUEST);

      await loginUser(email, VALID_PASSWORD).expect(HttpStatus.OK);
      await loginUser(email, TOO_SHORT_PASSWORD).expect(
        HttpStatus.UNAUTHORIZED,
      );
    });

    it('refuses a new password equal to the current one', async () => {
      const email = createUniqueEmail();
      const accessToken = await registerAndGetToken(email);

      await changePassword(accessToken, VALID_PASSWORD, VALID_PASSWORD).expect(
        HttpStatus.BAD_REQUEST,
      );

      await loginUser(email, VALID_PASSWORD).expect(HttpStatus.OK);
    });

    it('a password change rejects earlier tokens and accepts the returned one', async () => {
      const email = createUniqueEmail();
      const earlierToken = await registerAndGetToken(email);
      const loginResponse = await loginUser(email, VALID_PASSWORD).expect(
        HttpStatus.OK,
      );
      const earlierLoginToken = loginResponse.body.accessToken as string;

      const response = await changePassword(
        earlierToken,
        VALID_PASSWORD,
        NEW_PASSWORD,
      ).expect(HttpStatus.OK);
      const returnedToken = response.body.accessToken as string;

      await expectProtectedEndpointsStatus(
        earlierToken,
        HttpStatus.UNAUTHORIZED,
      );
      await expectProtectedEndpointsStatus(
        earlierLoginToken,
        HttpStatus.UNAUTHORIZED,
      );
      await expectProtectedEndpointsStatus(returnedToken, HttpStatus.OK);
    });

    // A double submit sends both requests with the same token before either
    // update lands; only one may win, or its returned token is already stale.
    it('concurrent changes from one token let exactly one succeed', async () => {
      const email = createUniqueEmail();
      const accessToken = await registerAndGetToken(email);

      const [firstResponse, secondResponse] = await Promise.all([
        changePassword(accessToken, VALID_PASSWORD, NEW_PASSWORD),
        changePassword(accessToken, VALID_PASSWORD, OTHER_NEW_PASSWORD),
      ]);
      const responses = [firstResponse, secondResponse];
      const winners = responses.filter(
        (response) => response.status === HttpStatus.OK,
      );
      const losers = responses.filter(
        (response) => response.status !== HttpStatus.OK,
      );

      expect(winners).toHaveLength(1);
      const [winner] = winners;
      const winnerPassword =
        winner === firstResponse ? NEW_PASSWORD : OTHER_NEW_PASSWORD;
      const loserPassword =
        winner === firstResponse ? OTHER_NEW_PASSWORD : NEW_PASSWORD;
      expect(losers.map((response) => response.status)).toEqual([
        HttpStatus.CONFLICT,
      ]);
      await expectProtectedEndpointsStatus(
        winner.body.accessToken as string,
        HttpStatus.OK,
      );
      await loginUser(email, winnerPassword).expect(HttpStatus.OK);
      await loginUser(email, loserPassword).expect(HttpStatus.UNAUTHORIZED);
    });

    it('limits password change attempts per account', async () => {
      const email = createUniqueEmail();
      const accessToken = await registerAndGetToken(email);

      for (let attempt = 0; attempt < getAuthAttemptLimit(); attempt++) {
        await changePassword(accessToken, WRONG_PASSWORD, NEW_PASSWORD).expect(
          HttpStatus.FORBIDDEN,
        );
      }

      await changePassword(accessToken, VALID_PASSWORD, NEW_PASSWORD).expect(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      await loginUser(email, VALID_PASSWORD).expect(HttpStatus.OK);
    });

    it('rejects a request without a token', async () => {
      await request(app.getHttpServer())
        .post(ENDPOINTS.PASSWORD)
        .send({ currentPassword: VALID_PASSWORD, newPassword: NEW_PASSWORD })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
