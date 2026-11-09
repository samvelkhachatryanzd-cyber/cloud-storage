const service = require('../services/auth.service');
const validate = require('../validators/auth.validator');

async function login(req, res) {
  res.json(await service.login(validate.loginBody(req.body)));
}

module.exports = { login };
