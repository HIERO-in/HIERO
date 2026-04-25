/**
 * CSV 파일을 직접 읽어 MySQL에 삽입.
 * NestJS 부트스트랩 없이 순수 파서 + mysql2로 동작.
 *
 * Usage: node scripts/import-csv-db.mjs <csv-directory>
 */
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { createConnection } from 'mysql2/promise';
import 'dotenv/config';

// ── CSV Parser (파서 서비스와 동일 로직) ──

function parseCSVLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function parseCSVText(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') { cur += '""'; i++; }
      else { inQ = !inQ; cur += c; }
    } else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (cur.length > 0) { rows.push(parseCSVLine(cur)); cur = ''; }
    } else cur += c;
  }
  if (cur.length > 0) rows.push(parseCSVLine(cur));
  return rows;
}

function num(s) {
  if (!s) return 0;
  const clean = String(s).replace(/,/g, '').trim();
  if (clean === '' || clean === '-') return 0;
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

const SUMMARY_COLS = {
  name: '이름', aor: 'AOR', adr: 'ADR', room: '객실 요금',
  cleaningFee: '청소 요금', petFee: '반려동물 요금', extraFee: '추가 요금',
  tax: '세금', commission: '수수료', gross: '총 수입',
  cleaningCost: '청소 비용', rentIn: 'Rent_in', rentOut: 'Rent_out',
  mgmt: '관리비', operation: '운영 비용', refund: '객실 요금 환불',
  labor: '노동 비용', supplies: '소모품 비용', interior: '인테리어',
  other: '기타', totalCost: '총 비용', net: '순이익', margin: '순이익 비율',
};

function detectFile(rawFilename) {
  const filename = rawFilename.normalize('NFC').replace(/[\u00A0\u200B\u2028\u3000]/g, ' ');
  const collapsed = filename.replace(/\s+/g, '');
  const dateMatch = filename.match(/(\d{4})-(\d{2})-\d{2}/);
  const month = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}` : null;
  const isSummary = filename.includes('속성 요약') || collapsed.includes('속성요약');
  const isReservation = filename.includes('-예약') || filename.includes('예약.csv');
  let propertyName = null;
  if (isReservation) {
    const m = filename.match(/속성-(.+?)-예약\.csv$/);
    if (m) propertyName = m[1];
  }
  return { month, type: isSummary ? 'summary' : isReservation ? 'reservation' : 'unknown', propertyName };
}

function parseSummary(text) {
  const rows = parseCSVText(text);
  if (rows.length < 3) return { summary: null, properties: [], error: 'rows < 3' };
  const header = rows[1];
  const idx = {};
  for (const [k, col] of Object.entries(SUMMARY_COLS)) idx[k] = header.indexOf(col);
  if (idx.name < 0 || idx.gross < 0 || idx.net < 0)
    return { summary: null, properties: [], error: 'missing columns' };
  const numKeys = Object.keys(SUMMARY_COLS).filter(k => k !== 'name');
  let summary = null;
  const properties = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const name = row[idx.name];
    if (!name) continue;
    const obj = { name };
    for (const k of numKeys) { const i = idx[k]; obj[k] = i >= 0 && i < row.length ? num(row[i]) : 0; }
    if (name === '합계') summary = obj;
    else properties.push(obj);
  }
  return { summary, properties, error: null };
}

// ── Main ──

const dir = process.argv[2];
if (!dir) { console.error('Usage: node scripts/import-csv-db.mjs <csv-directory>'); process.exit(1); }

const conn = await createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME || 'admin',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'hiero',
});

const allFiles = (await readdir(dir)).filter(f => f.endsWith('.csv'));
console.log(`Found ${allFiles.length} CSV files in: ${dir}`);

// Group by month
const byMonth = {};
for (const f of allFiles) {
  const nfc = f.normalize('NFC');
  const meta = detectFile(nfc);
  if (!meta.month) { console.log(`  skip (no month): ${nfc}`); continue; }
  if (!byMonth[meta.month]) byMonth[meta.month] = { summaryFile: null, reservationFiles: [] };

  const text = (await readFile(join(dir, f))).toString('utf8');
  if (meta.type === 'summary') {
    const parsed = parseSummary(text);
    if (parsed.summary) {
      byMonth[meta.month].summaryFile = { name: nfc, summary: parsed.summary, properties: parsed.properties };
      console.log(`  ✓ summary: ${nfc} (${parsed.properties.length} properties)`);
    } else {
      console.log(`  ✗ summary parse fail: ${nfc} — ${parsed.error}`);
    }
  } else if (meta.type === 'reservation') {
    // skip reservation details for now (optional)
  }
}

// Insert into DB
for (const [month, data] of Object.entries(byMonth)) {
  if (!data.summaryFile) { console.log(`\n${month}: no summary → skip`); continue; }
  const s = data.summaryFile.summary;
  const props = data.summaryFile.properties;

  // Delete existing month
  const [existing] = await conn.query('SELECT id FROM monthly_reports WHERE month = ?', [month]);
  if (existing.length > 0) {
    await conn.query('DELETE FROM monthly_reports WHERE id = ?', [existing[0].id]);
    console.log(`\n${month}: deleted existing data`);
  }

  // Insert monthly_reports
  const [reportResult] = await conn.query(
    `INSERT INTO monthly_reports (month, gross, commission, totalCost, net, margin,
      rentOut, rentIn, cleaningCost, mgmt, operation, labor, interior, supplies, refund, \`other\`,
      totalPropertiesCount, totalReservationsCount, sourceFilename)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [month, s.gross, s.commission, s.totalCost, s.net, s.margin || 0,
      s.rentOut, s.rentIn, s.cleaningCost, s.mgmt, s.operation, s.labor, s.interior, s.supplies, s.refund, s.other || 0,
      props.length, 0, data.summaryFile.name]
  );
  const reportId = reportResult.insertId;

  // Insert monthly_report_properties (batch 500)
  for (let i = 0; i < props.length; i += 500) {
    const chunk = props.slice(i, i + 500);
    const values = chunk.map(p => [
      reportId, month, p.name,
      p.aor, p.adr, p.room, p.cleaningFee, p.petFee, p.extraFee, p.tax, p.commission, p.gross,
      p.cleaningCost, p.rentIn, p.rentOut, p.mgmt, p.operation, p.refund, p.labor, p.supplies, p.interior, p.other || 0,
      p.totalCost, p.net, p.margin || 0,
    ]);
    await conn.query(
      `INSERT INTO monthly_report_properties
        (monthlyReportId, month, propertyName,
         aor, adr, room, cleaningFee, petFee, extraFee, tax, commission, gross,
         cleaningCost, rentIn, rentOut, mgmt, operation, refund, labor, supplies, interior, \`other\`,
         totalCost, net, margin)
       VALUES ${chunk.map(() => '(?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?,?, ?,?,?)').join(',')}`,
      values.flat()
    );
  }

  console.log(`\n${month}: ✓ saved — ${props.length} properties, gross=${Math.round(s.gross).toLocaleString()}, net=${Math.round(s.net).toLocaleString()}`);
}

await conn.end();
console.log('\nDone!');
