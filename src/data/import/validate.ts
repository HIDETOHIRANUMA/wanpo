/**
 * 実データ投入用の検証（純粋関数）。scripts/import-places.ts から使う。
 * 必須値・enum・座標範囲・URL・時間帯を検証し、エラー行を報告する。不明は 'unknown' のまま残す。
 */
import { normalizePhone, validateHttpsUrl } from '@/domain/contact';
import { isValidJapanCoord } from '@/domain/geo';
import { parseHHMM } from '@/domain/hours';

export const ENUMS = {
  category: ['cafe', 'restaurant', 'commercial', 'other_rest'],
  publication_status: ['draft', 'published', 'archived'],
  operating_status: ['normal', 'temporarily_closed', 'closed', 'unknown'],
  scope: ['indoor_whole', 'indoor_partial', 'private_room', 'terrace', 'other', 'unknown'],
  tri: ['yes', 'no', 'unknown'],
  weight_limit_kind: ['none', 'max_kg', 'text_only', 'unknown'],
  confirm_status: ['confirmed', 'unknown'],
  carry_method: ['leash_floor', 'cart', 'bag', 'held'],
  certificate: ['not_required', 'required', 'unknown'],
  eligibility: ['open', 'guests_only', 'members_only', 'other_restricted', 'unknown'],
  fee_status: ['free', 'paid', 'unknown'],
  dog_hours_mode: ['same_as_business', 'custom', 'unknown'],
  verification_field: ['indoor_dogs', 'air_conditioning', 'dog_conditions', 'usage_conditions', 'hours'],
  verification_method: ['official_info', 'phone', 'onsite', 'other'],
  schedule: ['business', 'dog'],
  media_kind: ['exterior', 'interior', 'atmosphere', 'dog_area'],
} as const;

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export interface ImportError {
  ref: string;
  field: string;
  message: string;
}

export interface NormalizedHour {
  schedule: 'business' | 'dog';
  weekday: number;
  open_minute: number;
  close_minute: number;
}

export interface NormalizedException {
  schedule: 'business' | 'dog';
  date: string;
  is_closed: boolean;
  open_minute: number | null;
  close_minute: number | null;
  note: string | null;
}

export interface NormalizedVerification {
  field: string;
  method: string;
  verified_at: string;
  evidence_url: string | null;
  evidence_note: string | null;
}

export interface NormalizedPlace {
  ref: string;
  id: string | null;
  place: Record<string, string | number | null>;
  zone: Record<string, string | number | boolean | null | string[]>;
  extra_requirements: { text: string; effect: 'needs_check' | 'info' }[];
  hours: NormalizedHour[];
  exceptions: NormalizedException[];
  verifications: NormalizedVerification[];
  atmosphere_tags: string[];
  media: NormalizedMedia[];
}

export interface NormalizedMedia {
  url: string;
  kind: string;
  caption: string | null;
  rights: string;
  credit: string;
  sort: number;
}

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : typeof v === 'number' ? String(v) : null);

export function parsePeriod(s: string): { open: number; close: number } | null {
  const m = /^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/.exec(s);
  if (!m) return null;
  const open = parseHHMM(m[1]);
  const close = parseHHMM(m[2]);
  if (open === null || close === null) return null;
  if (open >= 1440 || close <= open || close > open + 1440) return null;
  return { open, close };
}

export function validatePlace(raw: Raw, index: number, knownAreas: string[], now = new Date()): { value: NormalizedPlace | null; errors: ImportError[] } {
  const ref = str(raw.ref) ?? `#${index + 1}`;
  const errors: ImportError[] = [];
  const err = (field: string, message: string) => errors.push({ ref, field, message });

  const req = (field: string, max = 200): string | null => {
    const v = str(raw[field]);
    if (!v) err(field, '必須です');
    else if (v.length > max) err(field, `${max}文字以内にしてください`);
    return v;
  };
  const opt = (obj: Raw, field: string, max = 200, prefix = ''): string | null => {
    const v = str(obj[field]);
    if (v && v.length > max) err(prefix + field, `${max}文字以内にしてください`);
    return v;
  };
  const en = <T extends readonly string[]>(obj: Raw, field: string, allowed: T, fallback: T[number] | null, prefix = ''): T[number] | null => {
    const v = str(obj[field]);
    if (v === null) {
      if (fallback === null) err(prefix + field, '必須です');
      return fallback;
    }
    if (!(allowed as readonly string[]).includes(v)) {
      err(prefix + field, `「${v}」は使えません（${allowed.join(' / ')}）`);
      return null;
    }
    return v as T[number];
  };

  const id = str(raw.id);
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) err('id', 'UUID形式ではありません');

  const name = req('name', 120);
  const address = req('address', 200);
  const category = en(raw, 'category', ENUMS.category, null);
  const area_id = req('area_id', 40);
  if (area_id && knownAreas.length && !knownAreas.includes(area_id)) err('area_id', `未登録のエリアです（${knownAreas.join(', ')}）`);
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!isValidJapanCoord(lat, lng)) err('lat/lng', '日本国内の緯度経度（数値）を入力してください');
  const publication_status = en(raw, 'publication_status', ENUMS.publication_status, 'draft');
  const operating_status = en(raw, 'operating_status', ENUMS.operating_status, 'unknown');
  if (name && /^デモ[・･]/.test(name) && publication_status === 'published') err('name', 'デモ施設を本番に公開しようとしています');

  const phoneRaw = str(raw.phone);
  if (phoneRaw && !normalizePhone(phoneRaw)) err('phone', '電話番号の形式が正しくありません');
  const officialRaw = str(raw.official_url);
  if (officialRaw && !validateHttpsUrl(officialRaw)) err('official_url', 'https:// で始まる正しいURLにしてください');
  const photoRaw = str(raw.photo_url);
  if (photoRaw && !validateHttpsUrl(photoRaw)) err('photo_url', 'https:// で始まる正しいURLにしてください');
  const photo_rights = opt(raw, 'photo_rights');
  const photo_credit = opt(raw, 'photo_credit');
  if (photoRaw && (!photo_rights || !photo_credit)) err('photo_url', '写真には photo_rights（権利）と photo_credit（出典）が必要です');

  const reservationRaw = str(raw.reservation_url);
  if (reservationRaw && !validateHttpsUrl(reservationRaw)) err('reservation_url', 'https:// で始まる正しいURLにしてください');

  // 雰囲気タグ：JSON は配列、CSV は「|」区切り
  const tagsRaw = Array.isArray(raw.atmosphere_tags)
    ? raw.atmosphere_tags
    : typeof raw.atmosphere_tags === 'string'
      ? raw.atmosphere_tags.split('|')
      : [];
  const atmosphere_tags = tagsRaw.map((t) => str(t)).filter((t): t is string => !!t);
  if (atmosphere_tags.length > 6) err('atmosphere_tags', '雰囲気タグは6個までにしてください');
  if (atmosphere_tags.some((t) => t.length > 20)) err('atmosphere_tags', '雰囲気タグは1つ20文字以内にしてください');

  // 店舗写真：権利（掲載許諾など）と出典が必須。他サービスの写真の転載は不可
  let mediaRaw: unknown = raw.media;
  if (typeof mediaRaw === 'string') {
    try {
      mediaRaw = JSON.parse(mediaRaw);
    } catch {
      err('media', 'JSON の配列で入力してください');
      mediaRaw = [];
    }
  }
  const media: NormalizedMedia[] = [];
  if (mediaRaw !== undefined && mediaRaw !== null && !Array.isArray(mediaRaw)) err('media', '配列で入力してください');
  (Array.isArray(mediaRaw) ? mediaRaw : []).forEach((m: unknown, i: number) => {
    const o = (m && typeof m === 'object' ? m : {}) as Raw;
    const mp = `media[${i}].`;
    const url = str(o.url);
    if (!url || !validateHttpsUrl(url)) err(mp + 'url', 'https:// で始まる画像のURLを入力してください');
    const kind = en(o, 'kind', ENUMS.media_kind, null, mp);
    if (!kind) err(mp + 'kind', `種類は ${ENUMS.media_kind.join(' / ')} のいずれかです`);
    const rights = opt(o, 'rights', 200, mp);
    const credit = opt(o, 'credit', 200, mp);
    if (!rights || !credit) err(mp + 'rights', '写真には rights（掲載許諾など権利の根拠）と credit（出典）が必要です');
    const caption = opt(o, 'caption', 100, mp);
    if (url && kind && rights && credit) media.push({ url, kind, caption, rights, credit, sort: i });
  });
  if (media.length > 10) err('media', '店舗写真は10枚までにしてください');

  // 区画
  const zoneRaw = (raw.zone && typeof raw.zone === 'object' ? raw.zone : {}) as Raw;
  const zp = 'zone.';
  const zoneName = str(zoneRaw.name);
  if (!zoneName) err('zone.name', '必須です');
  const scope = en(zoneRaw, 'scope', ENUMS.scope, 'unknown', zp);
  const indoor = en(zoneRaw, 'indoor_dogs', ENUMS.tri, 'unknown', zp);
  const air = en(zoneRaw, 'air_conditioning', ENUMS.tri, 'unknown', zp);
  if (scope === 'terrace' && indoor !== 'no') err('zone.indoor_dogs', 'テラス区画は indoor_dogs を no にしてください');
  const wk = en(zoneRaw, 'weight_limit_kind', ENUMS.weight_limit_kind, 'unknown', zp);
  let maxKg: number | null = null;
  let inclusive: boolean | null = null;
  if (wk === 'max_kg') {
    maxKg = Number(zoneRaw.weight_max_kg);
    if (!Number.isFinite(maxKg) || maxKg <= 0 || maxKg >= 200) err('zone.weight_max_kg', '0より大きい数値が必要です');
    const inc = zoneRaw.weight_max_inclusive;
    inclusive = inc === true || inc === 'true' ? true : inc === false || inc === 'false' ? false : null;
    if (inclusive === null) err('zone.weight_max_inclusive', '上限ちょうどを含むか（true=以下 / false=未満）が必要です');
  }
  const weightText = opt(zoneRaw, 'weight_limit_text', 200, zp);
  if (wk === 'text_only' && !weightText) err('zone.weight_limit_text', '文章条件の原文が必要です');
  const carryStatus = en(zoneRaw, 'carry_status', ENUMS.confirm_status, 'unknown', zp);
  const methodsRaw = Array.isArray(zoneRaw.carry_methods) ? zoneRaw.carry_methods : str(zoneRaw.carry_methods)?.split('|') ?? [];
  const methods: string[] = [];
  for (const m of methodsRaw.map((x) => String(x).trim()).filter(Boolean)) {
    if ((ENUMS.carry_method as readonly string[]).includes(m)) methods.push(m);
    else err('zone.carry_methods', `「${m}」は使えません（${ENUMS.carry_method.join(' / ')}）`);
  }
  if (carryStatus === 'confirmed' && methods.length === 0) err('zone.carry_methods', '確認済みの場合は1つ以上必要です');
  const certificate = en(zoneRaw, 'certificate', ENUMS.certificate, 'unknown', zp);
  const extraRaw = Array.isArray(zoneRaw.extra_requirements)
    ? zoneRaw.extra_requirements
    : (str(zoneRaw.extra_requirements)?.split('|') ?? []).map((s) => {
        const [text, effect] = s.split('::');
        return { text, effect };
      });
  const extra_requirements: NormalizedPlace['extra_requirements'] = [];
  for (const x of extraRaw as Raw[]) {
    const text = str(x?.text);
    if (!text) continue;
    const effect = str(x.effect) ?? 'needs_check';
    if (effect !== 'needs_check' && effect !== 'info') err('zone.extra_requirements', `effect は needs_check / info です`);
    extra_requirements.push({ text, effect: effect === 'info' ? 'info' : 'needs_check' });
  }

  // 時間
  const bhs = en(raw, 'business_hours_status', ENUMS.confirm_status, 'unknown');
  const dhm = en(raw, 'dog_hours_mode', ENUMS.dog_hours_mode, 'unknown');
  const hours: NormalizedHour[] = [];
  const readWeek = (obj: unknown, schedule: 'business' | 'dog', field: string) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj as Raw)) {
      const wd = (WEEKDAY_KEYS as readonly string[]).indexOf(k);
      if (wd < 0) {
        err(field, `曜日キー「${k}」は使えません（${WEEKDAY_KEYS.join(',')}）`);
        continue;
      }
      const list = Array.isArray(v) ? v : str(v)?.split('|') ?? [];
      for (const s of list) {
        if (String(s).trim() === 'closed') continue;
        const p = parsePeriod(String(s));
        if (!p) err(`${field}.${k}`, `「${s}」は「11:00-14:00」形式（翌日は「18:00-26:00」）にしてください`);
        else hours.push({ schedule, weekday: wd, open_minute: p.open, close_minute: p.close });
      }
    }
  };
  readWeek(raw.business_hours, 'business', 'business_hours');
  if (dhm === 'custom') readWeek(raw.dog_hours, 'dog', 'dog_hours');
  if (bhs === 'confirmed' && !hours.some((h) => h.schedule === 'business'))
    err('business_hours', '確認済みの場合は営業時間が必要です（休みの曜日は "closed"）');

  const exceptions: NormalizedException[] = [];
  for (const e of (Array.isArray(raw.exceptions) ? raw.exceptions : []) as Raw[]) {
    const date = str(e.date);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      err('exceptions.date', 'YYYY-MM-DD 形式が必要です');
      continue;
    }
    const schedule = (str(e.schedule) ?? 'business') as 'business' | 'dog';
    if (schedule !== 'business' && schedule !== 'dog') err('exceptions.schedule', 'business / dog です');
    if (e.closed === true || e.closed === 'true') exceptions.push({ schedule, date, is_closed: true, open_minute: null, close_minute: null, note: str(e.note) });
    else
      for (const s of (Array.isArray(e.periods) ? e.periods : []) as string[]) {
        const p = parsePeriod(String(s));
        if (!p) err('exceptions.periods', `「${s}」の形式が正しくありません`);
        else exceptions.push({ schedule, date, is_closed: false, open_minute: p.open, close_minute: p.close, note: str(e.note) });
      }
  }

  // 確認記録：公開できる根拠（URLまたは短い説明）が必須
  const verifications: NormalizedVerification[] = [];
  for (const v of (Array.isArray(raw.verifications) ? raw.verifications : []) as Raw[]) {
    const field = en(v, 'field', ENUMS.verification_field, null, 'verifications.');
    const method = en(v, 'method', ENUMS.verification_method, null, 'verifications.');
    const at = str(v.verified_at);
    const t = at ? Date.parse(at) : NaN;
    if (!at || Number.isNaN(t)) err('verifications.verified_at', '日時（例 2026-07-01 または ISO 形式）が必要です');
    else if (t > now.getTime() + 86_400_000) err('verifications.verified_at', '未来の日時です');
    const url = str(v.evidence_url);
    if (url && !validateHttpsUrl(url)) err('verifications.evidence_url', 'https:// のURLにしてください');
    const note = str(v.evidence_note);
    if (note && note.length > 300) err('verifications.evidence_note', '300文字以内にしてください');
    if (!url && !note) err('verifications', `${field ?? ''} の確認記録に公開できる根拠（evidence_url か evidence_note）がありません`);
    if (field && method && at && !Number.isNaN(t))
      verifications.push({ field, method, verified_at: new Date(t).toISOString(), evidence_url: url, evidence_note: note });
  }

  if (errors.length) return { value: null, errors };
  return {
    errors,
    value: {
      ref,
      id,
      place: {
        name,
        category,
        address,
        area_id,
        lat,
        lng,
        publication_status,
        operating_status,
        eligibility: en(raw, 'eligibility', ENUMS.eligibility, 'unknown'),
        eligibility_text: opt(raw, 'eligibility_text'),
        order_required: en(raw, 'order_required', ENUMS.tri, 'unknown'),
        order_text: opt(raw, 'order_text'),
        reservation_required: en(raw, 'reservation_required', ENUMS.tri, 'unknown'),
        reservation_text: opt(raw, 'reservation_text'),
        fee_status: en(raw, 'fee_status', ENUMS.fee_status, 'unknown'),
        fee_text: opt(raw, 'fee_text'),
        water: en(raw, 'water', ENUMS.tri, 'unknown'),
        business_hours_status: bhs,
        dog_hours_mode: dhm,
        phone: phoneRaw,
        official_url: officialRaw,
        photo_url: photoRaw,
        photo_rights,
        photo_credit,
        description: opt(raw, 'description', 1000),
        reservation_url: reservationRaw,
      },
      zone: {
        name: zoneName,
        scope,
        indoor_dogs: indoor,
        air_conditioning: air,
        weight_limit_kind: wk,
        weight_max_kg: maxKg,
        weight_max_inclusive: inclusive,
        weight_limit_text: weightText,
        carry_status: carryStatus,
        carry_methods: methods,
        carry_text: opt(zoneRaw, 'carry_text', 200, zp),
        certificate,
        certificate_text: opt(zoneRaw, 'certificate_text', 200, zp),
      },
      extra_requirements,
      hours,
      exceptions,
      verifications,
      atmosphere_tags,
      media,
    },
  };
}

/** CSV の1行（フラットな列）を JSON 形式に変換する。列の説明は templates/places.template.csv を参照 */
export function csvRowToRaw(row: Record<string, string>): Raw {
  const zone: Raw = {};
  const raw: Raw = { zone };
  const business: Raw = {};
  const dog: Raw = {};
  const verifications: Raw[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined || v === '') continue;
    if (k.startsWith('zone_')) zone[k.slice(5)] = v;
    else if (k.startsWith('hours_')) business[k.slice(6)] = v;
    else if (k.startsWith('dog_hours_') && k !== 'dog_hours_mode') dog[k.slice(10)] = v;
    else if (k === 'exceptions') raw.exceptions = JSON.parse(v);
    else raw[k] = v;
  }
  for (const f of ENUMS.verification_field) {
    if (!row[`verified_${f}_at`]) continue;
    verifications.push({
      field: f,
      method: row[`verified_${f}_method`],
      verified_at: row[`verified_${f}_at`],
      evidence_url: row[`verified_${f}_url`],
      evidence_note: row[`verified_${f}_note`],
    });
    for (const s of ['at', 'method', 'url', 'note']) delete raw[`verified_${f}_${s}`];
  }
  raw.business_hours = business;
  raw.dog_hours = dog;
  raw.verifications = verifications;
  return raw;
}

/** RFC 4180 程度の簡易CSVパーサ（ダブルクォート・改行入りセルに対応） */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      cur.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      cur.push(cell);
      rows.push(cur);
      cur = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || cur.length) {
    cur.push(cell);
    rows.push(cur);
  }
  const [header, ...body] = rows.filter((r) => r.some((x) => x.trim() !== ''));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};

const textArray = (xs: string[]): string => `array[${xs.map(lit).join(', ')}]::text[]`;

/** 検証済みデータから、1トランザクションの upsert SQL を生成する（Supabase Studio の SQL Editor で実行可） */
export function toSql(rows: NormalizedPlace[], newId: () => string): string {
  const out: string[] = ['begin;'];
  for (const r of rows) {
    const id = r.id ?? newId();
    const cols = Object.keys(r.place);
    out.push(`-- ${r.ref}: ${r.place.name}`);
    out.push(
      `insert into public.places (id, ${cols.join(', ')}, atmosphere_tags) values (${lit(id)}, ${cols.map((c) => lit(r.place[c])).join(', ')}, ${textArray(r.atmosphere_tags)})\n` +
        `  on conflict (id) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}, atmosphere_tags = excluded.atmosphere_tags;`,
    );
    out.push(`delete from public.place_media where place_id = ${lit(id)};`);
    for (const m of r.media)
      out.push(
        `insert into public.place_media (place_id, url, kind, caption, rights, credit, sort) values (${lit(id)}, ${lit(m.url)}, ${lit(m.kind)}, ${lit(m.caption)}, ${lit(m.rights)}, ${lit(m.credit)}, ${m.sort});`,
      );
    const z = r.zone;
    const zcols = Object.keys(z);
    const zvals = zcols.map((c) =>
      c === 'carry_methods' ? `array[${(z[c] as string[]).map(lit).join(', ')}]::public.carry_method[]` : lit(z[c]),
    );
    out.push(
      `insert into public.place_dog_zones (place_id, ${zcols.join(', ')}, extra_requirements) values (${lit(id)}, ${zvals.join(', ')}, ${lit(JSON.stringify(r.extra_requirements))}::jsonb)\n` +
        `  on conflict (place_id) do update set ${zcols.map((c) => `${c} = excluded.${c}`).join(', ')}, extra_requirements = excluded.extra_requirements;`,
    );
    out.push(`delete from public.place_hours where place_id = ${lit(id)};`);
    for (const h of r.hours)
      out.push(`insert into public.place_hours (place_id, schedule, weekday, open_minute, close_minute) values (${lit(id)}, ${lit(h.schedule)}, ${h.weekday}, ${h.open_minute}, ${h.close_minute});`);
    out.push(`delete from public.place_hour_exceptions where place_id = ${lit(id)};`);
    for (const e of r.exceptions)
      out.push(
        `insert into public.place_hour_exceptions (place_id, schedule, date, is_closed, open_minute, close_minute, note) values (${lit(id)}, ${lit(e.schedule)}, ${lit(e.date)}, ${lit(e.is_closed)}, ${lit(e.open_minute)}, ${lit(e.close_minute)}, ${lit(e.note)});`,
      );
    // 確認記録は履歴として追加のみ（同じ内容は重複させない）
    for (const v of r.verifications)
      out.push(
        `insert into public.place_verifications (place_id, field, method, verified_at, evidence_url, evidence_note)\n` +
          `  select ${lit(id)}, ${lit(v.field)}, ${lit(v.method)}, ${lit(v.verified_at)}, ${lit(v.evidence_url)}, ${lit(v.evidence_note)}\n` +
          `  where not exists (select 1 from public.place_verifications where place_id = ${lit(id)} and field = ${lit(v.field)} and verified_at = ${lit(v.verified_at)} and method = ${lit(v.method)});`,
      );
  }
  out.push('commit;');
  return out.join('\n') + '\n';
}
