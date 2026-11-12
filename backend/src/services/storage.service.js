const { randomUUID } = require('crypto');
const { minioClient, bucket } = require('../utils/minio');
const { NotFoundError, ServiceUnavailableError } = require('../utils/errors');

async function checkBucket() {
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) throw new Error(`bucket "${bucket}" does not exist`);
}

async function saveObject(buffer, contentType) {
  const key = `receipts/${randomUUID()}`;
  try {
    await minioClient.putObject(bucket, key, buffer, buffer.length, { 'Content-Type': contentType });
  } catch (err) {
    console.error(`Could not store object ${key}:`, err);
    throw new ServiceUnavailableError('Could not store the file, please try again');
  }
  return key;
}

async function removeObject(key) {
  try {
    await minioClient.removeObject(bucket, key);
  } catch (err) {
    console.error(`Could not remove object ${key}, it is now orphaned:`, err);
  }
}

async function getObjectStream(key) {
  try {
    return await minioClient.getObject(bucket, key);
  } catch (err) {
    console.error(`Could not read object ${key}:`, err);
    if (err.code === 'NoSuchKey') throw new NotFoundError('The receipt file is missing from storage');
    throw new ServiceUnavailableError('Could not read the file, please try again');
  }
}

module.exports = { checkBucket, saveObject, removeObject, getObjectStream };
