// Shared plumbing for the storage:* scripts (backfill, verify, clear).
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../src/models');
const storage = require('../../src/services/storage.service');
const { minioClient, bucket } = require('../../src/utils/minio');

// SELECT: returns the rows as plain objects.
function select(sql, replacements = {}) {
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

// UPDATE: returns how many rows changed. Both scripts that use it always change the value they set.
async function update(sql, replacements = {}) {
  const [, affected] = await sequelize.query(sql, { replacements, type: QueryTypes.UPDATE });
  return affected;
}

// False once receipts.data has been dropped, after which the scripts have no file contents left to look at.
async function hasDataColumn() {
  const columns = await sequelize.getQueryInterface().describeTable('receipts');
  return 'data' in columns;
}

// Streams a readable and returns its size and SHA-256 without holding it in memory.
async function hashStream(stream) {
  const hash = crypto.createHash('sha256');
  let size = 0;
  for await (const chunk of stream) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { size, sha256: hash.digest('hex') };
}

async function listObjectKeys() {
  const keys = new Set();
  for await (const object of minioClient.listObjectsV2(bucket, '', true)) keys.add(object.name);
  return keys;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Understands --flag, --name=value and --name value. Anything else is an error, so a typo such as
// "--confim" can never be silently ignored by a destructive script.
function parseArgs(argv, { flags = [], values = [] } = {}) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const [name, inline] = argv[i].startsWith('--') ? argv[i].slice(2).split(/=(.*)/s) : [null];
    if (name && flags.includes(name) && inline === undefined) {
      parsed[name] = true;
    } else if (name && values.includes(name)) {
      const value = inline !== undefined ? inline : argv[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value`);
      parsed[name] = value;
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return parsed;
}

function parseIds(raw) {
  const ids = raw.split(',').map((part) => Number(part.trim()));
  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new Error('--ids must be a comma-separated list of positive integers, for example --ids 12,13');
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

// Fails fast, before anything is changed, if the database or the bucket cannot be used.
async function preflight() {
  if (!process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
    throw new Error('S3_ACCESS_KEY and S3_SECRET_KEY are not set. Copy .env.example to .env first.');
  }
  try {
    await sequelize.authenticate();
  } catch (err) {
    throw new Error(`Could not connect to the database: ${err.message}`);
  }
  try {
    await storage.checkBucket();
  } catch (err) {
    throw new Error(`Could not use object storage: ${err.message}`);
  }
}

// Runs a script's main function, closes the connection pool and sets the exit code.
function run(main) {
  main()
    .catch((err) => {
      console.error(`\nERROR: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = {
  sequelize,
  storage,
  minioClient,
  bucket,
  select,
  update,
  hasDataColumn,
  hashStream,
  listObjectKeys,
  formatBytes,
  parseArgs,
  parseIds,
  preflight,
  run,
};
