const { Claim, Receipt, User } = require('../models');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');
const { canView } = require('./claims.service');

async function addReceipt(user, claimId, file) {
  if (!file) throw new ValidationError('A file is required in the "file" field');

  const claim = await Claim.findByPk(claimId);
  if (!claim) throw new NotFoundError('Claim not found');
  if (claim.userId !== user.id) throw new ForbiddenError('Only the owner of a claim can add receipts');

  const receipt = await Receipt.create({
    claimId: claim.id,
    uploadedBy: user.id,
    fileName: file.originalname,
    contentType: file.mimetype,
    sizeBytes: file.size,
    data: file.buffer,
  });

  return Receipt.findByPk(receipt.id, { include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }] });
}

async function getReceiptFile(user, id) {
  const receipt = await Receipt.unscoped().findByPk(id, {
    include: [{ model: Claim, as: 'claim', attributes: ['id', 'userId'] }],
  });
  if (!receipt) throw new NotFoundError('Receipt not found');
  if (!canView(user, receipt.claim)) throw new ForbiddenError('You cannot open this receipt');
  return receipt;
}

module.exports = { addReceipt, getReceiptFile };
