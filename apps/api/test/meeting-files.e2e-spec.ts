import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { registerUserAndGetToken } from './test-users.js';

const ENDPOINTS = {
  MEETINGS: '/meetings',
};

const FILE_FIELD = 'file';
const NOTES_FILE = {
  name: 'notes.txt',
  mimeType: 'text/plain',
  content: Buffer.from('Agenda: ship the file upload.'),
};

function getMeetingFilesPath(meetingId: string): string {
  return `${ENDPOINTS.MEETINGS}/${meetingId}/files`;
}

describe('Meeting files (e2e)', () => {
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

  async function createMeetingAndGetId(accessToken: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(ENDPOINTS.MEETINGS)
      .auth(accessToken, { type: 'bearer' })
      .send({
        title: 'Design review',
        date: '2026-11-10T11:00:00.000Z',
        participants: [],
      })
      .expect(HttpStatus.CREATED);
    return response.body.id as string;
  }

  function uploadFile(
    accessToken: string,
    meetingId: string,
    content: Buffer,
    name: string,
    mimeType: string,
  ) {
    return request(app.getHttpServer())
      .post(getMeetingFilesPath(meetingId))
      .auth(accessToken, { type: 'bearer' })
      .attach(FILE_FIELD, content, { filename: name, contentType: mimeType });
  }

  function listFiles(accessToken: string, meetingId: string) {
    return request(app.getHttpServer())
      .get(getMeetingFilesPath(meetingId))
      .auth(accessToken, { type: 'bearer' });
  }

  it('uploads a file and lists it with name, type, size and upload date', async () => {
    const accessToken = await registerUserAndGetToken(app);
    const meetingId = await createMeetingAndGetId(accessToken);

    const uploaded = await uploadFile(
      accessToken,
      meetingId,
      NOTES_FILE.content,
      NOTES_FILE.name,
      NOTES_FILE.mimeType,
    ).expect(HttpStatus.CREATED);

    expect(uploaded.body).toEqual({
      id: expect.any(String),
      name: NOTES_FILE.name,
      mimeType: NOTES_FILE.mimeType,
      size: NOTES_FILE.content.length,
      uploadedAt: expect.any(String),
    });
    expect(new Date(uploaded.body.uploadedAt as string).toISOString()).toBe(
      uploaded.body.uploadedAt,
    );
    const listed = await listFiles(accessToken, meetingId).expect(
      HttpStatus.OK,
    );
    expect(listed.body).toEqual([uploaded.body]);
  });

  it('lists two files uploaded under the same name', async () => {
    const accessToken = await registerUserAndGetToken(app);
    const meetingId = await createMeetingAndGetId(accessToken);
    const secondContent = Buffer.from('Revised agenda.');

    const first = await uploadFile(
      accessToken,
      meetingId,
      NOTES_FILE.content,
      NOTES_FILE.name,
      NOTES_FILE.mimeType,
    ).expect(HttpStatus.CREATED);
    const second = await uploadFile(
      accessToken,
      meetingId,
      secondContent,
      NOTES_FILE.name,
      NOTES_FILE.mimeType,
    ).expect(HttpStatus.CREATED);

    const listed = await listFiles(accessToken, meetingId).expect(
      HttpStatus.OK,
    );
    expect(second.body.id).not.toBe(first.body.id);
    expect(second.body.size).toBe(secondContent.length);
    expect(listed.body).toEqual([first.body, second.body]);
  });
});
