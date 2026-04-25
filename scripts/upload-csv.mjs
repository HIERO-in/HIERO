/**
 * Hostex 수지보고서 CSV를 백엔드 monthly-reports/import API로 업로드.
 * Usage: node scripts/upload-csv.mjs <csv-directory> [api-url]
 */
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const dir = process.argv[2];
const api = process.argv[3] || 'http://localhost:3000/api/monthly-reports/import';

if (!dir) {
  console.error('Usage: node scripts/upload-csv.mjs <csv-directory> [api-url]');
  process.exit(1);
}

const files = (await readdir(dir)).filter((f) => f.endsWith('.csv'));
console.log(`Found ${files.length} CSV files in: ${dir}`);

const form = new FormData();
for (const f of files) {
  const buf = await readFile(join(dir, f));
  // NFC 정규화된 파일명으로 Blob 생성
  const normalized = f.normalize('NFC');
  form.append('files', new Blob([buf]), normalized);
}

console.log('Uploading...');
const res = await fetch(api, { method: 'POST', body: form });
const data = await res.json();

console.log(`\nStatus: ${res.status}`);
console.log(`Saved months: ${JSON.stringify(data.savedMonths)}`);

const ok = data.log.filter((l) => l.ok);
const fail = data.log.filter((l) => !l.ok);
console.log(`Success: ${ok.length}, Failed: ${fail.length}`);

for (const l of fail) {
  console.log(`  ✗ ${l.filename} — ${l.message}`);
}
for (const l of ok.slice(0, 5)) {
  console.log(`  ✓ ${l.filename} — ${l.message}`);
}
if (ok.length > 5) console.log(`  ... and ${ok.length - 5} more`);
