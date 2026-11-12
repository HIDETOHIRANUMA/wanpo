import { coolNow, coverageCircles, coverageRatio, isCoolSpot, planWalk, reachKm, walkMinutes } from '../cool';
import type { HeatForecast } from '../heat';
import { evaluate, type SearchOrigin } from '../search';
import { allWeek, dog, makePlace, NOW } from './fixtures';

const origin: SearchOrigin = { kind: 'area', label: 'テスト', lat: 35.65, lng: 139.74 };
const res = (places: ReturnType<typeof makePlace>[], at = NOW) =>
  places.map((p) => evaluate(p, { origin, filters: {} as never, query: '', profile: dog(), now: at })).sort((a, b) => a.distanceKm - b.distanceKm);

// 約0.5kmずつ離れた施設
const near = makePlace({ id: 'near', lat: 35.6545, lng: 139.74 });
const mid = makePlace({ id: 'mid', lat: 35.659, lng: 139.74 });
const far = makePlace({ id: 'far', lat: 35.6635, lng: 139.74 });
const closedNow = makePlace({ id: 'closed', lat: 35.651, lng: 139.74, extra: { businessHours: { weekly: allWeek([{ openMin: 1080, closeMin: 1260 }]), exceptions: [] } } });
const terrace = makePlace({ id: 'terrace', lat: 35.6505, lng: 139.7405, zone: { scope: 'terrace', indoorDogs: 'no' } });
const tooHeavy = makePlace({ id: 'heavy', lat: 35.6502, lng: 139.7402, zone: { weightLimit: { kind: 'max_kg', maxKg: 3, inclusive: true } } });

test('徒歩時間の目安（直線×1.3、時速3km）', () => {
  expect(walkMinutes(1)).toBe(26);
  expect(reachKm(26)).toBeCloseTo(1, 1);
});

describe('いますぐ涼みたい', () => {
  test('いま開いていて、確認済み・うちの犬に不一致でない、いちばん近い場所', () => {
    const r = coolNow(res([far, mid, near, closedNow, terrace, tooHeavy]));
    expect(r.best?.place.id).toBe('near');
    expect(r.alternatives.map((x) => x.place.id)).toEqual(['mid', 'far']);
  });
  test('テラスのみ・体重オーバーは涼める場所に含めない', () => {
    const all = res([terrace, tooHeavy]);
    expect(all.filter(isCoolSpot)).toHaveLength(0);
  });
});

describe('お散歩プラン', () => {
  const hot: HeatForecast = {
    source: 'demo',
    pointId: 'x',
    pointName: 'x',
    pointDistanceKm: 0,
    issuedAt: null,
    hourly: [
      { at: '2026-07-15T00:00:00.000Z', wbgt: 29 },
      { at: '2026-07-15T06:00:00.000Z', wbgt: 32 },
    ],
  };
  test('時間内に戻れる範囲で、近い順に休憩先をつなぐ', () => {
    const p = planWalk({ origin, start: NOW, durationMin: 90, restMin: 10, results: res([far, mid, near]), forecast: null });
    expect(p.stops.map((s) => s.result.place.id)).toEqual(['near', 'mid']);
    expect(p.totalMin).toBeLessThanOrEqual(90);
    expect(p.stops[0].arriveAt.getTime()).toBe(NOW.getTime() + p.stops[0].legMin * 60_000);
  });
  test('着いたときに閉まっている場所には寄らない', () => {
    const p = planWalk({ origin, start: NOW, durationMin: 60, restMin: 10, results: res([closedNow]), forecast: null });
    expect(p.stops).toHaveLength(0);
    expect(p.warnings[0]).toMatch(/見つかりませんでした/);
  });
  test('厳重警戒以上の区間があれば注意を出す', () => {
    const p = planWalk({ origin, start: NOW, durationMin: 60, restMin: 10, results: res([near]), forecast: hot });
    expect(p.warnings.some((w) => /厳重警戒|危険/.test(w))).toBe(true);
  });
});

describe('涼しさの地図', () => {
  test('涼める場所ごとの徒歩10分圏', () => {
    const c = coverageCircles(res([near, terrace]));
    expect(c.map((x) => x.id)).toEqual(['near']);
    expect(c[0].radiusKm).toBeCloseTo(reachKm(10));
  });
  test('カバー率：涼める場所がなければ0、基準点の近くにあれば一部をカバー', () => {
    expect(coverageRatio(origin, [], 1)).toBe(0);
    const r = coverageRatio(origin, res([near]), 1);
    expect(r).toBeGreaterThan(0.05);
    expect(r).toBeLessThan(0.5);
  });
});
