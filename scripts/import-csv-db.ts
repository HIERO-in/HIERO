/**
 * CSV 파일을 직접 읽어서 DB에 삽입하는 스크립트.
 * multer 한글 파일명 깨짐 문제를 우회.
 *
 * Usage: npx ts-node scripts/import-csv-db.ts <csv-directory>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MonthlyReportsService } from '../src/monthly-reports/services/monthly-reports.service';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: npx ts-node scripts/import-csv-db.ts <csv-directory>');
    process.exit(1);
  }

  // NestJS 앱 부트스트랩 (HTTP 서버 없이)
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(MonthlyReportsService);

  const allFiles = (await readdir(dir)).filter((f) => f.endsWith('.csv'));
  console.log(`Found ${allFiles.length} CSV files in: ${dir}`);

  // 파일을 읽어서 NFC 정규화된 원본 파일명과 함께 전달
  const csvFiles: { originalname: string; buffer: Buffer }[] = [];
  for (const f of allFiles) {
    const normalized = f.normalize('NFC');
    const buffer = await readFile(join(dir, f));
    csvFiles.push({ originalname: normalized, buffer });
  }

  console.log('Importing...');
  const result = await service.importFromFiles(csvFiles);

  console.log(`\nSaved months: ${JSON.stringify(result.savedMonths)}`);
  const ok = result.log.filter((l) => l.ok);
  const fail = result.log.filter((l) => !l.ok);
  console.log(`Success: ${ok.length}, Failed: ${fail.length}`);

  for (const l of fail) {
    console.log(`  ✗ ${l.filename} — ${l.message}`);
  }
  for (const l of ok.slice(0, 5)) {
    console.log(`  ✓ ${l.filename} — ${l.message}`);
  }
  if (ok.length > 5) console.log(`  ... and ${ok.length - 5} more`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
