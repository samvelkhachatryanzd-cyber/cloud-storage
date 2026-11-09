const service = require('../services/claims.service');
const validate = require('../validators/claims.validator');

async function list(req, res) {
  res.json(await service.listClaims(req.user));
}

async function create(req, res) {
  res.status(201).json(await service.createClaim(req.user, validate.createBody(req.body)));
}

async function get(req, res) {
  res.json(await service.getClaim(req.user, validate.id(req.params.id)));
}

module.exports = { list, create, get };
