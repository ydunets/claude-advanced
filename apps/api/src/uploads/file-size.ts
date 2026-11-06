const BYTES_PER_MEGABYTE = 1024 * 1024;
const MEGABYTE_FRACTION_DIGITS = 1;

export function formatSizeInMegabytes(sizeBytes: number): string {
  const megabytes = sizeBytes / BYTES_PER_MEGABYTE;
  const roundedMegabytes = Number(megabytes.toFixed(MEGABYTE_FRACTION_DIGITS));
  return `${roundedMegabytes} MB`;
}
