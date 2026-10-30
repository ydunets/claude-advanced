import { randomBytes, randomUUID } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { DATABASE, type Database } from './../src/database/database.module.js';
import { meetingFiles } from './../src/database/schema.js';
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

// A non-ASCII name with a space checks both the UTF-8 decoding of uploads and
// the RFC 6266 encoding of the download header.
const REPORT_FILE = {
  name: 'Протокол встречи.pdf',
  mimeType: 'application/pdf',
  content: randomBytes(64 * 1024),
};
const RECORDING_FILE = { name: 'recording.mp4', mimeType: 'video/mp4' };
const EXECUTABLE_FILE = {
  name: 'setup.exe',
  mimeType: 'application/x-msdownload',
  content: Buffer.from('MZ'),
};
const ALLOWED_FORMATS = [
  'mp4',
  'webm',
  'mov',
  'mp3',
  'm4a',
  'wav',
  'ogg',
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'txt',
  'md',
];
const BYTES_PER_MEGABYTE = 1024 * 1024;
const PARTIAL_UPLOAD_BYTES = 256 * 1024;
const OVERSIZED_UPLOAD_TIMEOUT_MS = 60_000;
const STORAGE_WAIT_OPTIONS = { timeout: 2_000, interval: 50 };
const MALFORMED_FILE_ID = 'not-a-uuid';
const NO_SNIFF = 'nosniff';

function getMeetingFilesPath(meetingId: string): string {
  return `${ENDPOINTS.MEETINGS}/${meetingId}/files`;
}

function getMeetingFilePath(meetingId: string, fileId: string): string {
  return `${getMeetingFilesPath(meetingId)}/${fileId}`;
}

function collectBinaryBody(
  response: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
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

  function downloadFile(
    accessToken: string,
    meetingId: string,
    fileId: string,
  ) {
    return request(app.getHttpServer())
      .get(getMeetingFilePath(meetingId, fileId))
      .auth(accessToken, { type: 'bearer' })
      .buffer(true)
      .parse(collectBinaryBody);
  }

  function getStorageDir(): string {
    return app.get(ConfigService).getOrThrow<string>('FILES_STORAGE_DIR');
  }

  async function countStoredFiles(): Promise<number> {
    return (await readdir(getStorageDir())).length;
  }

  function getMaxFileSizeBytes(): number {
    return Number(
      app.get(ConfigService).getOrThrow<string>('MAX_FILE_SIZE_BYTES'),
    );
  }

  // Supertest cannot stop a body halfway, so this sends the multipart body by
  // hand, waits until multer has created the partial file, then drops the
  // connection.
  async function abortUploadAfterPartialWrite(
    accessToken: string,
    meetingId: string,
    storedFileCount: number,
  ): Promise<void> {
    const server = createServer(app.getHttpAdapter().getInstance());
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const boundary = `upload-${randomUUID()}`;
      const upload = httpRequest({
        port: (server.address() as AddressInfo).port,
        method: 'POST',
        path: getMeetingFilesPath(meetingId),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      });
      // destroy() below makes the request fail with ECONNRESET on purpose.
      upload.on('error', () => undefined);
      upload.write(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${FILE_FIELD}"; filename="${RECORDING_FILE.name}"\r\n` +
          `Content-Type: ${RECORDING_FILE.mimeType}\r\n\r\n`,
      );
      upload.write(randomBytes(PARTIAL_UPLOAD_BYTES));
      await vi.waitFor(async () => {
        expect(await countStoredFiles()).toBe(storedFileCount + 1);
      }, STORAGE_WAIT_OPTIONS);
      upload.destroy();
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }

  async function deleteStoredFile(fileId: string): Promise<void> {
    const [meetingFile] = await app
      .get<Database>(DATABASE)
      .select({ storageName: meetingFiles.storageName })
      .from(meetingFiles)
      .where(eq(meetingFiles.id, fileId));
    await rm(join(getStorageDir(), meetingFile.storageName));
  }

  async function uploadNotesAndGetId(
    accessToken: string,
    meetingId: string,
  ): Promise<string> {
    const response = await uploadFile(
      accessToken,
      meetingId,
      NOTES_FILE.content,
      NOTES_FILE.name,
      NOTES_FILE.mimeType,
    ).expect(HttpStatus.CREATED);
    return response.body.id as string;
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

  describe('upload limits', () => {
    it(
      'rejects a file over the size limit and keeps the list unchanged',
      async () => {
        const accessToken = await registerUserAndGetToken(app);
        const meetingId = await createMeetingAndGetId(accessToken);
        const storedFileCount = await countStoredFiles();
        const maxFileSizeBytes = getMaxFileSizeBytes();

        const response = await uploadFile(
          accessToken,
          meetingId,
          Buffer.alloc(maxFileSizeBytes + 1),
          RECORDING_FILE.name,
          RECORDING_FILE.mimeType,
        ).expect(HttpStatus.PAYLOAD_TOO_LARGE);

        expect(response.body).toEqual({
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          message: expect.stringContaining(
            `${maxFileSizeBytes / BYTES_PER_MEGABYTE} MB`,
          ),
          error: 'Payload Too Large',
        });
        const listed = await listFiles(accessToken, meetingId).expect(
          HttpStatus.OK,
        );
        expect(listed.body).toEqual([]);
        expect(await countStoredFiles()).toBe(storedFileCount);
      },
      OVERSIZED_UPLOAD_TIMEOUT_MS,
    );

    it('rejects a disallowed format and names the allowed ones', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const meetingId = await createMeetingAndGetId(accessToken);
      const storedFileCount = await countStoredFiles();

      const response = await uploadFile(
        accessToken,
        meetingId,
        EXECUTABLE_FILE.content,
        EXECUTABLE_FILE.name,
        EXECUTABLE_FILE.mimeType,
      ).expect(HttpStatus.UNSUPPORTED_MEDIA_TYPE);

      expect(response.body).toEqual({
        statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        message: expect.any(String),
        error: 'Unsupported Media Type',
      });
      for (const format of ALLOWED_FORMATS) {
        expect(response.body.message).toContain(format);
      }
      const listed = await listFiles(accessToken, meetingId).expect(
        HttpStatus.OK,
      );
      expect(listed.body).toEqual([]);
      expect(await countStoredFiles()).toBe(storedFileCount);
    });

    it('an aborted upload leaves no listed file and no file on disk', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const meetingId = await createMeetingAndGetId(accessToken);
      const storedFileCount = await countStoredFiles();

      await abortUploadAfterPartialWrite(
        accessToken,
        meetingId,
        storedFileCount,
      );

      await vi.waitFor(async () => {
        expect(await countStoredFiles()).toBe(storedFileCount);
      }, STORAGE_WAIT_OPTIONS);

      const listed = await listFiles(accessToken, meetingId).expect(
        HttpStatus.OK,
      );
      expect(listed.body).toEqual([]);
    });
  });

  describe('download', () => {
    it('downloads the exact bytes that were uploaded', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const meetingId = await createMeetingAndGetId(accessToken);
      const uploaded = await uploadFile(
        accessToken,
        meetingId,
        REPORT_FILE.content,
        REPORT_FILE.name,
        REPORT_FILE.mimeType,
      ).expect(HttpStatus.CREATED);

      const response = await downloadFile(
        accessToken,
        meetingId,
        uploaded.body.id as string,
      ).expect(HttpStatus.OK);

      expect(uploaded.body.name).toBe(REPORT_FILE.name);
      expect(Buffer.compare(response.body as Buffer, REPORT_FILE.content)).toBe(
        0,
      );
      expect(response.headers['content-type']).toBe(REPORT_FILE.mimeType);
      expect(response.headers['content-length']).toBe(
        String(REPORT_FILE.content.length),
      );
      expect(response.headers['content-disposition']).toMatch(/^attachment;/);
      expect(response.headers['content-disposition']).toContain(
        `filename*=UTF-8''${encodeURIComponent(REPORT_FILE.name)}`,
      );
      expect(response.headers['x-content-type-options']).toBe(NO_SNIFF);
    });

    it('returns 404 for an unknown file id', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const meetingId = await createMeetingAndGetId(accessToken);
      const fileId = await uploadNotesAndGetId(accessToken, meetingId);
      await downloadFile(accessToken, meetingId, fileId).expect(HttpStatus.OK);

      await downloadFile(accessToken, meetingId, randomUUID()).expect(
        HttpStatus.NOT_FOUND,
      );
    });

    // The row survives a lost disk file, so the lookup alone cannot answer 404.
    it('returns 404 when the stored file is gone from disk', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const meetingId = await createMeetingAndGetId(accessToken);
      const fileId = await uploadNotesAndGetId(accessToken, meetingId);
      await deleteStoredFile(fileId);

      await downloadFile(accessToken, meetingId, fileId).expect(
        HttpStatus.NOT_FOUND,
      );
    });

    it('rejects a file id that is not a UUID', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const meetingId = await createMeetingAndGetId(accessToken);

      await downloadFile(accessToken, meetingId, MALFORMED_FILE_ID).expect(
        HttpStatus.BAD_REQUEST,
      );
    });
  });

  describe('owner isolation', () => {
    // 403 would confirm that the meeting exists; 404 reveals nothing.
    it('returns 404 to another user on upload, list and download', async () => {
      const ownerToken = await registerUserAndGetToken(app);
      const otherUserToken = await registerUserAndGetToken(app);
      const meetingId = await createMeetingAndGetId(ownerToken);
      const fileId = await uploadNotesAndGetId(ownerToken, meetingId);
      await downloadFile(ownerToken, meetingId, fileId).expect(HttpStatus.OK);
      const storedFileCount = await countStoredFiles();

      await uploadFile(
        otherUserToken,
        meetingId,
        NOTES_FILE.content,
        NOTES_FILE.name,
        NOTES_FILE.mimeType,
      ).expect(HttpStatus.NOT_FOUND);
      await listFiles(otherUserToken, meetingId).expect(HttpStatus.NOT_FOUND);
      await downloadFile(otherUserToken, meetingId, fileId).expect(
        HttpStatus.NOT_FOUND,
      );

      expect(await countStoredFiles()).toBe(storedFileCount);
      const ownerList = await listFiles(ownerToken, meetingId).expect(
        HttpStatus.OK,
      );
      expect(ownerList.body).toHaveLength(1);
    });

    it('does not serve a file through a different meeting id', async () => {
      const accessToken = await registerUserAndGetToken(app);
      const meetingWithFileId = await createMeetingAndGetId(accessToken);
      const otherMeetingId = await createMeetingAndGetId(accessToken);
      const fileId = await uploadNotesAndGetId(accessToken, meetingWithFileId);
      await downloadFile(accessToken, meetingWithFileId, fileId).expect(
        HttpStatus.OK,
      );

      await downloadFile(accessToken, otherMeetingId, fileId).expect(
        HttpStatus.NOT_FOUND,
      );
    });
  });
});
