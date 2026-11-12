import { decodeCsvBytes, parseWbgtPointMaster, wbgtPointsToSql } from '../import/wbgtPoints';

const MASTER = [
  '地方,振興局,地点番号,観測所名,よみがな,ローマ字表記,所在地,Latitude(deg),Latitude_3(min),Longitude(deg),Longitude_4(min),Start,End',
  '関東甲信,,44132,東京,とうきょう,Tokyo,千代田区,35,41.5,139,45.0,2002-01-01,9999-99-99',
  '関東甲信,,44136,練馬,ねりま,Nerima,練馬区,35,44.1,139,40.3,2002-01-01,2020-03-31',
  '関東甲信,,4413X,不正,ふせい,Bad,どこか,35,0,139,0,2002-01-01,9999-99-99',
  "近畿,,62078,大阪's,おおさか,Osaka,大阪市,34,40.9,135,31.1,2002-01-01,9999-99-99",
].join('\n');

describe('暑さ指数の地点一覧', () => {
  test('度と分を足し、終了済み・不正な番号は除く', () => {
    const r = parseWbgtPointMaster(MASTER, '2026-11-14');
    expect(r.points.map((p) => p.id)).toEqual(['44132', '62078']);
    expect(r.points[0].lat).toBeCloseTo(35 + 41.5 / 60, 4);
    expect(r.points[0].lng).toBeCloseTo(139.75, 4);
    expect(r.skipped.map((s) => s.ref)).toEqual(['44136', '行4']);
  });
  test('SQL は引用符をエスケープし、一覧から消えた地点を消す', () => {
    const sql = wbgtPointsToSql(parseWbgtPointMaster(MASTER, '2026-11-14').points);
    expect(sql).toContain("'大阪''s'");
    expect(sql).toContain("delete from public.wbgt_points where id not in ('44132', '62078')");
  });
  test('UTF-8 でなければ Shift_JIS として読む', () => {
    const sjis = new Uint8Array([0x93, 0x8c, 0x8b, 0x9e]); // 「東京」
    expect(decodeCsvBytes(sjis)).toBe('東京');
    expect(decodeCsvBytes(new TextEncoder().encode('﻿東京'))).toBe('東京');
  });
});
