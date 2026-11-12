/**
 * DB ⇄ アプリの往復確認：投入テンプレート → SQL → PostgreSQL → PostgREST 相当の入れ子JSON → mapPlace → 判定
 * scripts/test-db.sh から呼ぶ（DATABASE_URL はローカルの使い捨てDB）。
 */
import { EMPTY_DOG_PROFILE } from '../src/domain/types';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { toSql, validatePlace } from '../src/data/import/validate';
import { mapPlace } from '../src/data/supabase/mappers';
import type { PlaceRow } from '../src/data/supabase/dbTypes';
import { judgeBase, judgeDogFit } from '../src/domain/judge';
import { availabilityAt } from '../src/domain/hours';
import { keyFreshness } from '../src/domain/verification';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const raw = JSON.parse(readFileSync('templates/places.template.json', 'utf8'));
  raw[0].publication_status = 'published';
  const res = validatePlace(raw[0], 0, ['shinagawa', 'minato', 'shibuya'], new Date('2026-11-11T00:00:00Z'));
  assert.equal(res.errors.length, 0, JSON.stringify(res.errors));
  const id = randomUUID();
  await client.query(toSql([{ ...res.value!, id }], randomUUID));
  // 2回目の投入（更新）でも確認記録が重複しない
  await client.query(toSql([{ ...res.value!, id }], randomUUID));

  const q = await client.query<{ j: PlaceRow }>(
    `select to_jsonb(p) || jsonb_build_object(
        'place_dog_zones', (select coalesce(jsonb_agg(z), '[]') from public.place_dog_zones z where z.place_id = p.id),
        'place_hours', (select coalesce(jsonb_agg(h), '[]') from public.place_hours h where h.place_id = p.id),
        'place_hour_exceptions', (select coalesce(jsonb_agg(e), '[]') from public.place_hour_exceptions e where e.place_id = p.id),
        'place_verifications', (select coalesce(jsonb_agg(v), '[]') from public.place_verifications v where v.place_id = p.id),
        'place_media', (select coalesce(jsonb_agg(m), '[]') from public.place_media m where m.place_id = p.id),
        'areas', (select jsonb_build_object('name', a.name, 'prefecture', a.prefecture) from public.areas a where a.id = p.area_id)
      ) as j
     from public.places p where p.id = $1`,
    [id],
  );
  const place = mapPlace(q.rows[0].j);
  // 全国のエリア・駅の投入（テンプレート）と、範囲での取得に使う索引列
  const geo = await client.query<{ n: string }>(`select count(*)::text as n from public.stations where line_name is not null`);
  await client.end();

  assert.ok(Number(geo.rows[0].n) >= 3, '駅テンプレートが投入されている');
  assert.equal(place.reservationUrl, 'https://example.com/reserve');
  assert.deepEqual(place.atmosphereTags, ['明るい', 'ソファ席', '大きな窓']);
  assert.deepEqual(place.media.map((m) => m.kind), ['exterior', 'interior'], '店舗写真は並び順どおり・再投入で重複しない');
  assert.equal(place.areaName, '港区');

  assert.equal(place.verifications.length, 3, '確認記録は再投入で重複しない');
  assert.equal(place.zone.scope, 'indoor_partial');
  assert.deepEqual(place.zone.weightLimit, { kind: 'max_kg', maxKg: 10, inclusive: true, text: '体重10kg以下' });
  assert.deepEqual(place.zone.carry.status === 'confirmed' && place.zone.carry.allowed, ['cart', 'bag']);
  assert.equal(place.zone.extraRequirements.length, 2);
  assert.deepEqual(place.zone.breed, { status: 'brachycephalic_ng', text: '短頭種は夏季（6〜9月）同伴不可' });
  assert.deepEqual(place.zone.maxDogs, { kind: 'max', count: 2 });
  assert.equal(place.zone.floor, 'non_slip');
  assert.equal(place.zone.dogMenu, 'yes');
  assert.equal(place.zone.dogSeats, 8);
  assert.equal(judgeBase(place).status, 'confirmed');
  const dog = { ...EMPTY_DOG_PROFILE, weightKg: 10, carryMethods: ['bag' as const], canBringCertificate: 'yes' as const };
  // 「大型犬の場合はカート必須」が要確認として残る
  assert.equal(judgeDogFit(place, dog).result, 'needs_check');
  assert.equal(judgeDogFit(place, { ...dog, weightKg: 10.5 }).result, 'mismatch');
  // 金曜 25:30（=土曜 1:30 JST）。営業は 17:00-26:00 だが犬同伴は 13:00-22:00 → 利用不可
  assert.equal(availabilityAt(place, new Date('2026-11-13T16:30:00Z')), 'closed');
  // 金曜 20:00 JST は両方の時間内
  assert.equal(availabilityAt(place, new Date('2026-11-13T11:00:00Z')), 'open');
  // 水曜は定休
  assert.equal(availabilityAt(place, new Date('2026-11-11T05:00:00Z')), 'closed');
  // 12/31 は臨時休業（通常は木曜営業）
  assert.equal(availabilityAt(place, new Date('2026-12-31T05:00:00Z')), 'closed');
  assert.equal(keyFreshness(place.verifications, new Date('2026-11-11T00:00:00Z')).status, 'fresh');
  console.log('DB ⇄ アプリ往復テスト：OK');
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
