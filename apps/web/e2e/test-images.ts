import { randomBytes } from 'node:crypto';
import { constants, crc32, deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BIT_DEPTH = 8;
const RGB_COLOR_TYPE = 2;
const RGB_BYTES_PER_PIXEL = 3;
const NO_ROW_FILTER = 0;
const CHUNK_LENGTH_BYTES = 4;
const CHUNK_CRC_BYTES = 4;

function buildPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(CHUNK_LENGTH_BYTES);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(CHUNK_CRC_BYTES);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

// A valid PNG of random pixels, stored without compression, so its size is
// close to width * height * 3 bytes and a browser can still decode it.
export function createNoisePng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(BIT_DEPTH, 8);
  header.writeUInt8(RGB_COLOR_TYPE, 9);
  const rowBytes = width * RGB_BYTES_PER_PIXEL;
  const rows = Array.from({ length: height }, () =>
    Buffer.concat([Buffer.from([NO_ROW_FILTER]), randomBytes(rowBytes)]),
  );
  const pixels = deflateSync(Buffer.concat(rows), {
    level: constants.Z_NO_COMPRESSION,
  });
  return Buffer.concat([
    PNG_SIGNATURE,
    buildPngChunk('IHDR', header),
    buildPngChunk('IDAT', pixels),
    buildPngChunk('IEND', Buffer.alloc(0)),
  ]);
}
