require('dotenv').config({ quiet: true });

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  dialect: 'mysql',
  logging: process.env.SQL_LOG === '1' ? console.log : false,
};

module.exports = {
  development: { ...base, database: process.env.DB_NAME },
  test: { ...base, database: process.env.DB_TEST_NAME || `${process.env.DB_NAME}_test`, logging: false },
  production: { ...base, database: process.env.DB_NAME, logging: false },
};
