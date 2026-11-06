import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { createUniqueEmail } from './test-users.js';

const ENDPOINTS = {
  REGISTER: '/auth/register',
  PROFILE: '/profile',
};

const VALID_PASSWORD = 'correct-horse-battery';
const VALID_NAME = 'Grace Hopper';
const OTHER_NAME = 'Alan Turing';
const UPDATED_NAME = 'Anna Maria Lee';
const MAX_NAME_LENGTH = 100;
const TOO_LONG_NAME_LENGTH = MAX_NAME_LENGTH + 1;
const TOO_LONG_NAME = 'a'.repeat(TOO_LONG_NAME_LENGTH);

describe('Profile (e2e)', () => {
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

  async function registerAndGetToken(name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(ENDPOINTS.REGISTER)
      .send({ email: createUniqueEmail(), password: VALID_PASSWORD, name })
      .expect(HttpStatus.CREATED);
    return response.body.accessToken as string;
  }

  function updateProfile(token: string, body: { name: string }) {
    return request(app.getHttpServer())
      .patch(ENDPOINTS.PROFILE)
      .auth(token, { type: 'bearer' })
      .send(body);
  }

  async function getProfileName(token: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .get(ENDPOINTS.PROFILE)
      .auth(token, { type: 'bearer' })
      .expect(HttpStatus.OK);
    return response.body.name as string;
  }

  describe(`GET ${ENDPOINTS.PROFILE}`, () => {
    it("returns the signed-in user's name and email", async () => {
      const email = createUniqueEmail();
      const registration = await request(app.getHttpServer())
        .post(ENDPOINTS.REGISTER)
        .send({ email, password: VALID_PASSWORD, name: VALID_NAME })
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .get(ENDPOINTS.PROFILE)
        .auth(registration.body.accessToken as string, { type: 'bearer' })
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        name: VALID_NAME,
        email,
        avatarId: null,
      });
    });

    it('rejects a request without a token', async () => {
      await request(app.getHttpServer())
        .get(ENDPOINTS.PROFILE)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe(`PATCH ${ENDPOINTS.PROFILE}`, () => {
    it('updates the name and trims surrounding spaces', async () => {
      const token = await registerAndGetToken(VALID_NAME);

      const response = await updateProfile(token, {
        name: `  ${UPDATED_NAME}  `,
      }).expect(HttpStatus.OK);

      expect(response.body).toEqual({
        name: UPDATED_NAME,
        email: expect.any(String),
        avatarId: null,
      });
      expect(await getProfileName(token)).toBe(UPDATED_NAME);
    });

    it.each([
      ['an empty name', ''],
      ['a spaces-only name', '   '],
    ])('rejects an empty or spaces-only name: %s', async (_case, name) => {
      const token = await registerAndGetToken(VALID_NAME);

      await updateProfile(token, { name }).expect(HttpStatus.BAD_REQUEST);

      expect(await getProfileName(token)).toBe(VALID_NAME);
    });

    it('rejects a name over 100 characters', async () => {
      const token = await registerAndGetToken(VALID_NAME);

      await updateProfile(token, { name: TOO_LONG_NAME }).expect(
        HttpStatus.BAD_REQUEST,
      );

      expect(await getProfileName(token)).toBe(VALID_NAME);
    });

    it("another user's token never changes this user's profile", async () => {
      const ownerToken = await registerAndGetToken(VALID_NAME);
      const otherToken = await registerAndGetToken(OTHER_NAME);
      await updateProfile(ownerToken, { name: UPDATED_NAME }).expect(
        HttpStatus.OK,
      );

      await updateProfile(otherToken, { name: VALID_NAME }).expect(
        HttpStatus.OK,
      );

      expect(await getProfileName(ownerToken)).toBe(UPDATED_NAME);
      expect(await getProfileName(otherToken)).toBe(VALID_NAME);
    });

    it('rejects a request without a token', async () => {
      await request(app.getHttpServer())
        .patch(ENDPOINTS.PROFILE)
        .send({ name: UPDATED_NAME })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
