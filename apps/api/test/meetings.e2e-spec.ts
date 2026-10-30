import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { createUniqueEmail, registerUserAndGetToken } from './test-users.js';

const ENDPOINTS = {
  MEETINGS: '/meetings',
};

const MALFORMED_TOKEN = 'not-a-jwt';
const MALFORMED_MEETING_ID = 'not-a-uuid';

type MeetingInput = { title: string; date: string; participants: string[] };

function buildMeetingInput(
  overrides: Partial<MeetingInput> = {},
): MeetingInput {
  return {
    title: 'Sprint planning',
    date: '2026-11-03T10:00:00.000Z',
    participants: [createUniqueEmail(), createUniqueEmail()],
    ...overrides,
  };
}

function getMeetingPath(meetingId: string): string {
  return `${ENDPOINTS.MEETINGS}/${meetingId}`;
}

describe('Meetings (e2e)', () => {
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

  function createMeeting(accessToken: string, body: object) {
    return request(app.getHttpServer())
      .post(ENDPOINTS.MEETINGS)
      .auth(accessToken, { type: 'bearer' })
      .send(body);
  }

  function listMeetings(accessToken: string) {
    return request(app.getHttpServer())
      .get(ENDPOINTS.MEETINGS)
      .auth(accessToken, { type: 'bearer' });
  }

  function getMeeting(accessToken: string, meetingId: string) {
    return request(app.getHttpServer())
      .get(getMeetingPath(meetingId))
      .auth(accessToken, { type: 'bearer' });
  }

  describe('authorization', () => {
    it.each([
      ['POST', ENDPOINTS.MEETINGS, ENDPOINTS.MEETINGS],
      ['GET', ENDPOINTS.MEETINGS, ENDPOINTS.MEETINGS],
      ['GET', `${ENDPOINTS.MEETINGS}/:id`, getMeetingPath(randomUUID())],
    ] as const)(
      '%s %s rejects a request without a token',
      async (method, _route, path) => {
        const server = request(app.getHttpServer());
        const pendingRequest =
          method === 'POST'
            ? server.post(path).send(buildMeetingInput())
            : server.get(path);

        await pendingRequest.expect(HttpStatus.UNAUTHORIZED);
      },
    );

    it('rejects a malformed token', async () => {
      await listMeetings(MALFORMED_TOKEN).expect(HttpStatus.UNAUTHORIZED);
    });

    it('rejects a token signed with a different secret', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const [header, payload] = accessToken.split('.');
      const forgedToken = `${header}.${payload}.${Buffer.from('forged').toString('base64url')}`;

      await listMeetings(forgedToken).expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe(`POST ${ENDPOINTS.MEETINGS}`, () => {
    it('creates a meeting and returns it with a generated id', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const meetingInput = buildMeetingInput();

      const response = await createMeeting(accessToken, meetingInput).expect(
        HttpStatus.CREATED,
      );

      expect(response.body).toEqual({
        id: expect.any(String),
        title: meetingInput.title,
        date: meetingInput.date,
        participants: meetingInput.participants,
      });
    });

    it('accepts a meeting with no participants', async () => {
      const accessToken = await registerUserAndGetToken(app);

      const response = await createMeeting(
        accessToken,
        buildMeetingInput({ participants: [] }),
      ).expect(HttpStatus.CREATED);

      expect(response.body.participants).toEqual([]);
    });

    it.each([
      ['a missing title', { title: undefined }],
      ['an empty title', { title: '' }],
      ['a missing date', { date: undefined }],
      ['a date that is not ISO 8601', { date: 'next tuesday' }],
      ['missing participants', { participants: undefined }],
      ['participants that are not a list', { participants: 'bob@example.com' }],
      ['a participant that is not an email', { participants: ['bob'] }],
    ])('rejects %s', async (_case, overrides) => {
      const accessToken = await registerUserAndGetToken(app);

      await createMeeting(accessToken, {
        ...buildMeetingInput(),
        ...overrides,
      }).expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe(`GET ${ENDPOINTS.MEETINGS}`, () => {
    it('returns an empty list for a user without meetings', async () => {
      const accessToken = await registerUserAndGetToken(app);

      const response = await listMeetings(accessToken).expect(HttpStatus.OK);

      expect(response.body).toEqual([]);
    });

    it('returns every meeting the current user created', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const planning = await createMeeting(
        accessToken,
        buildMeetingInput({ title: 'Planning' }),
      ).expect(HttpStatus.CREATED);
      const retro = await createMeeting(
        accessToken,
        buildMeetingInput({ title: 'Retro' }),
      ).expect(HttpStatus.CREATED);

      const response = await listMeetings(accessToken).expect(HttpStatus.OK);

      expect(response.body).toHaveLength(2);
      expect(response.body).toEqual(
        expect.arrayContaining([planning.body, retro.body]),
      );
    });

    it("does not include other users' meetings", async () => {
      const ownerToken = await registerUserAndGetToken(app);
      const otherUserToken = await registerUserAndGetToken(app);
      await createMeeting(otherUserToken, buildMeetingInput()).expect(
        HttpStatus.CREATED,
      );

      const response = await listMeetings(ownerToken).expect(HttpStatus.OK);

      expect(response.body).toEqual([]);
    });
  });

  describe(`GET ${ENDPOINTS.MEETINGS}/:id`, () => {
    it('returns the meeting with the given id', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const created = await createMeeting(
        accessToken,
        buildMeetingInput(),
      ).expect(HttpStatus.CREATED);

      const response = await getMeeting(accessToken, created.body.id).expect(
        HttpStatus.OK,
      );

      expect(response.body).toEqual(created.body);
    });

    it('returns 404 when no meeting has the given id', async () => {
      const accessToken = await registerUserAndGetToken(app);
      // An existing meeting proves the route works, so the 404 below comes
      // from the lookup and not from a missing route.
      await createMeeting(accessToken, buildMeetingInput()).expect(
        HttpStatus.CREATED,
      );

      await getMeeting(accessToken, randomUUID()).expect(HttpStatus.NOT_FOUND);
    });

    // Answering 403 would confirm that the id exists; 404 reveals nothing.
    it("returns 404 for another user's meeting", async () => {
      const ownerToken = await registerUserAndGetToken(app);
      const otherUserToken = await registerUserAndGetToken(app);
      const created = await createMeeting(
        ownerToken,
        buildMeetingInput(),
      ).expect(HttpStatus.CREATED);

      await getMeeting(otherUserToken, created.body.id).expect(
        HttpStatus.NOT_FOUND,
      );
    });

    it('rejects an id that is not a UUID', async () => {
      const accessToken = await registerUserAndGetToken(app);

      await getMeeting(accessToken, MALFORMED_MEETING_ID).expect(
        HttpStatus.BAD_REQUEST,
      );
    });
  });
});
