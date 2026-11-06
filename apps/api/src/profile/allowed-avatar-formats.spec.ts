import {
  ALLOWED_AVATAR_FORMATS,
  buildDisallowedAvatarFormatMessage,
  getAvatarMimeType,
} from './allowed-avatar-formats.js';

// The PRD's formats, kept here so the test checks them independently.
const EXPECTED_MIME_TYPES_BY_FILE_NAME = {
  'photo.jpg': 'image/jpeg',
  'PHOTO.JPEG': 'image/jpeg',
  'avatar.Png': 'image/png',
  'avatar.webp': 'image/webp',
};
const FIVE_MEGABYTES = 5 * 1024 * 1024;

describe('allowed avatar formats', () => {
  it('derives the MIME type from the extension in any case', () => {
    expect([...ALLOWED_AVATAR_FORMATS]).toEqual(['jpg', 'jpeg', 'png', 'webp']);
    for (const [fileName, mimeType] of Object.entries(
      EXPECTED_MIME_TYPES_BY_FILE_NAME,
    )) {
      expect(getAvatarMimeType(fileName)).toBe(mimeType);
    }
  });

  it('throws for a format the upload filter would have refused', () => {
    expect(() => getAvatarMimeType('animation.gif')).toThrow();
    expect(() => getAvatarMimeType('avatar.png.exe')).toThrow();
  });

  it('names the formats and the size limit in the refusal message', () => {
    const message = buildDisallowedAvatarFormatMessage(FIVE_MEGABYTES);

    for (const formatName of ['JPEG', 'PNG', 'WebP', '5 MB']) {
      expect(message).toContain(formatName);
    }
  });
});
