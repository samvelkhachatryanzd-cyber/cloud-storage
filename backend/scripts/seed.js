require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const { sequelize } = require('../src/models');
const { receiptPhoto, receiptPdf } = require('./receipt-files');

const CLAIMS = Number(process.env.SEED_CLAIMS) || 24;
const PASSWORD = 'password123';
const DAY = 24 * 60 * 60 * 1000;
const TODAY = Date.UTC(2026, 10, 9);

const USERS = [
  { id: 1, name: 'Anna Adams', email: 'anna@example.com', role: 'employee' },
  { id: 2, name: 'Ben Brown', email: 'ben@example.com', role: 'employee' },
  { id: 3, name: 'Clara Clark', email: 'clara@example.com', role: 'finance' },
];
const EXPENSES = [
  ['Taxi to client meeting', 1200, 4500],
  ['Team lunch', 4500, 18000],
  ['Train ticket to Vilnius', 2500, 6000],
  ['Hotel, two nights', 18000, 42000],
  ['Conference ticket', 25000, 90000],
  ['Office supplies', 800, 6000],
  ['Client dinner', 6000, 24000],
  ['Parking', 300, 2500],
  ['Mobile phone bill', 1500, 4500],
  ['Software licence', 990, 29900],
  ['Flight to Berlin', 9000, 32000],
  ['Coffee with a candidate', 600, 1800],
];
const PHOTO_WIDTHS = [1000, 1200, 1400];
const RECEIPTS_PER_CLAIM = [0, 1, 1, 1, 1, 2, 2, 3];

let state = 11;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

async function main() {
  const [[{ n }]] = await sequelize.query('SELECT COUNT(*) AS n FROM users');
  if (Number(n) > 0) {
    console.error(`users already has ${n} rows. Run "npm run db:reset" to start over.`);
    process.exit(1);
  }

  const queryInterface = sequelize.getQueryInterface();
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);
  await queryInterface.bulkInsert(
    'users',
    USERS.map((user) => ({ ...user, password_hash: passwordHash, created_at: new Date(TODAY - 400 * DAY) }))
  );

  const claims = [];
  for (let i = 0; i < CLAIMS; i++) {
    const [title, min, max] = pick(EXPENSES);
    const spentOn = TODAY - between(1, 120) * DAY;
    claims.push({
      user_id: 1 + (i % 2),
      title,
      amount_cents: between(min, max),
      spent_on: isoDate(spentOn),
      created_at: new Date(spentOn + between(0, 3) * DAY + between(8, 18) * 3600 * 1000),
    });
  }
  claims.sort((a, b) => a.created_at - b.created_at);
  claims.forEach((claim, i) => {
    claim.id = i + 1;
  });
  await queryInterface.bulkInsert('claims', claims);

  let receipts = 0;
  let bytes = 0;
  for (const claim of claims) {
    const count = RECEIPTS_PER_CLAIM[between(0, RECEIPTS_PER_CLAIM.length - 1)];
    for (let i = 0; i < count; i++) {
      const photo = random() < 0.7;
      const width = pick(PHOTO_WIDTHS);
      const data = photo
        ? receiptPhoto(random, width, Math.round((width * 4) / 3))
        : receiptPdf(random, claim.spent_on, claim.amount_cents);
      await queryInterface.bulkInsert('receipts', [
        {
          claim_id: claim.id,
          uploaded_by: claim.user_id,
          file_name: photo ? `IMG_${between(1000, 9999)}.png` : `receipt-${claim.spent_on}-${between(100, 999)}.pdf`,
          content_type: photo ? 'image/png' : 'application/pdf',
          size_bytes: data.length,
          data,
          created_at: new Date(claim.created_at.getTime() + i * 60000 + between(1, 59) * 1000),
        },
      ]);
      receipts += 1;
      bytes += data.length;
    }
  }

  console.log(`inserted ${USERS.length} users, ${claims.length} claims, ${receipts} receipts (${(bytes / 1024 / 1024).toFixed(0)} MB)`);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
