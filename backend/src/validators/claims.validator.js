const { ValidationError } = require('../utils/errors');

function id(raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new ValidationError('id must be a positive integer');
  return value;
}

function createBody(body) {
  if (!body || typeof body !== 'object') throw new ValidationError('JSON body required');
  const errors = [];

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 200) errors.push('title is required (1-200 characters)');

  const amountCents = Number(body.amountCents);
  if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > 100000000) {
    errors.push('amountCents must be a whole number of cents between 1 and 100000000');
  }

  const spentOn = typeof body.spentOn === 'string' ? body.spentOn : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || Number.isNaN(Date.parse(spentOn))) {
    errors.push('spentOn must be a date in YYYY-MM-DD format');
  }

  if (errors.length) throw new ValidationError('Invalid body', errors);
  return { title, amountCents, spentOn };
}

module.exports = { id, createBody };
