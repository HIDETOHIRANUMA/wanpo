/**
 * 全国のエリア（市区町村）・駅の投入（運営者のPCで実行。アプリには含めない）
 *
 *   npm run import:geo -- --areas templates/areas.template.csv --stations templates/stations.template.csv --check
 *   npm run import:geo -- --areas data/areas.csv --stations data/stations.csv --sql out/geo.sql
 *   DATABASE_URL=postgresql://... npm run import:geo -- --areas data/areas.csv --stations data/stations.csv --db
 *
 * エラーが1件でもあれば何も投入しない。駅の area_id は、同時に投入するエリアか DB に登録済みのエリアであること。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Client } from 'pg';
import { geoToSql, validateAreas, validateStations } from '../src/data/import/geoValidate';
import { parseCsv } from '../src/data/import/validate';

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const areasFile = opt('--areas');
  const stationsFile = opt('--stations');
  const sqlOut = opt('--sql');
  const toDb = args.includes('--db');
  if (!areasFile && !stationsFile) {
    console.error('使い方: import-areas-stations --areas areas.csv --stations stations.csv [--check] [--sql out.sql] [--db]');
    process.exit(2);
  }
  const areas = validateAreas(areasFile ? parseCsv(readFileSync(areasFile, 'utf8')) : []);

  let client: Client | null = null;
  let dbAreaIds: string[] = [];
  if (toDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL が未設定です');
    client = new Client({ connectionString: url });
    await client.connect();
    dbAreaIds = (await client.query<{ id: string }>('select id from public.areas')).rows.map((r) => r.id);
  }
  const stations = validateStations(stationsFile ? parseCsv(readFileSync(stationsFile, 'utf8')) : [], [
    ...dbAreaIds,
    ...areas.value.map((a) => a.id),
  ]);

  const errors = [...areas.errors, ...stations.errors];
  if (errors.length) {
    console.error(`エラー ${errors.length} 件。何も投入していません。`);
    for (const e of errors.slice(0, 200)) console.error(`  [${e.ref}] ${e.field}: ${e.message}`);
    if (errors.length > 200) console.error(`  …ほか ${errors.length - 200} 件`);
    await client?.end();
    process.exit(1);
  }
  console.log(`検証OK：エリア ${areas.value.length} 件・駅 ${stations.value.length} 件`);
  const sql = geoToSql(areas.value, stations.value);
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
