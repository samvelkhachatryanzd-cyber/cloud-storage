require('dotenv').config({ quiet: true });
const express = require('express');
const { sequelize } = require('./models');
const router = require('./router');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const storage = require('./services/storage.service');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env first.');
  process.exit(1);
}

if (!process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
  console.error('S3_ACCESS_KEY and S3_SECRET_KEY are not set. Copy .env.example to .env first.');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  await sequelize.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api', router);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;

async function start() {
  try {
    await sequelize.authenticate();
  } catch (err) {
    console.error('Could not connect to the database:', err.message);
    process.exit(1);
  }

  try {
    await storage.checkBucket();
  } catch (err) {
    console.error('Could not connect to the cloud storage:', err.message);
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      console.error(`Could not listen on port ${port}:`, err.message);
      process.exit(1);
    }
    console.log(`expenses-api listening on http://localhost:${port}`);
  });
}

start();

module.exports = app;
