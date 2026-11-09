const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { UnauthorizedError } = require('../utils/errors');

const TOKEN_TTL = '12h';

async function login({ email, password }) {
  const user = await User.unscoped().findOne({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new UnauthorizedError('Wrong email or password');
  }

  const token = jwt.sign({ sub: String(user.id), role: user.role }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

module.exports = { login };
