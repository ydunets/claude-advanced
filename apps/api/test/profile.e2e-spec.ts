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

      expect(response.body).toEqual({ name: VALID_NAME, email });
    });

    it('rejects a request without a token', async () => {
      await request(app.getHttpServer())
        .get(ENDPOINTS.PROFILE)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
