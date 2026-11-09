const multer = require('multer');
const service = require('../services/receipts.service');
const validate = require('../validators/claims.validator');

const upload = multer({ storage: multer.memoryStorage(), defParamCharset: 'utf8' });

function contentDisposition(fileName) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function create(req, res) {
  res.status(201).json(await service.addReceipt(req.user, validate.id(req.params.id), req.file));
}

async function download(req, res) {
  const receipt = await service.getReceiptFile(req.user, validate.id(req.params.id));
  res.setHeader('Content-Type', receipt.contentType);
  res.setHeader('Content-Disposition', contentDisposition(receipt.fileName));
  res.send(receipt.data);
}

module.exports = { upload: upload.single('file'), create, download };
