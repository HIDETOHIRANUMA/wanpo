/**
 * 暑さ指数の地点一覧を public.wbgt_points 用の SQL にする（運営者のPCで実行。アプリには含めない）
 *
 *   npm run import:wbgt -- --master wbgt_point_master-20260515.csv --sql out/wbgt-points.sql
 *
 * 地点一覧は環境省 熱中症予防情報サイトの「地点一覧」CSV。利用条件を確認してから使う。
 * 出力した SQL は Supabase の SQL Editor で実行する（登録済みで一覧から消えた地点は削除される）。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { decodeCsvBytes, parseWbgtPointMaster, wbgtPointsToSql } from '../src/data/import/wbgtPoints';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const master = opt('--master');
const out = opt('--sql');
if (!master) {
  console.error('使い方: import-wbgt-points --master wbgt_point_master.csv [--sql out.sql]');
  process.exit(2);
}
const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const { points, skipped } = parseWbgtPointMaster(decodeCsvBytes(readFileSync(master)), today);
console.log(`地点 ${points.length} 件、除外 ${skipped.length} 件`);
for (const s of skipped.slice(0, 30)) console.log(`  除外 ${s.ref}: ${s.reason}`);
if (points.length === 0) process.exit(1);
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, wbgtPointsToSql(points));
  console.log(`SQL を書き出しました: ${out}`);
}
