import { isAllowedFileFormat } from '../uploads/file-format.js';
import { ALLOWED_FILE_FORMATS } from './allowed-file-formats.js';

// The list from the PRD, kept here so the test checks it independently.
const EXPECTED_FORMATS = [
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

describe('allowed file formats', () => {
  it('accepts every allowed extension in any case and rejects others', () => {
    expect([...ALLOWED_FILE_FORMATS]).toEqual(EXPECTED_FORMATS);
    for (const format of EXPECTED_FORMATS) {
      expect(
        isAllowedFileFormat(`recording.${format}`, ALLOWED_FILE_FORMATS),
      ).toBe(true);
      expect(
        isAllowedFileFormat(
          `RECORDING.${format.toUpperCase()}`,
          ALLOWED_FILE_FORMATS,
        ),
      ).toBe(true);
    }
    expect(isAllowedFileFormat('Recording.Mp4', ALLOWED_FILE_FORMATS)).toBe(
      true,
    );

    expect(isAllowedFileFormat('setup.exe', ALLOWED_FILE_FORMATS)).toBe(false);
    expect(isAllowedFileFormat('report.pdf.exe', ALLOWED_FILE_FORMATS)).toBe(
      false,
    );
    expect(isAllowedFileFormat('README', ALLOWED_FILE_FORMATS)).toBe(false);
    expect(isAllowedFileFormat('.pdf', ALLOWED_FILE_FORMATS)).toBe(false);
    expect(
      isAllowedFileFormat('transcript.vtt-draft', ALLOWED_FILE_FORMATS),
    ).toBe(false);
  });
});
