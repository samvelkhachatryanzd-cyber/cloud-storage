const { pipeline } = require('stream/promises');
const multer = require('multer');
const service = require('../services/receipts.service');
const validate = require('../validators/claims.validator');
const { MAX_FILE_SIZE } = require('../validators/receipts.validator');

const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

function contentDisposition(fileName) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function create(req, res) {
  res.status(201).json(await service.addReceipt(req.user, validate.id(req.params.id), req.file));
}

async function download(req, res) {
  const file = await service.getReceiptFile(req.user, validate.id(req.params.id));
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', contentDisposition(file.fileName));
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (Buffer.isBuffer(file.body)) return res.send(file.body);

  // The declared length makes a truncated stream fail in the client instead of looking like a complete file.
  res.setHeader('Content-Length', file.sizeBytes);
  try {
    await pipeline(file.body, res);
  } catch (err) {
    // pipeline has already destroyed the response, and the headers are out, so there is no JSON error to send.
    console.error(`Streaming receipt ${req.params.id} failed:`, err.message);
  }
}

module.exports = { upload: upload.single('file'), create, download };
