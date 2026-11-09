const { ValidationError } = require('../utils/errors');

function loginBody(body) {
  if (!body || typeof body !== 'object') throw new ValidationError('JSON body required');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) throw new ValidationError('email and password are required');
  return { email, password };
}

module.exports = { loginBody };
