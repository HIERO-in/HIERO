/**
 * CSV 파일을 직접 파싱하여 DB에 삽입 (API 우회, 서버 코드 직접 사용).
 * Usage: node --loader ts-node/esm scripts/import-csv-direct.mjs <csv-directory>
 *
 * 멀티파트 한글 파일명 깨짐 문제를 우회하기 위해
 * 파일을 직접 읽어서 원본 파일명(NFC)을 보존합니다.
 */
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const dir = process.argv[2];
const api = process.argv[3] || 'http://localhost:3000/api/monthly-reports/import';

if (!dir) {
  console.error('Usage: node scripts/import-csv-direct.mjs <csv-directory>');
  process.exit(1);
}

// 파일명을 NFC 정규화 + 원본 바이트를 multipart boundary로 직접 조립
const CRLF = '\r\n';
const BOUNDARY = '----HieroUpload' + Date.now();

const files = (await readdir(dir)).filter((f) => f.endsWith('.csv'));
console.log(`Found ${files.length} CSV files in: ${dir}`);

// multipart body를 수동 조립 (한글 파일명 UTF-8 보존)
const parts = [];
for (const f of files) {
  const nfc = f.normalize('NFC');
  const content = await readFile(join(dir, f));

  // Content-Disposition을 UTF-8 filename*= 형식으로
  const header = [
    `--${BOUNDARY}`,
    `Content-Disposition: form-data; name="files"; filename="${nfc}"`,
    `Content-Type: text/csv`,
    '',
    '',
  ].join(CRLF);

  parts.push(Buffer.from(header, 'utf8'));
  parts.push(content);
  parts.push(Buffer.from(CRLF, 'utf8'));
}
parts.push(Buffer.from(`--${BOUNDARY}--${CRLF}`, 'utf8'));

const body = Buffer.concat(parts);

console.log(`Uploading ${files.length} files (${(body.length / 1024).toFixed(0)} KB)...`);

const res = await fetch(api, {
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`,
  },
  body,
});

const data = await res.json();
console.log(`\nStatus: ${res.status}`);
console.log(`Saved months: ${JSON.stringify(data.savedMonths)}`);

const ok = data.log.filter((l) => l.ok);
const fail = data.log.filter((l) => !l.ok);
console.log(`Success: ${ok.length}, Failed: ${fail.length}`);

for (const l of fail.slice(0, 5)) {
  console.log(`  ✗ ${l.filename} — ${l.message}`);
}
for (const l of ok.slice(0, 5)) {
  console.log(`  ✓ ${l.filename} — ${l.message}`);
}
if (ok.length > 5) console.log(`  ... and ${ok.length - 5} more`);
