require('dotenv').config({ quiet: true });
const { Client } = require('minio');

const endpoint = new URL(process.env.S3_ENDPOINT || 'http://127.0.0.1:9000');
const useSSL = endpoint.protocol === 'https:';

const bucket = process.env.S3_BUCKET || 'receipts';

const minioClient = new Client({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port) || (useSSL ? 443 : 80),
  useSSL,
  region: process.env.S3_REGION || 'us-east-1',
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
});

module.exports = { minioClient, bucket };
