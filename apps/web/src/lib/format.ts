const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;
const BYTES_PER_UNIT_STEP = 1024;
const FILE_SIZE_FORMAT = new Intl.NumberFormat('en', {
  maximumFractionDigits: 1,
});

export function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function formatDateTime(isoDate: string): string {
  return DATE_TIME_FORMAT.format(new Date(isoDate));
}

export function formatFileSize(sizeBytes: number): string {
  let size = sizeBytes;
  let unitIndex = 0;
  while (
    size >= BYTES_PER_UNIT_STEP &&
    unitIndex < FILE_SIZE_UNITS.length - 1
  ) {
    size /= BYTES_PER_UNIT_STEP;
    unitIndex += 1;
  }
  return `${FILE_SIZE_FORMAT.format(size)} ${FILE_SIZE_UNITS[unitIndex]}`;
}
