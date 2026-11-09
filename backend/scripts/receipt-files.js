const zlib = require('zlib');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const INK = [48, 46, 52];
const DARK_INK = [30, 30, 36];
const SHOPS = ['Cafe Central', 'City Taxi', 'Hotel Astoria', 'Paper & Pen', 'Baltic Rail', 'Bistro 21', 'Parking Center', 'Tech Corner', 'Northwind Air', 'Mobile Plus'];
const ADDRESSES = ['Gedimino pr. 12, Vilnius', 'Brivibas iela 40, Riga', 'Friedrichstr. 7, Berlin', 'Narva mnt 5, Tallinn', 'Marszalkowska 10, Warsaw'];
const ITEMS = ['Espresso', 'Sandwich', 'Mineral water', 'Taxi fare', 'Parking 2h', 'Day ticket', 'Printer paper A4', 'Pens, 10 pcs', 'Notebook', 'Lunch menu', 'Soup of the day', 'Service fee', 'Room, 1 night', 'Breakfast', 'Conference pass', 'USB-C cable', 'Monthly plan'];

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 1 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function fillRect(img, width, x0, y0, w, h, [r, g, b]) {
  for (let y = y0; y < y0 + h; y++) {
    let i = (y * width + x0) * 3;
    for (let x = 0; x < w; x++, i += 3) {
      img[i] = r;
      img[i + 1] = g;
      img[i + 2] = b;
    }
  }
}

function receiptPhoto(random, width, height) {
  const between = (min, max) => min + Math.floor(random() * (max - min + 1));
  const img = Buffer.alloc(width * height * 3);
  fillRect(img, width, 0, 0, width, height, [88, 74, 62]);

  const left = Math.round(width * 0.14);
  const right = Math.round(width * 0.86);
  const top = Math.round(height * 0.05);
  const bottom = Math.round(height * 0.95);
  const paperWidth = right - left;
  const margin = Math.round(paperWidth * 0.06);
  fillRect(img, width, left, top, paperWidth, bottom - top, [243, 240, 232]);

  let y = top + Math.round(paperWidth * 0.08);
  fillRect(img, width, left + Math.round(paperWidth * 0.3), y, Math.round(paperWidth * 0.4), Math.round(paperWidth * 0.1), DARK_INK);
  y += Math.round(paperWidth * 0.16);

  const lineHeight = Math.round(paperWidth * 0.022);
  const gap = Math.round(lineHeight * 0.9);
  const lastLine = bottom - Math.round(paperWidth * 0.3);
  for (let n = 0; y + lineHeight < lastLine; n++) {
    let x = left + margin;
    const limit = left + Math.round(paperWidth * (0.45 + random() * 0.3));
    while (x < limit) {
      const w = between(Math.round(lineHeight * 1.2), lineHeight * 6);
      if (x + w > right - margin) break;
      fillRect(img, width, x, y, w, lineHeight, INK);
      x += w + between(Math.round(lineHeight * 0.5), lineHeight);
    }
    if (random() < 0.7) {
      const w = between(lineHeight * 2, lineHeight * 3);
      fillRect(img, width, right - margin - w, y, w, lineHeight, INK);
    }
    y += lineHeight + gap;
    if (n % 9 === 8) y += gap;
  }

  y += gap;
  fillRect(img, width, left + margin, y, paperWidth - 2 * margin, 3, INK);
  y += gap;
  fillRect(img, width, left + margin, y, Math.round(paperWidth * 0.25), Math.round(lineHeight * 1.4), DARK_INK);
  fillRect(img, width, right - margin - Math.round(paperWidth * 0.22), y, Math.round(paperWidth * 0.22), Math.round(lineHeight * 1.4), DARK_INK);

  const barcodeY = bottom - Math.round(paperWidth * 0.14);
  for (let x = left + Math.round(paperWidth * 0.2); x < right - Math.round(paperWidth * 0.2); ) {
    const w = between(2, 6);
    fillRect(img, width, x, barcodeY, w, Math.round(paperWidth * 0.08), DARK_INK);
    x += w + between(2, 7);
  }

  for (let i = 0; i < img.length; i++) {
    const v = img[i] + Math.floor(random() * 25) - 12;
    img[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return encodePng(width, height, img);
}

function pdfText(value) {
  return value.replace(/[\\()]/g, (c) => `\\${c}`);
}

function receiptPdf(random, dateText, amountCents) {
  const between = (min, max) => min + Math.floor(random() * (max - min + 1));
  const pick = (list) => list[Math.floor(random() * list.length)];
  const money = (cents) => (cents / 100).toFixed(2);
  const row = (label, value) => `${label.padEnd(44)}${value.padStart(12)}`;

  const count = between(2, 6);
  const items = [];
  let remaining = amountCents;
  for (let i = 0; i < count; i++) {
    const cents = i === count - 1 ? remaining : between(1, Math.max(1, remaining - (count - 1 - i)));
    items.push(row(pick(ITEMS), money(cents)));
    remaining -= cents;
  }

  const lines = [
    pick(ADDRESSES),
    `Date: ${dateText}`,
    `Receipt no. ${between(10000, 99999)}`,
    '',
    '-'.repeat(56),
    ...items,
    '-'.repeat(56),
    row('TOTAL EUR', money(amountCents)),
    row('VAT 21% included', money(Math.round(amountCents - amountCents / 1.21))),
    row('Paid by card', `**** ${between(1000, 9999)}`),
    '',
    'Thank you for your purchase.',
  ];
  const content = [
    `BT /F1 16 Tf 50 790 Td (${pdfText(pick(SHOPS))}) Tj ET`,
    `BT /F1 11 Tf 14 TL 50 760 Td ${lines.map((line) => `(${pdfText(line)}) Tj T*`).join(' ')} ET`,
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

module.exports = { receiptPhoto, receiptPdf };
