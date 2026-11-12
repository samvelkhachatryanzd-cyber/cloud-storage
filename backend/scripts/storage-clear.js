// Removes receipts.data for receipts whose file is safely in the bucket, then drops the column.
// THIS DELETES DATA AND CHANGES THE SCHEMA.
//
//   npm run storage:clear                 only lists what would be cleared
//   npm run storage:clear -- --confirm    clears it and runs the drop-receipt-data migration
//
// The column is dropped by the migration, so Sequelize's records stay correct. The migration runs only
// when nothing was skipped, and it refuses on its own unless no receipt has data and every one has an
// object_key. This script also refuses while the Receipt model still declares the column, because the
// API would start failing.
//
// Take a database backup first, for example:
//   docker compose exec mysql mysqldump -u<user> -p<password> <database> > backup.sql
//
// Every row is checked again right before it is cleared: the object is read back from the bucket and
// its SHA-256 must equal the database's own SHA-256 of the data. A row that does not match is skipped.
const path = require('path');
const { spawnSync } = require('child_process');
const {
  sequelize,
  minioClient,
  bucket,
  select,
  update,
  hasDataColumn,
  hashStream,
  formatBytes,
  parseArgs,
  preflight,
  run,
} = require('./lib/storage-tools');

// Returns { sha } when the row is safe to clear, otherwise { problem } with the reason it is not.
async function check(row) {
  let object;
  try {
    object = await hashStream(await minioClient.getObject(bucket, row.objectKey));
  } catch (err) {
    return { problem: err.code === 'NoSuchKey' ? 'the object is missing from the bucket' : `could not read the object: ${err.message}` };
  }

  const [db] = await select('SELECT LENGTH(data) AS len, SHA2(data, 256) AS sha FROM receipts WHERE id = :id AND object_key = :key', {
    id: row.id,
    key: row.objectKey,
  });
  if (!db) return { problem: 'the row changed while it was being checked' };
  if (object.size !== Number(db.len)) return { problem: `the object is ${object.size} bytes but the data in the database is ${db.len} bytes` };
  if (object.sha256 !== db.sha) return { problem: 'the object has different content than the data in the database' };
  // Downloads send size_bytes as Content-Length, so a wrong value would break the receipt once data is gone.
  if (row.sizeBytes !== object.size) return { problem: `size_bytes is ${row.sizeBytes} but the file is ${object.size} bytes` };
  return { sha: db.sha };
}

const DROP_MIGRATION = '20261112100200-drop-receipt-data.js';

// Runs the drop migration with sequelize-cli, like "npm run db:migrate" would, but only that one migration.
function dropDataColumn() {
  if (sequelize.models.Receipt.rawAttributes.data) {
    console.log(
      '\nNot dropping the data column: the Receipt model still declares it, so the API would start failing.' +
        '\nRemove "data" from backend/src/models/receipt.js and the database fallback from getReceiptFile,' +
        '\nthen run this command again. Nothing else is left to clear.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('\nEvery receipt is cleared. Running the migration that drops the data column...\n');
  const result = spawnSync('npx', ['sequelize-cli', 'db:migrate', '--name', DROP_MIGRATION], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error('\nThe migration failed, see above. The data column is still there. Fix the cause and run this command again.');
    process.exitCode = 1;
    return;
  }
  console.log('\nThe data column is dropped and the table was rebuilt. Restart the API so it does not keep a stale schema.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { flags: ['confirm'] });
  await preflight();
  if (!(await hasDataColumn())) {
    console.log('The data column has already been dropped. Nothing to do.');
    return;
  }

  const rows = await select(
    `SELECT id, object_key AS objectKey, size_bytes AS sizeBytes
     FROM receipts WHERE object_key IS NOT NULL AND data IS NOT NULL ORDER BY id`
  );
  const totalBytes = rows.reduce((sum, row) => sum + row.sizeBytes, 0);
  console.log(`${rows.length} receipt(s) have both an object and data in the database (${formatBytes(totalBytes)} to clear).`);

  if (rows.length === 0) console.log('Nothing to clear.');

  if (!args.confirm) {
    if (rows.length > 0) console.log(`Would clear the data of receipt(s): ${rows.map((row) => row.id).join(', ')}`);
    console.log('\nThis is a dry run. With --confirm, once every receipt is clear, the data column is also dropped.');
    console.log('Take a database backup first, then run again with --confirm.');
    return;
  }

  const skipped = [];
  let clearedBytes = 0;
  let cleared = 0;
  const started = Date.now();

  for (const [index, row] of rows.entries()) {
    const label = `[${index + 1}/${rows.length}] receipt ${row.id}`;
    try {
      const { sha, problem } = await check(row);
      if (problem) {
        skipped.push({ id: row.id, message: problem });
        console.error(`${label}: SKIPPED, ${problem}`);
        continue;
      }
      const changed = await update('UPDATE receipts SET data = NULL WHERE id = :id AND object_key = :key AND SHA2(data, 256) = :sha', {
        id: row.id,
        key: row.objectKey,
        sha,
      });
      if (changed !== 1) throw new Error('the row changed while it was being cleared');
      cleared += 1;
      clearedBytes += row.sizeBytes;
      console.log(`${label}: cleared ${formatBytes(row.sizeBytes)}`);
    } catch (err) {
      skipped.push({ id: row.id, message: err.message });
      console.error(`${label}: SKIPPED, ${err.message}`);
    }
  }

  const [left] = await select('SELECT COUNT(*) AS withData FROM receipts WHERE data IS NOT NULL');
  console.log(`\nCleared ${cleared} of ${rows.length} receipt(s), ${formatBytes(clearedBytes)}, in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  console.log(`Receipts that still keep their file in the database: ${Number(left.withData)}.`);

  if (skipped.length > 0) {
    console.log(`\nSKIPPED ${skipped.length}:`);
    for (const item of skipped) console.log(`  receipt ${item.id}: ${item.message}`);
    console.log('Their data was left in place. Run "npm run storage:verify", repair them, and run this command again.');
    process.exitCode = 1;
    return;
  }

  dropDataColumn();
  if (!process.exitCode) console.log('\nDone. Run "npm run storage:verify" once more.');
}

run(main);
