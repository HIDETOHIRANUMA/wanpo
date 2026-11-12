import { distanceKm, type LatLng } from './geo';
import { availabilityAt, type Availability } from './hours';
import { judgeBase, judgeDogFit, type BaseJudgement, type FitJudgement } from './judge';
import type { DogProfile, Place } from './types';
import { DEFAULT_SETTINGS, keyFreshness, type AppSettings, type Freshness } from './verification';

export type RadiusKm = 1 | 3 | 5 | 10;
export const RADIUS_OPTIONS: RadiusKm[] = [1, 3, 5, 10];

export interface SearchFilters {
  radiusKm: RadiusKm;
  /** うちの犬の条件に合う（一致のみ） */
  matchMyDog: boolean;
  /** 室内同伴・冷房の基本情報が未確認の候補も含める */
  includeBaseUnconfirmed: boolean;
  /** 犬の条件が要確認の候補も含める（matchMyDog が ON のときだけ有効） */
  includeDogNeedsCheck: boolean;
  noReservation: boolean;
  noOrderRequired: boolean;
  hasWater: boolean;
  openNow: boolean;
  recentlyVerified: boolean;
}

export const DEFAULT_FILTERS: SearchFilters = {
  radiusKm: 10,
  matchMyDog: false,
  includeBaseUnconfirmed: false,
  includeDogNeedsCheck: false,
  noReservation: false,
  noOrderRequired: false,
  hasWater: false,
  openNow: false,
  recentlyVerified: false,
};

export type OriginKind = 'area' | 'station' | 'current_location' | 'map_center';

/** 検索の基準点。地図を動かしただけでは変えない（「この範囲で検索」で明示的に変更） */
export interface SearchOrigin extends LatLng {
  kind: OriginKind;
  label: string; // 例「品川駅」「現在地」「地図の中心」
  /** エリア指定の場合、そのエリアに限定する */
  areaId?: string;
}

export interface SearchResult {
  place: Place;
  distanceKm: number;
  base: BaseJudgement;
  fit: FitJudgement;
  availability: Availability;
  freshness: Freshness;
}

export interface SearchInput {
  places: Place[];
  origin: SearchOrigin;
  filters: SearchFilters;
  query: string;
  profile: DogProfile | null;
  now: Date;
  settings?: AppSettings;
  /** エリア名検索に使う（id → 名前） */
  areaNames?: Record<string, string>;
}

function normalize(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

export function matchesQuery(place: Place, query: string, areaNames: Record<string, string> = {}): boolean {
  const q = normalize(query);
  if (!q) return true;
  const hay = [place.name, place.address, areaNames[place.areaId] ?? ''].map(normalize);
  return hay.some((h) => h.includes(q));
}

export function evaluate(place: Place, input: Omit<SearchInput, 'places'>): SearchResult {
  return {
    place,
    distanceKm: distanceKm(input.origin, place),
    base: judgeBase(place),
    fit: judgeDogFit(place, input.profile),
    availability: availabilityAt(place, input.now),
    freshness: keyFreshness(place.verifications, input.now, input.settings ?? DEFAULT_SETTINGS),
  };
}

/** 絞り込みを通過するか。すべて AND で組み合わせる */
export function passesFilters(r: SearchResult, f: SearchFilters): boolean {
  const p = r.place;
  if (p.publicationStatus !== 'published') return false;
  if (p.operatingStatus === 'closed') return false;
  if (r.distanceKm > f.radiusKm) return false;

  // 基本情報：判明した不可は常に除外。未確認は明示的に含めた場合のみ
  if (r.base.status === 'excluded') return false;
  if (r.base.status === 'unconfirmed' && !f.includeBaseUnconfirmed) return false;

  // 犬の条件：ONのときは一致のみ。要確認スイッチで要確認を追加。不一致は追加しない
  if (f.matchMyDog) {
    if (r.fit.result === 'mismatch') return false;
    if (r.fit.result === 'needs_check' && !f.includeDogNeedsCheck) return false;
  }

  if (f.noReservation && p.usage.reservationRequired !== 'no') return false;
  if (f.noOrderRequired && p.usage.orderRequired !== 'no') return false;
  if (f.hasWater && p.usage.water !== 'yes') return false;
  if (f.openNow && r.availability !== 'open') return false;
  if (f.recentlyVerified && r.freshness.status !== 'fresh') return false;
  return true;
}

/**
 * 地図と一覧が共有する唯一の検索関数。同じ入力から同じ施設集合を距離順で返す。
 * 0件でも条件を自動で緩めない。
 */
export function searchPlaces(input: SearchInput): SearchResult[] {
  const { places, origin, filters, query, areaNames } = input;
  return places
    .filter((p) => (origin.areaId ? p.areaId === origin.areaId : true))
    .filter((p) => matchesQuery(p, query, areaNames))
    .map((p) => evaluate(p, input))
    .filter((r) => passesFilters(r, filters))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.place.id.localeCompare(b.place.id));
}

/** 0件時に「どの条件を外すか」を利用者に選んでもらうための、現在ONの条件一覧 */
export type FilterKey = keyof SearchFilters | 'query' | 'area';

export function activeRestrictions(filters: SearchFilters, query: string, origin: SearchOrigin): FilterKey[] {
  const keys: FilterKey[] = [];
  if (query.trim()) keys.push('query');
  if (origin.areaId) keys.push('area');
  if (filters.radiusKm < 10) keys.push('radiusKm');
  if (!filters.includeBaseUnconfirmed) keys.push('includeBaseUnconfirmed');
  if (filters.matchMyDog) keys.push('matchMyDog');
  if (filters.matchMyDog && !filters.includeDogNeedsCheck) keys.push('includeDogNeedsCheck');
  (['noReservation', 'noOrderRequired', 'hasWater', 'openNow', 'recentlyVerified'] as const).forEach((k) => {
    if (filters[k]) keys.push(k);
  });
  return keys;
}

export const FILTER_LABEL: Record<FilterKey, string> = {
  radiusKm: '距離',
  matchMyDog: 'うちの犬の条件に合う',
  includeBaseUnconfirmed: '室内同伴・冷房が未確認の候補も含める',
  includeDogNeedsCheck: '犬の条件が要確認の候補も含める',
  noReservation: '予約なしで利用可能',
  noOrderRequired: '飲食注文が不要',
  hasWater: '犬用の水がある',
  openNow: '営業時間上、現在利用可能',
  recentlyVerified: '主要条件が最近確認されている',
  query: 'キーワード',
  area: 'エリアの限定',
};

/** 地図マーカーは一覧と同じ結果配列から作る */
export function toMapMarkers(results: SearchResult[]): { id: string; lat: number; lng: number; title: string }[] {
  return results.map((r) => ({ id: r.place.id, lat: r.place.lat, lng: r.place.lng, title: r.place.name }));
}
