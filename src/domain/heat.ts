/**
 * 暑さ指数（WBGT）。値は環境省「熱中症予防情報サイト」の予測値を使う（本番）。
 * 区分は環境省の「日常生活に関する指針」に合わせる。犬は地面に近く熱を受けやすいため、
 * 画面では「人の基準より1段階きびしめに」と案内する。
 */
import { toJst } from './hours';

export type HeatLevel = 'safe' | 'caution' | 'warning' | 'severe' | 'danger';

export const HEAT_LEVEL_LABEL: Record<HeatLevel, string> = {
  safe: 'ほぼ安全',
  caution: '注意',
  warning: '警戒',
  severe: '厳重警戒',
  danger: '危険',
};

/** 犬連れ向けのひとこと */
export const HEAT_DOG_ADVICE: Record<HeatLevel, string> = {
  safe: '水を持って、こまめに休憩を',
  caution: '日なたの長歩きは控えめに',
  warning: '涼しい場所で休みながら',
  severe: '散歩は朝夕の涼しい時間に',
  danger: '外出を控え、室内で過ごしましょう',
};

export function heatLevel(wbgt: number): HeatLevel {
  if (wbgt >= 31) return 'danger';
  if (wbgt >= 28) return 'severe';
  if (wbgt >= 25) return 'warning';
  if (wbgt >= 21) return 'caution';
  return 'safe';
}

export interface HeatPoint {
  /** 対象時刻（ISO） */
  at: string;
  wbgt: number;
}

export interface HeatForecast {
  source: 'env_go_jp' | 'demo';
  pointId: string;
  pointName: string;
  /** 基準点から観測地点までの直線距離 */
  pointDistanceKm: number;
  /** 予測の作成時刻（ISO）。不明なら null */
  issuedAt: string | null;
  /** 時刻順 */
  hourly: HeatPoint[];
}

export const HEAT_SOURCE_LABEL: Record<HeatForecast['source'], string> = {
  env_go_jp: '出典：環境省熱中症予防情報サイト（予測値をもとに加工して表示）',
  demo: 'デモ用の架空の暑さ指数です',
};

/**
 * 指定時刻の暑さ指数。予測点のあいだは直線で補間する。
 * 予測の範囲外（前後3時間を超える）なら null（推測で埋めない）。
 */
export function wbgtAt(f: HeatForecast | null, at: Date): number | null {
  if (!f || f.hourly.length === 0) return null;
  const t = at.getTime();
  const pts = f.hourly.map((p) => ({ t: Date.parse(p.at), v: p.wbgt }));
  const MAX_GAP = 3 * 3_600_000;
  if (t < pts[0].t - MAX_GAP || t > pts[pts.length - 1].t + MAX_GAP) return null;
  if (t <= pts[0].t) return pts[0].v;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (t <= b.t) {
      if (b.t - a.t > MAX_GAP * 2) return null;
      const r = (t - a.t) / (b.t - a.t);
      return Math.round((a.v + (b.v - a.v) * r) * 10) / 10;
    }
  }
  return pts[pts.length - 1].v;
}

/** JST の1日を1時間ごとに区切った暑さ指数（0〜23時）。不明な時間は null */
export function hourlyForDay(f: HeatForecast | null, now: Date): (number | null)[] {
  const { date } = toJst(now);
  const midnightUtc = Date.parse(`${date}T00:00:00+09:00`);
  return Array.from({ length: 24 }, (_, h) => wbgtAt(f, new Date(midnightUtc + h * 3_600_000 + 30 * 60_000)));
}

/** その日のうち、指定区分以上になる時間帯（分単位、JST）。例：[{ startMin: 660, endMin: 960 }] = 11〜16時 */
export function riskyWindows(f: HeatForecast | null, now: Date, from: HeatLevel = 'severe'): { startMin: number; endMin: number }[] {
  const order: HeatLevel[] = ['safe', 'caution', 'warning', 'severe', 'danger'];
  const min = order.indexOf(from);
  const hours = hourlyForDay(f, now);
  const out: { startMin: number; endMin: number }[] = [];
  hours.forEach((v, h) => {
    const risky = v !== null && order.indexOf(heatLevel(v)) >= min;
    if (!risky) return;
    const last = out[out.length - 1];
    if (last && last.endMin === h * 60) last.endMin = (h + 1) * 60;
    else out.push({ startMin: h * 60, endMin: (h + 1) * 60 });
  });
  return out;
}

/** 当日の最大値と、その時刻 */
export function dailyPeak(f: HeatForecast | null, now: Date): { wbgt: number; hour: number } | null {
  const hours = hourlyForDay(f, now);
  let best: { wbgt: number; hour: number } | null = null;
  hours.forEach((v, hour) => {
    if (v !== null && (!best || v > best.wbgt)) best = { wbgt: v, hour };
  });
  return best;
}

/**
 * 環境省の予測値CSV（地点別）を読む。
 * 1行目：先頭2列は空、3列目以降が対象時刻（YYYYMMDDHH、24時は翌日0時）。
 * 2行目以降：地点番号, 作成時刻, 値（暑さ指数×10）…
 * 形式が想定と違えば null（誤った値を出さない）。
 */
export function parseWbgtForecastCsv(text: string, pointId: string): { issuedAt: string | null; hourly: HeatPoint[] } | null {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return null;
  const head = lines[0].split(',').map((c) => c.trim());
  const row = lines.slice(1).map((l) => l.split(',').map((c) => c.trim())).find((r) => r[0] === pointId);
  if (!row) return null;
  const hourly: HeatPoint[] = [];
  for (let i = 2; i < head.length; i++) {
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})$/.exec(head[i]);
    const raw = row[i];
    if (!m || raw === undefined || raw === '' || !/^-?\d+$/.test(raw)) continue;
    const [, y, mo, d, hh] = m;
    const base = Date.parse(`${y}-${mo}-${d}T00:00:00+09:00`);
    if (Number.isNaN(base) || Number(hh) > 24) continue;
    const v = Number(raw) / 10;
    if (v < 0 || v > 45) continue; // ありえない値は捨てる
    hourly.push({ at: new Date(base + Number(hh) * 3_600_000).toISOString(), wbgt: v });
  }
  if (hourly.length === 0) return null;
  hourly.sort((a, b) => a.at.localeCompare(b.at));
  const issued = parseIssued(row[1]);
  return { issuedAt: issued, hourly };
}

function parseIssued(s: string | undefined): string | null {
  if (!s) return null;
  // 例「2026/07/31 14:25」または「202607311425」
  const a = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(s);
  const b = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s);
  const p = a ?? b;
  if (!p) return null;
  const pad = (x: string) => x.padStart(2, '0');
  const t = Date.parse(`${p[1]}-${pad(p[2])}-${pad(p[3])}T${pad(p[4])}:${p[5]}:00+09:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** デモ用：月と時刻から作る架空の暑さ指数（3時間ごと・3日分）。本番では使わない */
export function demoHeatForecast(now: Date): HeatForecast {
  const { date } = toJst(now);
  const month = Number(date.slice(5, 7));
  const peak = [14, 16, 19, 23, 26, 28, 31, 32, 29, 24, 19, 15][month - 1];
  const midnight = Date.parse(`${date}T00:00:00+09:00`);
  const hourly: HeatPoint[] = [];
  for (let h = 0; h <= 72; h += 3) {
    const hod = h % 24;
    // 14時ごろが最大、5時ごろが最小
    const shape = (Math.cos(((hod - 14) / 24) * 2 * Math.PI) + 1) / 2;
    const v = Math.round((peak - 9 + 9 * shape) * 10) / 10;
    hourly.push({ at: new Date(midnight + h * 3_600_000).toISOString(), wbgt: v });
  }
  return { source: 'demo', pointId: 'demo', pointName: 'デモ観測点', pointDistanceKm: 0, issuedAt: null, hourly };
}
