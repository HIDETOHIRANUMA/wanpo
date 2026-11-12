import { createDemoPlaces } from '@/data/demo/places';
import { DEFAULT_FILTERS, searchPlaces, toMapMarkers, type SearchOrigin } from '../search';
import { keyFreshness } from '../verification';
import { dog, makePlace, NOW, verified } from './fixtures';

const origin: SearchOrigin = { kind: 'area', label: 'テスト', lat: 35.65, lng: 139.74 };
const run = (places = createDemoPlaces(NOW), filters = DEFAULT_FILTERS, profile = dog(), query = '') =>
  searchPlaces({ places, origin, filters, query, profile, now: NOW });
const ids = (r: ReturnType<typeof run>) => r.map((x) => x.place.id);

describe('主検索（初期表示）', () => {
  test('同じ区画で室内同伴・冷房の確認記録がある施設だけ。テラスのみ・冷房不明・未公開は入らない', () => {
    const r = ids(run());
    expect(r).toContain('demo-01');
    expect(r).not.toContain('demo-02'); // テラスのみ（店内に冷房あり）
    expect(r).not.toContain('demo-03'); // 冷房不明
    expect(r).not.toContain('demo-12'); // 未公開
    expect(r).not.toContain('demo-20'); // 室内同伴の確認記録なし
  });

  test('未確認を含めても、判明した不可（テラスのみ）は除外したまま', () => {
    const r = ids(run(undefined, { ...DEFAULT_FILTERS, includeBaseUnconfirmed: true }));
    expect(r).toContain('demo-03');
    expect(r).toContain('demo-20');
    expect(r).not.toContain('demo-02');
    expect(r).not.toContain('demo-12');
  });

  test('距離順に並び、半径外は含まない', () => {
    const r = run();
    const d = r.map((x) => x.distanceKm);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    const r1 = run(undefined, { ...DEFAULT_FILTERS, radiusKm: 1 });
    expect(r1.every((x) => x.distanceKm <= 1)).toBe(true);
    expect(r1.length).toBeLessThan(r.length);
  });
});

describe('犬の条件の絞り込み', () => {
  const places = [
    makePlace({ id: 'match' }),
    makePlace({ id: 'check', zone: { weightLimit: { kind: 'text_only', text: '小型犬のみ' } } }),
    makePlace({ id: 'mismatch', zone: { weightLimit: { kind: 'max_kg', maxKg: 3, inclusive: true } } }),
  ];
  test('OFF なら一致・要確認・不一致すべて（基本条件を満たすもの）', () => {
    expect(ids(run(places)).sort()).toEqual(['check', 'match', 'mismatch']);
  });
  test('ON なら一致のみ', () => {
    expect(ids(run(places, { ...DEFAULT_FILTERS, matchMyDog: true }))).toEqual(['match']);
  });
  test('ON＋要確認も含める で要確認を追加。不一致は追加しない', () => {
    expect(ids(run(places, { ...DEFAULT_FILTERS, matchMyDog: true, includeDogNeedsCheck: true })).sort()).toEqual(['check', 'match']);
  });
  test('要確認スイッチは犬条件 OFF のときは効果がない', () => {
    expect(ids(run(places, { ...DEFAULT_FILTERS, includeDogNeedsCheck: true })).sort()).toEqual(['check', 'match', 'mismatch']);
  });
  test('宿泊者限定のデモ施設は厳密な一致検索から除外', () => {
    expect(ids(run(undefined, { ...DEFAULT_FILTERS, matchMyDog: true }))).not.toContain('demo-07');
  });
});

describe('利用条件・営業時間・確認日の絞り込み（AND）', () => {
  test('注文不要・予約なし・水あり は「不明」を含めない', () => {
    const places = [
      makePlace({ id: 'a' }),
      makePlace({ id: 'b', usage: { orderRequired: 'unknown' } }),
      makePlace({ id: 'c', usage: { water: 'unknown' } }),
      makePlace({ id: 'd', usage: { reservationRequired: 'yes' } }),
    ];
    expect(ids(run(places, { ...DEFAULT_FILTERS, noOrderRequired: true, hasWater: true, noReservation: true }))).toEqual(['a']);
  });

  test('「現在利用可能」は営業時間未確認・臨時休業を含めない', () => {
    const r = ids(run(undefined, { ...DEFAULT_FILTERS, openNow: true, includeBaseUnconfirmed: true }));
    expect(r).toContain('demo-01'); // 水曜12時、10-19時営業
    expect(r).not.toContain('demo-09'); // 営業時間不明
    expect(r).not.toContain('demo-11'); // 本日臨時休業
    expect(r).not.toContain('demo-19'); // 一時休業
    expect(r).not.toContain('demo-10'); // 18時〜翌2時
  });

  test('「最近確認」は古い確認・未確認を含めない', () => {
    const r = ids(run(undefined, { ...DEFAULT_FILTERS, recentlyVerified: true, includeBaseUnconfirmed: true }));
    expect(r).not.toContain('demo-08');
    expect(r).not.toContain('demo-20');
    expect(r).toContain('demo-01');
  });

  test('0件でも条件を自動で緩めない', () => {
    const r = run(undefined, { ...DEFAULT_FILTERS, radiusKm: 1 }, dog(), '存在しない名前');
    expect(r).toEqual([]);
  });
});

describe('検索・エリア', () => {
  test('施設名・エリア名で検索できる', () => {
    const places = createDemoPlaces(NOW);
    expect(ids(searchPlaces({ places, origin, filters: DEFAULT_FILTERS, query: 'こもれび', profile: null, now: NOW }))).toEqual(['demo-01']);
    const r = searchPlaces({ places, origin, filters: DEFAULT_FILTERS, query: '渋谷区', profile: null, now: NOW, areaNames: { shibuya: '渋谷区' } });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.place.areaId === 'shibuya')).toBe(true);
  });

  test('エリアを指定した基準点ではそのエリアに限定', () => {
    const r = searchPlaces({ places: createDemoPlaces(NOW), origin: { ...origin, areaId: 'minato' }, filters: DEFAULT_FILTERS, query: '', profile: null, now: NOW });
    expect(r.every((x) => x.place.areaId === 'minato')).toBe(true);
  });
});

describe('地図と一覧の一致', () => {
  test('地図マーカーは一覧と同じ施設集合・順序', () => {
    const filters = { ...DEFAULT_FILTERS, includeBaseUnconfirmed: true, matchMyDog: true, includeDogNeedsCheck: true };
    const list = run(undefined, filters);
    expect(toMapMarkers(list).map((m) => m.id)).toEqual(ids(list));
  });
});

describe('確認日の古さ', () => {
  test('主要項目のうち最も古い最新確認日を使い、90日超で stale', () => {
    const v = [
      ...verified(['indoor_dogs'], '2026-07-10T00:00:00Z'),
      ...verified(['air_conditioning'], '2026-03-01T00:00:00Z'),
      ...verified(['air_conditioning'], '2026-07-01T00:00:00Z'), // 新しい記録が優先
      ...verified(['dog_conditions'], '2026-04-01T00:00:00Z'),
    ];
    const f = keyFreshness(v, NOW);
    expect(f.oldestKeyVerifiedAt).toBe('2026-04-01T00:00:00Z');
    expect(f.status).toBe('stale'); // 2026-04-01 → 2026-07-15 は 105 日
  });

  test('主要項目に未確認があれば unverified', () => {
    const f = keyFreshness(verified(['indoor_dogs', 'air_conditioning']), NOW);
    expect(f.status).toBe('unverified');
    expect(f.missingFields).toEqual(['dog_conditions']);
  });

  test('写真・紹介文の更新（updatedAt）で確認日は変わらない', () => {
    const p = makePlace();
    const before = keyFreshness(p.verifications, NOW);
    const edited = { ...p, photoUrl: 'https://example.com/new.jpg', description: '更新', updatedAt: NOW.toISOString() };
    expect(keyFreshness(edited.verifications, NOW)).toEqual(before);
  });

  test('基準日数は設定で変更できる', () => {
    const v = verified(['indoor_dogs', 'air_conditioning', 'dog_conditions'], '2026-06-01T00:00:00Z');
    expect(keyFreshness(v, NOW, { staleAfterDays: 30 }).status).toBe('stale');
    expect(keyFreshness(v, NOW, { staleAfterDays: 90 }).status).toBe('fresh');
  });
});
