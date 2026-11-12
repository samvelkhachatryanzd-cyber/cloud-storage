const { Claim, Receipt, User } = require('../models');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');
const { canView } = require('./claims.service');
const storage = require('./storage.service');
const validate = require('../validators/receipts.validator');

async function addReceipt(user, claimId, upload) {
  if (!upload) throw new ValidationError('A file is required in the "file" field');

  const claim = await Claim.findByPk(claimId);
  if (!claim) throw new NotFoundError('Claim not found');
  if (claim.userId !== user.id) throw new ForbiddenError('Only the owner of a claim can add receipts');

  const { fileName, contentType, sizeBytes } = validate.file(upload);

  const objectKey = await storage.saveObject(upload.buffer, contentType);

  let receipt;
  try {
    receipt = await Receipt.create({ claimId: claim.id, uploadedBy: user.id, fileName, contentType, sizeBytes, objectKey });
  } catch (err) {
    await storage.removeObject(objectKey);
    throw err;
  }

  return Receipt.findByPk(receipt.id, { include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }] });
}

async function getReceiptFile(user, id) {
  const receipt = await Receipt.unscoped().findByPk(id, {
    include: [{ model: Claim, as: 'claim', attributes: ['id', 'userId'] }],
  });
  if (!receipt) throw new NotFoundError('Receipt not found');
  if (!canView(user, receipt.claim)) throw new ForbiddenError('You cannot open this receipt');

  const body = receipt.objectKey ? await storage.getObjectStream(receipt.objectKey) : receipt.data;
  if (!body) throw new NotFoundError('The receipt file is missing');

  return { fileName: receipt.fileName, contentType: receipt.contentType, sizeBytes: receipt.sizeBytes, body };
}

module.exports = { addReceipt, getReceiptFile };
