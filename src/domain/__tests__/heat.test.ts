import { dailyPeak, demoHeatForecast, heatLevel, hourlyForDay, parseWbgtForecastCsv, riskyWindows, wbgtAt, type HeatForecast } from '../heat';

const f = (pts: [string, number][]): HeatForecast => ({
  source: 'env_go_jp',
  pointId: '44132',
  pointName: '東京',
  pointDistanceKm: 1,
  issuedAt: null,
  hourly: pts.map(([at, wbgt]) => ({ at, wbgt })),
});

describe('暑さ指数の区分（環境省の指針）', () => {
  test.each([
    [20.9, 'safe'],
    [21, 'caution'],
    [25, 'warning'],
    [28, 'severe'],
    [30.9, 'severe'],
    [31, 'danger'],
  ])('%s → %s', (v, lv) => expect(heatLevel(v)).toBe(lv));
});

describe('時刻の値', () => {
  const fc = f([
    ['2026-07-15T03:00:00.000Z', 30], // 12時 JST
    ['2026-07-15T06:00:00.000Z', 33], // 15時
  ]);
  test('予測点のあいだは直線で補間する', () => {
    expect(wbgtAt(fc, new Date('2026-07-15T04:30:00Z'))).toBe(31.5);
  });
  test('予測の範囲から3時間を超えて離れたら null（推測で埋めない）', () => {
    expect(wbgtAt(fc, new Date('2026-07-15T10:00:00Z'))).toBeNull();
    expect(wbgtAt(null, new Date())).toBeNull();
  });
  test('1日の時間別・厳重警戒以上の時間帯・最大値', () => {
    const now = new Date('2026-07-15T03:00:00Z');
    const hours = hourlyForDay(fc, now);
    expect(hours[12]).not.toBeNull();
    expect(hours[3]).toBeNull();
    const w = riskyWindows(fc, now, 'severe');
    expect(w[0].startMin).toBe(9 * 60); // 9時台から（12時の3時間前までは範囲内）
    expect(dailyPeak(fc, now)?.wbgt).toBeGreaterThanOrEqual(32);
  });
});

describe('環境省の予測値CSV', () => {
  const csv = [',,2026073112,2026073115,2026073118,2026073124', '44132,2026/07/31 10:25,310,330,,250', '11001,2026/07/31 10:25,200,210,190,180'].join('\n');
  test('地点の行を読み、値を10で割る。24時は翌日0時。空欄は捨てる', () => {
    const r = parseWbgtForecastCsv(csv, '44132');
    expect(r?.hourly).toEqual([
      { at: '2026-07-31T03:00:00.000Z', wbgt: 31 },
      { at: '2026-07-31T06:00:00.000Z', wbgt: 33 },
      { at: '2026-07-31T15:00:00.000Z', wbgt: 25 },
    ]);
    expect(r?.issuedAt).toBe('2026-07-31T01:25:00.000Z');
  });
  test('地点がない・形式が違うときは null', () => {
    expect(parseWbgtForecastCsv(csv, '99999')).toBeNull();
    expect(parseWbgtForecastCsv('hello', '44132')).toBeNull();
    expect(parseWbgtForecastCsv('a,b,c\n44132,x,abc', '44132')).toBeNull();
  });
  test('ありえない値（45超）は捨てる', () => {
    expect(parseWbgtForecastCsv(',,2026073112\n44132,,999', '44132')).toBeNull();
  });
});

test('デモの暑さ指数は3日分・3時間ごと', () => {
  const d = demoHeatForecast(new Date('2026-08-01T03:00:00Z'));
  expect(d.source).toBe('demo');
  expect(d.hourly).toHaveLength(25);
  expect(Math.max(...d.hourly.map((h) => h.wbgt))).toBeGreaterThanOrEqual(31);
});
