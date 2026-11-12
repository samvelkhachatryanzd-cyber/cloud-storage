const { ValidationError, UnsupportedMediaTypeError } = require('../utils/errors');

const MAX_FILE_SIZE = 64 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 255;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs'];
const HEIF_BRANDS = ['mif1', 'msf1'];

const ascii = (bytes, start, end) => bytes.subarray(start, end).toString('latin1');
const hasBrand = (bytes, brands) => ascii(bytes, 4, 8) === 'ftyp' && brands.includes(ascii(bytes, 8, 12));

const SIGNATURES = [
  { contentType: 'image/png', matches: (bytes) => bytes.subarray(0, 8).equals(PNG_SIGNATURE) },
  { contentType: 'image/jpeg', matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { contentType: 'image/webp', matches: (bytes) => ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP' },
  { contentType: 'image/heic', matches: (bytes) => hasBrand(bytes, HEIC_BRANDS) },
  { contentType: 'image/heif', matches: (bytes) => hasBrand(bytes, HEIF_BRANDS) },
  { contentType: 'application/pdf', matches: (bytes) => ascii(bytes, 0, 5) === '%PDF-' },
];

function detectContentType(bytes) {
  const found = SIGNATURES.find((signature) => signature.matches(bytes));
  return found ? found.contentType : null;
}

function file(upload) {
  const fileName = typeof upload.originalname === 'string' ? upload.originalname.trim() : '';
  if (!fileName || fileName.length > MAX_FILE_NAME_LENGTH) {
    throw new ValidationError(`The file name must be 1-${MAX_FILE_NAME_LENGTH} characters`);
  }
  if (upload.size === 0) throw new ValidationError('The file is empty');

  const contentType = detectContentType(upload.buffer);
  if (!contentType) throw new UnsupportedMediaTypeError('Only PNG, JPEG, WebP, HEIC and PDF files are allowed');

  return { fileName, contentType, sizeBytes: upload.size };
}

module.exports = { MAX_FILE_SIZE, file };
