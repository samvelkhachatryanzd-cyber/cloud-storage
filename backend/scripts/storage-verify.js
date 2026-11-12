// Read-only check that every receipt's file is really in the bucket and matches the database.
//
//   npm run storage:verify
//
// It trusts nothing the backfill produced: it only reads object_key, size_bytes and data from the
// database and the objects from the bucket, and compares them itself. It changes nothing.
const {
  minioClient,
  bucket,
  select,
  hasDataColumn,
  hashStream,
  listObjectKeys,
  parseArgs,
  preflight,
  run,
} = require('./lib/storage-tools');

// Problem kinds decide what the final report suggests:
//   object      the object is missing or wrong: repairable with --ids while the row still has data
//   metadata    the bytes are fine but size_bytes disagrees: needs a manual decision
//   unmigrated  no object_key yet: run the backfill
//   lost        no object_key and no data: the file exists nowhere
const failures = [];
const fail = (row, kind, message) => failures.push({ id: row.id, kind, hasData: row.hasData, message });

async function readObject(key) {
  try {
    return await hashStream(await minioClient.getObject(bucket, key));
  } catch (err) {
    return { error: err.code === 'NoSuchKey' ? 'the object is missing from the bucket' : `could not read the object: ${err.message}` };
  }
}

async function checkRow(row) {
  if (!row.objectKey) {
    if (row.hasData) fail(row, 'unmigrated', 'has no object_key, it has not been copied yet');
    else fail(row, 'lost', 'has no object_key and no data, the file exists nowhere');
    return;
  }

  const object = await readObject(row.objectKey);
  if (object.error) return fail(row, 'object', object.error);

  if (!row.hasData) {
    // Already cleared (or uploaded after the move): the content can no longer be compared, only the size.
    if (object.size !== row.sizeBytes) fail(row, 'object', `the object is ${object.size} bytes but size_bytes is ${row.sizeBytes}`);
    return;
  }

  // The database hashes its own copy, so the blob does not have to travel to this script.
  const [db] = await select('SELECT LENGTH(data) AS len, SHA2(data, 256) AS sha FROM receipts WHERE id = :id', { id: row.id });
  if (object.size !== Number(db.len)) {
    fail(row, 'object', `the object is ${object.size} bytes but the data in the database is ${db.len} bytes`);
  } else if (object.sha256 !== db.sha) {
    fail(row, 'object', 'the object has the same size as the data in the database but different content');
  } else if (object.size !== row.sizeBytes) {
    // The copy is perfect, the metadata is wrong. It matters: downloads send size_bytes as Content-Length.
    fail(row, 'metadata', `the file is ${object.size} bytes but size_bytes is ${row.sizeBytes}`);
  }
}

async function main() {
  parseArgs(process.argv.slice(2));
  await preflight();

  // Once the data column is dropped no row has data, and only the objects can be checked.
  const dataColumn = (await hasDataColumn()) ? '(data IS NOT NULL)' : '0';
  const rows = (
    await select(`SELECT id, object_key AS objectKey, size_bytes AS sizeBytes, ${dataColumn} AS hasData FROM receipts ORDER BY id`)
  ).map((row) => ({ ...row, hasData: Number(row.hasData) === 1 }));
  console.log(`Verifying ${rows.length} receipt(s) against bucket "${bucket}"...`);

  const started = Date.now();
  for (const [index, row] of rows.entries()) {
    const before = failures.length;
    await checkRow(row);
    const status = failures.length === before ? 'ok' : 'FAILED';
    console.log(`[${index + 1}/${rows.length}] receipt ${row.id}: ${status}`);
  }

  // Second, independent look at the bucket: compare the listing with the keys in the database.
  const listed = await listObjectKeys();
  const referenced = new Set(rows.filter((row) => row.objectKey).map((row) => row.objectKey));
  const failedIds = new Set(failures.map((failure) => failure.id));
  for (const row of rows) {
    if (row.objectKey && !listed.has(row.objectKey) && !failedIds.has(row.id)) {
      fail(row, 'object', 'the object is missing from the bucket listing');
    }
  }
  const orphans = [...listed].filter((key) => !referenced.has(key)).sort();

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const failedRowCount = new Set(failures.map((failure) => failure.id)).size;
  console.log(`\nChecked ${rows.length} receipt(s) in ${elapsed} s: ${rows.length - failedRowCount} ok, ${failedRowCount} failed.`);
  console.log(`Objects in the bucket: ${listed.size}, referenced by the database: ${referenced.size}, orphans: ${orphans.length}.`);
  console.log(`Receipts that still keep their file in the database: ${rows.filter((row) => row.hasData).length}.`);

  if (orphans.length > 0) {
    console.log('\nWARNING, objects in the bucket that no receipt points to (harmless, but wasted space):');
    for (const key of orphans) console.log(`  ${key}`);
  }

  if (failures.length > 0) {
    console.log('\nFAILURES:');
    for (const failure of failures) console.log(`  receipt ${failure.id}: ${failure.message}`);

    const repairable = [...new Set(failures.filter((f) => f.kind === 'object' && f.hasData).map((f) => f.id))];
    const noData = [...new Set(failures.filter((f) => f.kind === 'object' && !f.hasData).map((f) => f.id))];
    const metadata = [...new Set(failures.filter((f) => f.kind === 'metadata').map((f) => f.id))];
    const unmigrated = failures.filter((f) => f.kind === 'unmigrated').length;
    const lost = [...new Set(failures.filter((f) => f.kind === 'lost').map((f) => f.id))];

    console.log('');
    if (repairable.length > 0) console.log(`failed ids: ${repairable.join(',')}   (repair with: npm run storage:backfill -- --ids ${repairable.join(',')})`);
    if (unmigrated > 0) console.log(`${unmigrated} receipt(s) are not copied yet: run npm run storage:backfill`);
    if (metadata.length > 0) console.log(`size_bytes needs a manual decision for receipt(s): ${metadata.join(',')}`);
    if (noData.length > 0) console.log(`no copy left in the database for receipt(s): ${noData.join(',')} (restore from a backup)`);
    if (lost.length > 0) console.log(`file exists nowhere for receipt(s): ${lost.join(',')} (restore from a backup)`);
    process.exitCode = 1;
  } else {
    console.log('\nAll receipts verified.');
  }
}

run(main);
