/**
 * 「涼める場所」を軸にした計算：いますぐ涼みたい・お散歩プラン・涼しさの地図。
 * 距離は直線距離から道のりを見積もる目安（経路検索はしない）。
 */
import { distanceKm, type LatLng } from './geo';
import { heatLevel, wbgtAt, type HeatForecast, type HeatLevel } from './heat';
import { availabilityAt, type Availability } from './hours';
import type { SearchResult } from './search';

/** 犬連れで歩く速さの目安（km/時） */
export const WALK_KMH = 3;
/** 直線距離 → 道のりの目安（1.3倍） */
export const DETOUR = 1.3;

export function walkMinutes(straightKm: number): number {
  return Math.max(1, Math.round(((straightKm * DETOUR) / WALK_KMH) * 60));
}

/** 徒歩 n 分で届く直線距離（km） */
export function reachKm(minutes: number): number {
  return ((minutes / 60) * WALK_KMH) / DETOUR;
}

/** 室内同伴・冷房が確認済みで、うちの犬に「不一致」ではない場所 */
export function isCoolSpot(r: SearchResult): boolean {
  return (
    r.place.publicationStatus === 'published' &&
    r.place.operatingStatus !== 'closed' &&
    r.place.operatingStatus !== 'temporarily_closed' &&
    r.base.status === 'confirmed' &&
    r.fit.result !== 'mismatch'
  );
}

export interface CoolNow {
  /** いま営業時間内で、いちばん近い場所 */
  best: SearchResult | null;
  /** 次に近い営業中の場所（最大2件） */
  alternatives: SearchResult[];
  /** 営業時間が未確認の近い場所（参考・最大2件） */
  unknownHours: SearchResult[];
}

/** いますぐ涼みたい：結果は距離順で渡す */
export function coolNow(results: SearchResult[]): CoolNow {
  const cool = results.filter(isCoolSpot).sort((a, b) => a.distanceKm - b.distanceKm);
  const open = cool.filter((r) => r.availability === 'open');
  return {
    best: open[0] ?? null,
    alternatives: open.slice(1, 3),
    unknownHours: cool.filter((r) => r.availability === 'unknown').slice(0, 2),
  };
}

// ---------------- お散歩プラン ----------------

export interface WalkStop {
  result: SearchResult;
  arriveAt: Date;
  /** 前の地点からの直線距離 */
  legKm: number;
  legMin: number;
  availability: Availability;
  /** 前の地点からここまでの区間の暑さ指数（区間の最大値） */
  legWbgt: number | null;
}

export interface WalkPlan {
  stops: WalkStop[];
  /** 最後の休憩先から出発地点へ戻る区間 */
  back: { legKm: number; legMin: number; arriveAt: Date; legWbgt: number | null };
  totalMin: number;
  warnings: string[];
}

export interface WalkInput {
  origin: LatLng;
  start: Date;
  durationMin: number;
  /** 各休憩先で過ごす時間（分） */
  restMin: number;
  /** 候補（距離順の検索結果） */
  results: SearchResult[];
  forecast: HeatForecast | null;
  maxStops?: number;
}

const ORDER: HeatLevel[] = ['safe', 'caution', 'warning', 'severe', 'danger'];

function legHeat(f: HeatForecast | null, from: Date, to: Date): number | null {
  const a = wbgtAt(f, from);
  const b = wbgtAt(f, to);
  if (a === null && b === null) return null;
  return Math.max(a ?? -Infinity, b ?? -Infinity);
}

/**
 * 出発地点から涼める場所をつないで戻ってくる、休憩つきのお散歩プラン。
 * - 着いたときに営業時間内の場所を優先し、営業時間外と分かっている場所は使わない
 * - 近い順につなぐ（休憩の間隔を短く保つ）
 * - 暑い区間・休憩の間隔が長い区間は注意を出す
 */
export function planWalk(input: WalkInput): WalkPlan {
  const { origin, start, durationMin, restMin, forecast } = input;
  const maxStops = input.maxStops ?? 3;
  const candidates = input.results.filter(isCoolSpot);
  const stops: WalkStop[] = [];
  let here: LatLng = origin;
  let clock = start.getTime();
  let used = 0;

  while (stops.length < maxStops) {
    let pick: { r: SearchResult; km: number; min: number; avail: Availability } | null = null;
    for (const r of candidates) {
      if (stops.some((s) => s.result.place.id === r.place.id)) continue;
      const km = distanceKm(here, r.place);
      const min = walkMinutes(km);
      const backMin = walkMinutes(distanceKm(r.place, origin));
      if (used + min + restMin + backMin > durationMin) continue;
      const avail = availabilityAt(r.place, new Date(clock + min * 60_000));
      if (avail === 'closed') continue;
      const better =
        !pick ||
        (avail === 'open' && pick.avail !== 'open') ||
        (avail === pick.avail && km < pick.km);
      if (better) pick = { r, km, min, avail };
    }
    if (!pick) break;
    const arrive = clock + pick.min * 60_000;
    stops.push({
      result: pick.r,
      arriveAt: new Date(arrive),
      legKm: pick.km,
      legMin: pick.min,
      availability: pick.avail,
      legWbgt: legHeat(forecast, new Date(clock), new Date(arrive)),
    });
    used += pick.min + restMin;
    clock = arrive + restMin * 60_000;
    here = pick.r.place;
  }

  const backKm = distanceKm(here, origin);
  const backMin = stops.length ? walkMinutes(backKm) : 0;
  const backArrive = clock + backMin * 60_000;
  const back = { legKm: backKm, legMin: backMin, arriveAt: new Date(backArrive), legWbgt: stops.length ? legHeat(forecast, new Date(clock), new Date(backArrive)) : null };

  const warnings: string[] = [];
  if (stops.length === 0) warnings.push('この時間・距離で立ち寄れる涼める場所が見つかりませんでした。時間を短くするか、基準点を変えてください');
  const legs = [...stops.map((s) => ({ min: s.legMin, wbgt: s.legWbgt })), ...(stops.length ? [{ min: back.legMin, wbgt: back.legWbgt }] : [])];
  const hottest = legs.reduce<number | null>((m, l) => (l.wbgt !== null && (m === null || l.wbgt > m) ? l.wbgt : m), null);
  if (hottest !== null && ORDER.indexOf(heatLevel(hottest)) >= ORDER.indexOf('severe'))
    warnings.push(`暑さ指数が${hottest}（${heatLevel(hottest) === 'danger' ? '危険' : '厳重警戒'}）になる区間があります。時間をずらすことを検討してください`);
  if (legs.some((l) => l.min > 20 && l.wbgt !== null && heatLevel(l.wbgt) !== 'safe'))
    warnings.push('休憩の間隔が20分を超える区間があります。水をこまめに飲ませてください');
  if (stops.some((s) => s.availability === 'unknown'))
    warnings.push('営業時間が未確認の場所が含まれます。行く前にお店へ確認してください');

  return { stops, back, totalMin: Math.round((backArrive - start.getTime()) / 60_000), warnings };
}

// ---------------- 涼しさの地図 ----------------

export interface CoverageCircle extends LatLng {
  id: string;
  radiusKm: number;
  open: boolean;
}

/** 涼める場所ごとの「徒歩 minutes 分圏」 */
export function coverageCircles(results: SearchResult[], minutes = 10): CoverageCircle[] {
  const r = reachKm(minutes);
  return results.filter(isCoolSpot).map((x) => ({ id: x.place.id, lat: x.place.lat, lng: x.place.lng, radiusKm: r, open: x.availability === 'open' }));
}

/**
 * 基準点から半径 radiusKm の範囲のうち、徒歩 minutes 分以内に涼める場所がある割合（0〜1）。
 * 範囲を格子状に区切って数える目安。
 */
export function coverageRatio(origin: LatLng, results: SearchResult[], radiusKm: number, minutes = 10, steps = 24): number {
  const spots = results.filter(isCoolSpot).map((r) => r.place);
  const reach = reachKm(minutes);
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((origin.lat * Math.PI) / 180));
  let inside = 0;
  let covered = 0;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const p = { lat: origin.lat - dLat + (2 * dLat * i) / steps, lng: origin.lng - dLng + (2 * dLng * j) / steps };
      if (distanceKm(origin, p) > radiusKm) continue;
      inside++;
      if (spots.some((s) => distanceKm(p, s) <= reach)) covered++;
    }
  }
  return inside ? covered / inside : 0;
}
