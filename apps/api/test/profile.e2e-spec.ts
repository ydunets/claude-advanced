import { randomBytes } from 'node:crypto';
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { DATABASE, type Database } from './../src/database/database.module.js';
import { users } from './../src/database/schema.js';
import { createUniqueEmail } from './test-users.js';

const ENDPOINTS = {
  REGISTER: '/auth/register',
  PROFILE: '/profile',
  AVATAR: '/profile/avatar',
};

const VALID_PASSWORD = 'correct-horse-battery';
const VALID_NAME = 'Grace Hopper';
const OTHER_NAME = 'Alan Turing';
const UPDATED_NAME = 'Anna Maria Lee';
const MAX_NAME_LENGTH = 100;
const TOO_LONG_NAME_LENGTH = MAX_NAME_LENGTH + 1;
const TOO_LONG_NAME = 'a'.repeat(TOO_LONG_NAME_LENGTH);

const AVATAR_FIELD = 'avatar';
// Avatars live in their own folder inside FILES_STORAGE_DIR, so the meeting
// files suite, which runs in parallel, never sees them in its counts.
const AVATAR_DIRECTORY = 'avatars';
const AVATAR_SIZE_LIMIT_TEXT = '5 MB';
const ALLOWED_AVATAR_FORMAT_NAMES = ['JPEG', 'PNG', 'WebP'];
const PNG_AVATAR = {
  name: 'avatar.png',
  mimeType: 'image/png',
  content: randomBytes(16 * 1024),
};
const JPEG_AVATAR = {
  name: 'portrait.JPEG',
  mimeType: 'image/jpeg',
  content: randomBytes(16 * 1024),
};
const GIF_AVATAR = {
  name: 'animation.gif',
  mimeType: 'image/gif',
  content: randomBytes(1024),
};
const OVERSIZED_UPLOAD_TIMEOUT_MS = 30_000;
const NO_SNIFF = 'nosniff';
// The browser's part type is ignored; the served type follows the extension.
const UNTYPED_PART_MIME_TYPE = 'application/octet-stream';

function collectBinaryBody(
  response: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
}

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

  async function getProfileAvatarId(token: string): Promise<string | null> {
    const response = await request(app.getHttpServer())
      .get(ENDPOINTS.PROFILE)
      .auth(token, { type: 'bearer' })
      .expect(HttpStatus.OK);
    return response.body.avatarId as string | null;
  }

  function uploadAvatar(
    token: string,
    avatar: { name: string; mimeType: string; content: Buffer },
  ) {
    return request(app.getHttpServer())
      .put(ENDPOINTS.AVATAR)
      .auth(token, { type: 'bearer' })
      .attach(AVATAR_FIELD, avatar.content, {
        filename: avatar.name,
        contentType: avatar.mimeType,
      });
  }

  function downloadAvatar(token: string) {
    return request(app.getHttpServer())
      .get(ENDPOINTS.AVATAR)
      .auth(token, { type: 'bearer' })
      .buffer(true)
      .parse(collectBinaryBody);
  }

  function removeAvatar(token: string) {
    return request(app.getHttpServer())
      .delete(ENDPOINTS.AVATAR)
      .auth(token, { type: 'bearer' });
  }

  function getAvatarStorageDir(): string {
    const storageDir = app
      .get(ConfigService)
      .getOrThrow<string>('FILES_STORAGE_DIR');
    return join(storageDir, AVATAR_DIRECTORY);
  }

  async function countStoredAvatars(): Promise<number> {
    return (await readdir(getAvatarStorageDir())).length;
  }

  async function findStoredAvatarName(token: string): Promise<string | null> {
    const profile = await request(app.getHttpServer())
      .get(ENDPOINTS.PROFILE)
      .auth(token, { type: 'bearer' })
      .expect(HttpStatus.OK);
    const [user] = await app
      .get<Database>(DATABASE)
      .select({ storageName: users.avatarStorageName })
      .from(users)
      .where(eq(users.email, profile.body.email as string));
    return user.storageName;
  }

  async function isStoredAvatar(storageName: string): Promise<boolean> {
    try {
      await access(join(getAvatarStorageDir(), storageName));
      return true;
    } catch {
      return false;
    }
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

  describe(`PUT ${ENDPOINTS.AVATAR}`, () => {
    it('an uploaded avatar sets avatarId and a replacement changes it', async () => {
      const token = await registerAndGetToken(VALID_NAME);

      const uploaded = await uploadAvatar(token, PNG_AVATAR).expect(
        HttpStatus.OK,
      );

      expect(uploaded.body).toEqual({
        name: VALID_NAME,
        email: expect.any(String),
        avatarId: expect.any(String),
      });
      expect(await getProfileAvatarId(token)).toBe(uploaded.body.avatarId);

      const replaced = await uploadAvatar(token, JPEG_AVATAR).expect(
        HttpStatus.OK,
      );

      expect(replaced.body.avatarId).toEqual(expect.any(String));
      expect(replaced.body.avatarId).not.toBe(uploaded.body.avatarId);
      expect(await getProfileAvatarId(token)).toBe(replaced.body.avatarId);
    });

    it('a replacement leaves one stored file', async () => {
      const token = await registerAndGetToken(VALID_NAME);
      await uploadAvatar(token, PNG_AVATAR).expect(HttpStatus.OK);
      const previousStorageName = await findStoredAvatarName(token);
      const storedAvatarCount = await countStoredAvatars();

      await uploadAvatar(token, JPEG_AVATAR).expect(HttpStatus.OK);

      const currentStorageName = await findStoredAvatarName(token);
      expect(previousStorageName).not.toBeNull();
      expect(currentStorageName).not.toBeNull();
      expect(await countStoredAvatars()).toBe(storedAvatarCount);
      expect(await isStoredAvatar(previousStorageName as string)).toBe(false);
      expect(await isStoredAvatar(currentStorageName as string)).toBe(true);
    });

    it('rejects a GIF with the allowed formats', async () => {
      const token = await registerAndGetToken(VALID_NAME);
      await uploadAvatar(token, PNG_AVATAR).expect(HttpStatus.OK);
      const avatarId = await getProfileAvatarId(token);
      const storedAvatarCount = await countStoredAvatars();

      const response = await uploadAvatar(token, GIF_AVATAR).expect(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );

      expect(response.body).toEqual({
        statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        message: expect.any(String),
        error: 'Unsupported Media Type',
      });
      for (const formatName of ALLOWED_AVATAR_FORMAT_NAMES) {
        expect(response.body.message).toContain(formatName);
      }
      expect(await getProfileAvatarId(token)).toBe(avatarId);
      expect(await countStoredAvatars()).toBe(storedAvatarCount);
    });

    it(
      'rejects an image over 5 MB with the limit',
      async () => {
        const token = await registerAndGetToken(VALID_NAME);
        const maxAvatarSizeBytes = Number(
          app.get(ConfigService).getOrThrow<string>('MAX_AVATAR_SIZE_BYTES'),
        );
        const oversizedBytes = maxAvatarSizeBytes + 1;

        const response = await uploadAvatar(token, {
          ...JPEG_AVATAR,
          content: Buffer.alloc(oversizedBytes),
        }).expect(HttpStatus.PAYLOAD_TOO_LARGE);

        expect(response.body).toEqual({
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          message: expect.stringContaining(AVATAR_SIZE_LIMIT_TEXT),
          error: 'Payload Too Large',
        });
        expect(await getProfileAvatarId(token)).toBeNull();
      },
      OVERSIZED_UPLOAD_TIMEOUT_MS,
    );

    it('rejects a request without a file', async () => {
      const token = await registerAndGetToken(VALID_NAME);

      await request(app.getHttpServer())
        .put(ENDPOINTS.AVATAR)
        .auth(token, { type: 'bearer' })
        .field('name', VALID_NAME)
        .expect(HttpStatus.BAD_REQUEST);

      expect(await getProfileAvatarId(token)).toBeNull();
    });

    it('rejects a request without a token', async () => {
      await request(app.getHttpServer())
        .put(ENDPOINTS.AVATAR)
        .attach(AVATAR_FIELD, PNG_AVATAR.content, {
          filename: PNG_AVATAR.name,
          contentType: PNG_AVATAR.mimeType,
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe(`GET ${ENDPOINTS.AVATAR}`, () => {
    it("serves the exact bytes of the owner's avatar", async () => {
      const token = await registerAndGetToken(VALID_NAME);
      await uploadAvatar(token, {
        ...JPEG_AVATAR,
        mimeType: UNTYPED_PART_MIME_TYPE,
      }).expect(HttpStatus.OK);

      const response = await downloadAvatar(token).expect(HttpStatus.OK);

      expect(Buffer.compare(response.body as Buffer, JPEG_AVATAR.content)).toBe(
        0,
      );
      expect(response.headers['content-type']).toBe(JPEG_AVATAR.mimeType);
      expect(response.headers['content-length']).toBe(
        String(JPEG_AVATAR.content.length),
      );
      expect(response.headers['x-content-type-options']).toBe(NO_SNIFF);
    });

    it('returns 404 when the user has no avatar', async () => {
      const token = await registerAndGetToken(VALID_NAME);

      await downloadAvatar(token).expect(HttpStatus.NOT_FOUND);
    });

    it("another user's token never receives this user's avatar", async () => {
      const ownerToken = await registerAndGetToken(VALID_NAME);
      const otherToken = await registerAndGetToken(OTHER_NAME);
      await uploadAvatar(ownerToken, PNG_AVATAR).expect(HttpStatus.OK);
      const ownerAvatar = await downloadAvatar(ownerToken).expect(
        HttpStatus.OK,
      );
      expect(
        Buffer.compare(ownerAvatar.body as Buffer, PNG_AVATAR.content),
      ).toBe(0);

      await downloadAvatar(otherToken).expect(HttpStatus.NOT_FOUND);
      await uploadAvatar(otherToken, JPEG_AVATAR).expect(HttpStatus.OK);
      const otherAvatar = await downloadAvatar(otherToken).expect(
        HttpStatus.OK,
      );

      expect(
        Buffer.compare(otherAvatar.body as Buffer, JPEG_AVATAR.content),
      ).toBe(0);
      await removeAvatar(otherToken).expect(HttpStatus.NO_CONTENT);
      const ownerAvatarAfter = await downloadAvatar(ownerToken).expect(
        HttpStatus.OK,
      );
      expect(
        Buffer.compare(ownerAvatarAfter.body as Buffer, PNG_AVATAR.content),
      ).toBe(0);
    });

    it('rejects a request without a token', async () => {
      await request(app.getHttpServer())
        .get(ENDPOINTS.AVATAR)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe(`DELETE ${ENDPOINTS.AVATAR}`, () => {
    it('removing the avatar deletes its file and answers 404 afterwards', async () => {
      const token = await registerAndGetToken(VALID_NAME);
      await uploadAvatar(token, PNG_AVATAR).expect(HttpStatus.OK);
      const storageName = await findStoredAvatarName(token);
      const storedAvatarCount = await countStoredAvatars();

      await removeAvatar(token).expect(HttpStatus.NO_CONTENT);

      expect(storageName).not.toBeNull();
      expect(await isStoredAvatar(storageName as string)).toBe(false);
      expect(await countStoredAvatars()).toBe(storedAvatarCount - 1);
      expect(await getProfileAvatarId(token)).toBeNull();
      await downloadAvatar(token).expect(HttpStatus.NOT_FOUND);
    });

    it('rejects a request without a token', async () => {
      await request(app.getHttpServer())
        .delete(ENDPOINTS.AVATAR)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
