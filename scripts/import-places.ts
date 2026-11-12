/**
 * 実データ投入スクリプト（運営者のPCで実行。アプリには含めない）
 *
 *   npm run import:places -- templates/places.template.json --check
 *   npm run import:places -- data/places.csv --sql out/import.sql   # SQL を生成し Studio の SQL Editor で実行
 *   DATABASE_URL=postgresql://... npm run import:places -- data/places.json --db   # 直接投入（1トランザクション）
 *
 * エラーが1件でもあれば何も投入せず、行（ref）・項目・理由を表示して終了コード1で終わる。
 * DATABASE_URL は秘密情報。.env に EXPO_PUBLIC_ を付けずに置くか、実行時にだけ渡す。
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname } from 'node:path';
import { Client } from 'pg';
import { csvRowToRaw, parseCsv, toSql, validatePlace, type ImportError, type NormalizedPlace } from '../src/data/import/validate';

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const sqlIdx = args.indexOf('--sql');
  const sqlOut = sqlIdx >= 0 ? args[sqlIdx + 1] : null;
  const toDb = args.includes('--db');
  const areasArg = args.indexOf('--areas');
  if (!file) {
    console.error('使い方: import-places <file.json|file.csv> [--check] [--sql out.sql] [--db] [--areas shinagawa,minato,shibuya]');
    process.exit(2);
  }
  const text = readFileSync(file, 'utf8');
  const rawRows: Record<string, unknown>[] =
    extname(file).toLowerCase() === '.csv' ? parseCsv(text).map(csvRowToRaw) : (JSON.parse(text) as Record<string, unknown>[]);
  if (!Array.isArray(rawRows)) throw new Error('JSON は配列にしてください');

  let knownAreas = areasArg >= 0 ? args[areasArg + 1].split(',') : ['shinagawa', 'minato', 'shibuya'];
  let client: Client | null = null;
  if (toDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL が未設定です');
    client = new Client({ connectionString: url });
    await client.connect();
    knownAreas = (await client.query<{ id: string }>('select id from public.areas')).rows.map((r) => r.id);
  }

  const ok: NormalizedPlace[] = [];
  const errors: ImportError[] = [];
  rawRows.forEach((r, i) => {
    const res = validatePlace(r, i, knownAreas);
    errors.push(...res.errors);
    if (res.value) ok.push(res.value);
  });

  if (errors.length) {
    console.error(`エラー ${errors.length} 件（${new Set(errors.map((e) => e.ref)).size} 行）。何も投入していません。`);
    for (const e of errors) console.error(`  [${e.ref}] ${e.field}: ${e.message}`);
    await client?.end();
    process.exit(1);
  }
  console.log(`検証OK：${ok.length} 件`);
  const sql = toSql(ok, randomUUID);
  if (sqlOut) {
    mkdirSync(dirname(sqlOut), { recursive: true });
    writeFileSync(sqlOut, sql);
    console.log(`SQL を書き出しました：${sqlOut}`);
  }
  if (client) {
    try {
      await client.query(sql);
      console.log('投入しました（1トランザクション）');
    } catch (e) {
      await client.query('rollback').catch(() => undefined);
      console.error('投入に失敗しました。変更はありません：', (e as Error).message);
      process.exitCode = 1;
    } finally {
      await client.end();
    }
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
