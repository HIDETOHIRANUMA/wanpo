import type {
  DogHours,
  DogZone,
  ExtraRequirement,
  HourException,
  Period,
  Place,
  PlaceMedia,
  Schedule,
  Tri,
  WeightLimit,
  Weekday,
} from '@/domain/types';
import { CARRY_METHODS } from '@/domain/types';
import type { Review, ReviewTag, UgcStatus } from '@/domain/ugc';
import { REVIEW_TAGS } from '@/domain/ugc';
import { validateHttpsUrl } from '@/domain/contact';
import type { HourExceptionRow, HourRow, MediaRow, PlaceRow, ReviewRow, ZoneRow } from './dbTypes';

/** 想定外の値・null は必ず unknown へ（肯定へ倒さない） */
const tri = (v: unknown): Tri => (v === 'yes' || v === 'no' ? v : 'unknown');

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(v) ? (v as T) : fallback;
}

function mapWeight(z: ZoneRow): WeightLimit {
  switch (z.weight_limit_kind) {
    case 'none':
      return { kind: 'none' };
    case 'max_kg': {
      const kg = Number(z.weight_max_kg);
      if (!Number.isFinite(kg) || kg <= 0 || typeof z.weight_max_inclusive !== 'boolean') return { kind: 'unknown' };
      return { kind: 'max_kg', maxKg: kg, inclusive: z.weight_max_inclusive, text: z.weight_limit_text ?? undefined };
    }
    case 'text_only':
      return z.weight_limit_text ? { kind: 'text_only', text: z.weight_limit_text } : { kind: 'unknown' };
    default:
      return { kind: 'unknown' };
  }
}

function mapExtra(v: unknown): ExtraRequirement[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is { text: string; effect?: string } => !!x && typeof x.text === 'string' && x.text.trim() !== '')
    // effect が不明なら判定に影響するもの（要確認）として扱う
    .map((x) => ({ text: x.text, effect: x.effect === 'info' ? 'info' : 'needs_check' }));
}

export function mapZone(z: ZoneRow | undefined): DogZone {
  if (!z) {
    return {
      id: 'missing',
      name: '犬同伴区画は未登録',
      scope: 'unknown',
      indoorDogs: 'unknown',
      airConditioning: 'unknown',
      weightLimit: { kind: 'unknown' },
      carry: { status: 'unknown' },
      certificate: { status: 'unknown' },
      extraRequirements: [],
    };
  }
  const methods = (z.carry_methods ?? []).filter((m) => CARRY_METHODS.includes(m));
  return {
    id: z.id,
    name: z.name,
    scope: oneOf(z.scope, ['indoor_whole', 'indoor_partial', 'private_room', 'terrace', 'other', 'unknown'] as const, 'unknown'),
    indoorDogs: tri(z.indoor_dogs),
    airConditioning: tri(z.air_conditioning),
    weightLimit: mapWeight(z),
    carry:
      z.carry_status === 'confirmed' && methods.length > 0
        ? { status: 'confirmed', allowed: methods, text: z.carry_text ?? undefined }
        : { status: 'unknown', text: z.carry_text ?? undefined },
    certificate:
      z.certificate === 'not_required'
        ? { status: 'not_required' }
        : z.certificate === 'required'
          ? { status: 'required', text: z.certificate_text ?? undefined }
          : { status: 'unknown' },
    extraRequirements: mapExtra(z.extra_requirements),
  };
}

function weekly(rows: HourRow[], status: 'confirmed' | 'unknown'): Schedule['weekly'] {
  if (status !== 'confirmed') return { status: 'unknown', byWeekday: {} };
  const byWeekday: Partial<Record<Weekday, Period[]>> = {};
  // 確認済みの場合、行のない曜日は定休（空配列）
  ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).forEach((d) => (byWeekday[d] = []));
  for (const r of rows) {
    if (r.weekday < 0 || r.weekday > 6) continue;
    byWeekday[r.weekday as Weekday]!.push({ openMin: r.open_minute, closeMin: r.close_minute });
  }
  Object.values(byWeekday).forEach((ps) => ps!.sort((a, b) => a.openMin - b.openMin));
  return { status: 'confirmed', byWeekday };
}

function exceptions(rows: HourExceptionRow[]): HourException[] {
  const byDate = new Map<string, HourException>();
  for (const r of rows) {
    const e = byDate.get(r.date) ?? { date: r.date, closed: false, periods: [], note: r.note ?? undefined };
    if (r.is_closed) e.closed = true;
    else if (r.open_minute !== null && r.close_minute !== null)
      e.periods.push({ openMin: r.open_minute, closeMin: r.close_minute });
    if (r.note && !e.note) e.note = r.note;
    byDate.set(r.date, e);
  }
  return [...byDate.values()];
}

export function mapPlace(row: PlaceRow): Place {
  const hours = row.place_hours ?? [];
  const ex = row.place_hour_exceptions ?? [];
  const businessHours: Schedule = {
    weekly: weekly(hours.filter((h) => h.schedule === 'business'), row.business_hours_status),
    exceptions: exceptions(ex.filter((e) => e.schedule === 'business')),
  };
  let dogHours: DogHours;
  if (row.dog_hours_mode === 'same_as_business') dogHours = { mode: 'same_as_business' };
  else if (row.dog_hours_mode === 'custom')
    dogHours = {
      mode: 'custom',
      schedule: {
        weekly: weekly(hours.filter((h) => h.schedule === 'dog'), 'confirmed'),
        exceptions: exceptions(ex.filter((e) => e.schedule === 'dog')),
      },
    };
  else dogHours = { mode: 'unknown' };

  return {
    id: row.id,
    name: row.name,
    category: oneOf(row.category, ['cafe', 'restaurant', 'commercial', 'other_rest'] as const, 'other_rest'),
    address: row.address,
    areaId: row.area_id,
    lat: row.lat,
    lng: row.lng,
    timezone: 'Asia/Tokyo',
    publicationStatus: oneOf(row.publication_status, ['draft', 'published', 'archived'] as const, 'draft'),
    operatingStatus: oneOf(row.operating_status, ['normal', 'temporarily_closed', 'closed', 'unknown'] as const, 'unknown'),
    zone: mapZone(row.place_dog_zones?.[0]),
    usage: {
      eligibility: oneOf(row.eligibility, ['open', 'guests_only', 'members_only', 'other_restricted', 'unknown'] as const, 'unknown'),
      eligibilityText: row.eligibility_text ?? undefined,
      orderRequired: tri(row.order_required),
      orderText: row.order_text ?? undefined,
      reservationRequired: tri(row.reservation_required),
      reservationText: row.reservation_text ?? undefined,
      fee: oneOf(row.fee_status, ['free', 'paid', 'unknown'] as const, 'unknown'),
      feeText: row.fee_text ?? undefined,
      water: tri(row.water),
    },
    businessHours,
    dogHours,
    verifications: (row.place_verifications ?? []).map((v) => ({
      id: v.id,
      field: v.field,
      method: v.method,
      verifiedAt: v.verified_at,
      evidenceUrl: v.evidence_url ?? undefined,
      evidenceNote: v.evidence_note ?? undefined,
    })),
    phone: row.phone ?? undefined,
    officialUrl: row.official_url ?? undefined,
    reservationUrl: validateHttpsUrl(row.reservation_url) ?? undefined,
    atmosphereTags: (row.atmosphere_tags ?? []).filter((t) => typeof t === 'string' && t.trim() !== '').slice(0, 6),
    media: mapMedia(row),
    areaName: row.areas?.name ?? undefined,
    description: row.description ?? undefined,
    isDemo: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 権利・出典が揃っている https の写真だけ表示する。旧来の photo_url は先頭の外観写真として扱う */
export function mapMedia(row: Pick<PlaceRow, 'photo_url' | 'photo_rights' | 'photo_credit' | 'place_media'>): PlaceMedia[] {
  const out: PlaceMedia[] = [];
  if (row.photo_url && row.photo_rights && row.photo_credit && validateHttpsUrl(row.photo_url))
    out.push({ id: 'main', url: row.photo_url, kind: 'exterior', rights: row.photo_rights, credit: row.photo_credit });
  const media = [...(row.place_media ?? [])].sort((a: MediaRow, b: MediaRow) => a.sort - b.sort);
  for (const m of media) {
    if (!m.rights || !m.credit || !validateHttpsUrl(m.url)) continue;
    out.push({
      id: m.id,
      url: m.url,
      kind: oneOf(m.kind, ['exterior', 'interior', 'atmosphere', 'dog_area'] as const, 'atmosphere'),
      caption: m.caption ?? undefined,
      rights: m.rights,
      credit: m.credit,
    });
  }
  return out;
}

const UGC_STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const;

export function mapReview(r: ReviewRow, mine: boolean): Review {
  return {
    id: r.id,
    placeId: r.place_id,
    nickname: r.nickname,
    body: r.body,
    tags: (r.tags ?? []).filter((t): t is ReviewTag => (REVIEW_TAGS as string[]).includes(t)),
    visitedOn: r.visited_on,
    publishedAt: r.published_at,
    mine,
    // 状態が取れない（未ログインの公開一覧）なら公開中のものだけが返っている
    status: r.status ? oneOf<UgcStatus>(r.status, UGC_STATUSES, 'pending') : 'approved',
  };
}
