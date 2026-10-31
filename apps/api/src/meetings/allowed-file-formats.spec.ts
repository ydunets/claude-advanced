import {
  ALLOWED_FILE_FORMATS,
  isAllowedFileFormat,
} from './allowed-file-formats.js';

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
      expect(isAllowedFileFormat(`recording.${format}`)).toBe(true);
      expect(isAllowedFileFormat(`RECORDING.${format.toUpperCase()}`)).toBe(
        true,
      );
    }
    expect(isAllowedFileFormat('Recording.Mp4')).toBe(true);

    expect(isAllowedFileFormat('setup.exe')).toBe(false);
    expect(isAllowedFileFormat('report.pdf.exe')).toBe(false);
    expect(isAllowedFileFormat('README')).toBe(false);
    expect(isAllowedFileFormat('.pdf')).toBe(false);
    expect(isAllowedFileFormat('transcript.vtt-draft')).toBe(false);
  });
});
