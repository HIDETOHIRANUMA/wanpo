import type { DogHours, HourException, OperatingStatus, Period, Schedule, Weekday } from './types';

/** Asia/Tokyo は1951年以降夏時間がないため固定オフセットで計算する（端末のタイムゾーンに依存しない） */
const JST_OFFSET_MIN = 9 * 60;

export interface JstParts {
  date: string; // YYYY-MM-DD
  weekday: Weekday;
  minute: number; // 0..1439
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toJst(at: Date): JstParts {
  const shifted = new Date(at.getTime() + JST_OFFSET_MIN * 60_000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  const d = shifted.getUTCDate();
  return {
    date: `${y}-${pad(m)}-${pad(d)}`,
    weekday: shifted.getUTCDay() as Weekday,
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** JSTの日付文字列から前日を求める */
export function previousDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) - 86_400_000;
  const p = new Date(t);
  return `${p.getUTCFullYear()}-${pad(p.getUTCMonth() + 1)}-${pad(p.getUTCDate())}`;
}

export type Availability = 'open' | 'closed' | 'unknown';

/** その日（JST日付）の時間帯。臨時休業・時間変更は通常営業時間より優先。不明なら null */
export function periodsForDate(
  schedule: Schedule,
  date: string,
  weekday: Weekday,
): Period[] | null {
  const ex: HourException[] = schedule.exceptions.filter((e) => e.date === date);
  if (ex.length > 0) {
    if (ex.some((e) => e.closed)) return [];
    return ex.flatMap((e) => e.periods);
  }
  if (schedule.weekly.status !== 'confirmed') return null;
  const p = schedule.weekly.byWeekday[weekday];
  // 確認済みでも曜日の記載がなければ不明扱い（「定休」は空配列で明示）
  return p === undefined ? null : p;
}

/** スケジュール上、指定時刻が営業時間内か。日またぎ（closeMin>1440）は前日の時間帯として扱う */
export function scheduleAvailability(schedule: Schedule, at: Date): Availability {
  const now = toJst(at);
  const today = periodsForDate(schedule, now.date, now.weekday);
  const yWeekday = ((now.weekday + 6) % 7) as Weekday;
  const yesterday = periodsForDate(schedule, previousDate(now.date), yWeekday);

  const openToday = today?.some((p) => p.openMin <= now.minute && now.minute < p.closeMin) ?? false;
  const m2 = now.minute + 1440;
  const openFromYesterday =
    yesterday?.some((p) => p.closeMin > 1440 && p.openMin <= m2 && m2 < p.closeMin) ?? false;

  if (openToday || openFromYesterday) return 'open';
  if (today === null || yesterday === null) return 'unknown';
  return 'closed';
}

/**
 * 営業時間と犬同伴可能時間の共通部分で「営業時間上いま利用できるか」を判定する。
 * 時間情報が未確認なら unknown（「現在利用可能」の絞り込みには含めない）。
 */
export function availabilityAt(
  input: { operatingStatus: OperatingStatus; businessHours: Schedule; dogHours: DogHours },
  at: Date,
): Availability {
  if (input.operatingStatus === 'closed' || input.operatingStatus === 'temporarily_closed')
    return 'closed';
  const biz = scheduleAvailability(input.businessHours, at);
  let dog: Availability;
  if (input.dogHours.mode === 'same_as_business') dog = biz;
  else if (input.dogHours.mode === 'unknown') dog = 'unknown';
  else dog = scheduleAvailability(input.dogHours.schedule, at);

  let result: Availability;
  if (biz === 'closed' || dog === 'closed') result = 'closed';
  else if (biz === 'open' && dog === 'open') result = 'open';
  else result = 'unknown';
  if (result === 'open' && input.operatingStatus === 'unknown') return 'unknown';
  return result;
}

export function availabilityLabel(a: Availability): string {
  switch (a) {
    case 'open':
      return '営業時間上は営業中';
    case 'closed':
      return '営業時間上は営業時間外';
    case 'unknown':
      return '営業時間は未確認';
  }
}

export function formatMinute(min: number): string {
  const nextDay = min >= 1440;
  const m = nextDay ? min - 1440 : min;
  return `${nextDay ? '翌' : ''}${Math.floor(m / 60)}:${pad(m % 60)}`;
}

export function formatPeriods(periods: Period[] | undefined | null): string {
  if (periods === null || periods === undefined) return '未確認';
  if (periods.length === 0) return '休み';
  return periods.map((p) => `${formatMinute(p.openMin)}〜${formatMinute(p.closeMin)}`).join('、');
}

export const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** "HH:MM" を分に。24:00超（翌日）は "26:00" のように表す */
export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (mi > 59 || h > 48) return null;
  return h * 60 + mi;
}

export function isValidPeriod(p: Period): boolean {
  return (
    Number.isInteger(p.openMin) &&
    Number.isInteger(p.closeMin) &&
    p.openMin >= 0 &&
    p.openMin < 1440 &&
    p.closeMin > p.openMin &&
    p.closeMin <= p.openMin + 1440
  );
}
