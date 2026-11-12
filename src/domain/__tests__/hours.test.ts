import { availabilityAt, scheduleAvailability, toJst } from '../hours';
import type { Schedule } from '../types';
import { allWeek } from './fixtures';

/** JST の日時から Date を作る */
const jst = (s: string) => new Date(`${s}+09:00`);

describe('Asia/Tokyo 基準', () => {
  test('UTC 15:30 は JST 翌日 0:30', () => {
    const p = toJst(new Date('2026-07-14T15:30:00Z'));
    expect(p.date).toBe('2026-07-15');
    expect(p.minute).toBe(30);
    expect(p.weekday).toBe(3); // 水曜
  });
});

describe('昼休み（複数時間帯）', () => {
  const s: Schedule = { weekly: allWeek([{ openMin: 660, closeMin: 840 }, { openMin: 1020, closeMin: 1260 }]), exceptions: [] };
  test('11:00〜14:00 / 17:00〜21:00', () => {
    expect(scheduleAvailability(s, jst('2026-07-15T12:00:00'))).toBe('open');
    expect(scheduleAvailability(s, jst('2026-07-15T14:00:00'))).toBe('closed'); // 終了時刻ちょうどは営業外
    expect(scheduleAvailability(s, jst('2026-07-15T15:30:00'))).toBe('closed');
    expect(scheduleAvailability(s, jst('2026-07-15T17:00:00'))).toBe('open');
  });
});

describe('日またぎ営業', () => {
  // 火曜のみ 18:00〜翌2:00、水曜は定休
  const s: Schedule = {
    weekly: { status: 'confirmed', byWeekday: { 0: [], 1: [], 2: [{ openMin: 1080, closeMin: 1560 }], 3: [], 4: [], 5: [], 6: [] } },
    exceptions: [],
  };
  test('火曜 23:00 は営業、水曜 1:30 は前日分として営業、水曜 2:00 は営業外', () => {
    expect(scheduleAvailability(s, jst('2026-07-14T23:00:00'))).toBe('open');
    expect(scheduleAvailability(s, jst('2026-07-15T01:30:00'))).toBe('open');
    expect(scheduleAvailability(s, jst('2026-07-15T02:00:00'))).toBe('closed');
    expect(scheduleAvailability(s, jst('2026-07-14T17:59:00'))).toBe('closed');
  });

  test('前日が臨時休業なら、日またぎ分も営業しない', () => {
    const s2: Schedule = { ...s, exceptions: [{ date: '2026-07-14', closed: true, periods: [] }] };
    expect(scheduleAvailability(s2, jst('2026-07-15T01:30:00'))).toBe('closed');
  });
});

describe('臨時休業・時間変更は通常営業より優先', () => {
  const base: Schedule = { weekly: allWeek([{ openMin: 600, closeMin: 1140 }]), exceptions: [] };
  test('臨時休業', () => {
    const s = { ...base, exceptions: [{ date: '2026-07-15', closed: true, periods: [] }] };
    expect(scheduleAvailability(s, jst('2026-07-15T12:00:00'))).toBe('closed');
    expect(scheduleAvailability(s, jst('2026-07-16T12:00:00'))).toBe('open');
  });
  test('短縮営業', () => {
    const s = { ...base, exceptions: [{ date: '2026-07-15', closed: false, periods: [{ openMin: 600, closeMin: 720 }] }] };
    expect(scheduleAvailability(s, jst('2026-07-15T11:00:00'))).toBe('open');
    expect(scheduleAvailability(s, jst('2026-07-15T13:00:00'))).toBe('closed');
  });
  test('通常時間が未確認でも、日付指定の時間変更があればその日は判定できる', () => {
    const s: Schedule = {
      weekly: { status: 'unknown', byWeekday: {} },
      exceptions: [{ date: '2026-07-15', closed: false, periods: [{ openMin: 600, closeMin: 720 }] }],
    };
    expect(scheduleAvailability(s, jst('2026-07-15T11:00:00'))).toBe('open');
    expect(scheduleAvailability(s, jst('2026-07-16T11:00:00'))).toBe('unknown');
  });
});

describe('犬同伴可能時間との共通部分', () => {
  const biz: Schedule = { weekly: allWeek([{ openMin: 660, closeMin: 840 }, { openMin: 1020, closeMin: 1260 }]), exceptions: [] };
  const dogSchedule: Schedule = { weekly: allWeek([{ openMin: 780, closeMin: 1260 }]), exceptions: [] };
  const place = { operatingStatus: 'normal' as const, businessHours: biz, dogHours: { mode: 'custom' as const, schedule: dogSchedule } };

  test('営業中でも犬同伴時間外なら利用不可', () => {
    expect(availabilityAt(place, jst('2026-07-15T12:00:00'))).toBe('closed');
  });
  test('犬同伴時間内でも昼休みなら利用不可', () => {
    expect(availabilityAt(place, jst('2026-07-15T15:00:00'))).toBe('closed');
  });
  test('両方の時間内なら営業時間上は利用可', () => {
    expect(availabilityAt(place, jst('2026-07-15T13:30:00'))).toBe('open');
  });
  test('犬同伴時間が未確認なら不明', () => {
    expect(availabilityAt({ ...place, dogHours: { mode: 'unknown' } }, jst('2026-07-15T13:30:00'))).toBe('unknown');
  });
});

describe('未確認・休業状態', () => {
  test('営業時間が未確認なら不明', () => {
    const s: Schedule = { weekly: { status: 'unknown', byWeekday: {} }, exceptions: [] };
    expect(availabilityAt({ operatingStatus: 'normal', businessHours: s, dogHours: { mode: 'same_as_business' } }, jst('2026-07-15T12:00:00'))).toBe('unknown');
  });
  test('一時休業中は営業時間内でも利用不可', () => {
    const s: Schedule = { weekly: allWeek([{ openMin: 0, closeMin: 1440 }]), exceptions: [] };
    expect(availabilityAt({ operatingStatus: 'temporarily_closed', businessHours: s, dogHours: { mode: 'same_as_business' } }, jst('2026-07-15T12:00:00'))).toBe('closed');
  });
});
