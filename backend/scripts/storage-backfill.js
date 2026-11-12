// Copies receipts that still live in the database (receipts.data) to the object storage bucket.
//
//   npm run storage:backfill                  copy every receipt that has no object_key yet
//   npm run storage:backfill -- --dry-run     only report what would be copied
//   npm run storage:backfill -- --ids 12,13   repair: copy exactly these receipts again, replacing their object
//
// It never touches receipts.data. A row gets its object_key only after the uploaded object has been
// checked, so a crash at any moment leaves every row either untouched or fully copied.
const crypto = require('crypto');
const {
  storage,
  minioClient,
  bucket,
  select,
  update,
  hasDataColumn,
  formatBytes,
  parseArgs,
  parseIds,
  preflight,
  run,
} = require('./lib/storage-tools');

async function counts() {
  const [row] = await select(`
    SELECT COUNT(*) AS total,
           SUM(object_key IS NOT NULL) AS migrated,
           SUM(object_key IS NULL AND data IS NOT NULL) AS pending,
           COALESCE(SUM(CASE WHEN object_key IS NULL AND data IS NOT NULL THEN size_bytes ELSE 0 END), 0) AS pendingBytes,
           SUM(object_key IS NULL AND data IS NULL) AS unrecoverable
    FROM receipts`);
  return {
    total: Number(row.total),
    migrated: Number(row.migrated),
    pending: Number(row.pending),
    pendingBytes: Number(row.pendingBytes),
    unrecoverable: Number(row.unrecoverable),
  };
}

// Copies one receipt. Returns { bytes, warning }. Throws if the receipt could not be copied safely.
async function processRow(id) {
  const [row] = await select(
    'SELECT id, content_type AS contentType, size_bytes AS sizeBytes, object_key AS objectKey, data FROM receipts WHERE id = :id',
    { id }
  );
  if (!row) throw new Error('the receipt no longer exists');
  if (!row.data) throw new Error('it has no data in the database to copy');

  const bytes = row.data;
  const warning =
    bytes.length !== row.sizeBytes
      ? `size_bytes is ${row.sizeBytes} but the stored data is ${bytes.length} bytes (storage:verify will flag it)`
      : null;

  const key = await storage.saveObject(bytes, row.contentType);

  let switched = false;
  try {
    // Do not mark the row as copied unless the object in the bucket is what we sent.
    const stat = await minioClient.statObject(bucket, key);
    if (stat.size !== bytes.length) throw new Error(`uploaded object is ${stat.size} bytes, expected ${bytes.length}`);
    // A plain ETag is the MD5 of the content. Multipart uploads have a different ETag, which cannot be compared.
    const etag = String(stat.etag || '').replace(/"/g, '');
    if (/^[0-9a-f]{32}$/.test(etag) && etag !== crypto.createHash('md5').update(bytes).digest('hex')) {
      throw new Error('uploaded object has a different checksum than the data sent');
    }

    // <=> is null-safe equality: it matches NULL for a first copy and the old key when repairing.
    const changed = await update('UPDATE receipts SET object_key = :key WHERE id = :id AND object_key <=> :oldKey', {
      key,
      id,
      oldKey: row.objectKey,
    });
    if (changed !== 1) throw new Error('the row was changed by someone else while it was being copied');
    switched = true;
  } catch (err) {
    if (!switched) await storage.removeObject(key);
    throw err;
  }

  if (row.objectKey) await storage.removeObject(row.objectKey);
  return { bytes: bytes.length, warning };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { flags: ['dry-run'], values: ['ids'] });
  const requested = args.ids ? parseIds(args.ids) : null;

  await preflight();
  if (!(await hasDataColumn())) {
    console.log('The data column no longer exists, so no receipt has a file left in the database to copy.');
    return;
  }
  const before = await counts();
  console.log(`Receipts: ${before.total} total, ${before.migrated} already have an object, ${before.pending} to copy (${formatBytes(before.pendingBytes)}).`);
  if (before.unrecoverable > 0) {
    console.warn(`WARNING: ${before.unrecoverable} receipt(s) have neither an object_key nor data. Their file cannot be recovered by this script.`);
  }

  let ids;
  if (requested) {
    const found = await select('SELECT id, (data IS NOT NULL) AS hasData FROM receipts WHERE id IN (:ids) ORDER BY id', { ids: requested });
    const byId = new Map(found.map((row) => [row.id, Number(row.hasData) === 1]));
    for (const id of requested) {
      if (!byId.has(id)) console.warn(`Receipt ${id} does not exist, skipping.`);
      else if (!byId.get(id)) console.warn(`Receipt ${id} has no data in the database, nothing to copy from. Restore it from a backup. Skipping.`);
    }
    ids = requested.filter((id) => byId.get(id));
    console.log(`Repair mode: ${ids.length} of ${requested.length} requested receipt(s) can be copied again.`);
  } else {
    ids = (await select('SELECT id FROM receipts WHERE object_key IS NULL AND data IS NOT NULL ORDER BY id')).map((row) => row.id);
  }

  if (args['dry-run']) {
    console.log(`Dry run: would copy ${ids.length} receipt(s): ${ids.join(', ') || '(none)'}`);
    return;
  }
  if (ids.length === 0) console.log('Nothing to copy.');

  const failures = [];
  const warnings = [];
  let copiedBytes = 0;
  const started = Date.now();

  for (const [index, id] of ids.entries()) {
    const rowStarted = Date.now();
    const label = `[${index + 1}/${ids.length}] receipt ${id}`;
    try {
      const { bytes, warning } = await processRow(id);
      copiedBytes += bytes;
      const seconds = Math.max((Date.now() - rowStarted) / 1000, 0.001);
      console.log(`${label}: ok, ${formatBytes(bytes)} in ${seconds.toFixed(2)} s (${(bytes / 1024 / 1024 / seconds).toFixed(1)} MB/s)`);
      if (warning) {
        warnings.push(`receipt ${id}: ${warning}`);
        console.warn(`${label}: WARNING ${warning}`);
      }
    } catch (err) {
      failures.push({ id, message: err.message });
      console.error(`${label}: FAILED, ${err.message}`);
    }
  }

  const elapsed = (Date.now() - started) / 1000;
  const after = await counts();
  console.log('\nSummary (read back from the database):');
  console.log(`  copied in this run:   ${ids.length - failures.length} of ${ids.length}, ${formatBytes(copiedBytes)} in ${elapsed.toFixed(1)} s`);
  console.log(`  receipts with object: ${after.migrated} of ${after.total}`);
  console.log(`  still to copy:        ${after.pending}`);
  if (warnings.length > 0) console.log(`  warnings:             ${warnings.length}`);
  if (failures.length > 0) {
    console.log(`  FAILED:               ${failures.length}`);
    for (const failure of failures) console.log(`    receipt ${failure.id}: ${failure.message}`);
  }

  if (failures.length > 0 || (!requested && after.pending > 0)) {
    console.log('\nNot everything was copied. Fix the cause and run the command again, it only picks up what is left.');
    process.exitCode = 1;
  } else {
    console.log('\nDone. Run "npm run storage:verify" to check the copies before clearing anything.');
  }
}

run(main);
