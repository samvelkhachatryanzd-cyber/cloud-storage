const { Claim, Receipt, User, sequelize } = require('../models');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

const RECEIPT_COUNT = [sequelize.literal('(SELECT COUNT(*) FROM receipts WHERE receipts.claim_id = Claim.id)'), 'receiptCount'];

function canView(user, claim) {
  return user.role === 'finance' || claim.userId === user.id;
}

async function listClaims(user) {
  const where = user.role === 'finance' ? {} : { userId: user.id };
  const claims = await Claim.findAll({
    where,
    attributes: { include: [RECEIPT_COUNT] },
    include: [{ model: User, as: 'employee', attributes: ['id', 'name'] }],
    order: [['spentOn', 'DESC'], ['id', 'DESC']],
  });
  return claims.map((claim) => ({ ...claim.toJSON(), receiptCount: Number(claim.get('receiptCount')) }));
}

async function getClaim(user, id) {
  const claim = await Claim.findByPk(id, {
    include: [
      { model: User, as: 'employee', attributes: ['id', 'name'] },
      { model: Receipt, as: 'receipts', include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }] },
    ],
    order: [[{ model: Receipt, as: 'receipts' }, 'createdAt', 'ASC'], [{ model: Receipt, as: 'receipts' }, 'id', 'ASC']],
  });
  if (!claim) throw new NotFoundError('Claim not found');
  if (!canView(user, claim)) throw new ForbiddenError('You cannot view this claim');
  return claim;
}

async function createClaim(user, data) {
  const claim = await Claim.create({ userId: user.id, ...data });
  return getClaim(user, claim.id);
}

module.exports = { listClaims, getClaim, createClaim, canView };
