import { open, type FileHandle } from 'node:fs/promises';

const FILE_MISSING_ERROR_CODE = 'ENOENT';

// Opening before the response starts lets the caller turn a lost disk file
// into a 404; a stream that fails later would answer 400 through
// StreamableFile.
export async function findStoredFile(
  filePath: string,
): Promise<FileHandle | undefined> {
  try {
    return await open(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === FILE_MISSING_ERROR_CODE) {
      return undefined;
    }
    throw error;
  }
}
