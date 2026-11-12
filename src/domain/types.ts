/**
 * ドメイン型。UI・通信から独立させる。
 * 不明は必ず 'unknown' として保持し、null や空配列を「制限なし」「可」に読み替えない。
 */

/** 三値。未入力・不明は 'unknown'。 */
export type Tri = 'yes' | 'no' | 'unknown';

export type PlaceCategory = 'cafe' | 'restaurant' | 'commercial' | 'other_rest';

export type PublicationStatus = 'draft' | 'published' | 'archived';

export type OperatingStatus = 'normal' | 'temporarily_closed' | 'closed' | 'unknown';

/** 同伴方法：リードで床歩行／カート／バッグ／抱っこ */
export type CarryMethod = 'leash_floor' | 'cart' | 'bag' | 'held';
export const CARRY_METHODS: CarryMethod[] = ['leash_floor', 'cart', 'bag', 'held'];

/** 犬が滞在できる区画の種類 */
export type ZoneScope =
  | 'indoor_whole' // 店内全体
  | 'indoor_partial' // 店内の一部のみ
  | 'private_room' // 個室のみ
  | 'terrace' // テラスのみ
  | 'other'
  | 'unknown';

export type WeightLimit =
  | { kind: 'none' } // 制限なしと確認済み
  | { kind: 'max_kg'; maxKg: number; inclusive: boolean; text?: string } // 上限kg（境界を含むか）
  | { kind: 'text_only'; text: string } // 「小型犬のみ」等の文章のみ
  | { kind: 'unknown' };

export type CarryPolicy =
  | { status: 'confirmed'; allowed: CarryMethod[]; text?: string } // allowed は OR
  | { status: 'unknown'; text?: string };

export type CertificateRequirement =
  | { status: 'not_required' }
  | { status: 'required'; text?: string }
  | { status: 'unknown' };

/** 判定できない条件（「大型犬の場合だけカート必須」など）は原文のまま needs_check にする */
export interface ExtraRequirement {
  text: string;
  /** needs_check: 判定に影響（要確認）。info: 判定に影響しない注意事項 */
  effect: 'needs_check' | 'info';
}

export type Eligibility =
  | 'open' // 誰でも利用可
  | 'guests_only' // 宿泊者限定
  | 'members_only' // 会員限定
  | 'other_restricted'
  | 'unknown';

export type FeeStatus = 'free' | 'paid' | 'unknown';

/** 犬同伴区画（MVPでは1施設1区画。将来は複数区画） */
export interface DogZone {
  id: string;
  name: string; // 例「店内奥のソファ席」
  scope: ZoneScope;
  indoorDogs: Tri; // この区画で犬が室内に同伴できるか
  airConditioning: Tri; // この区画に冷房があるか
  weightLimit: WeightLimit;
  carry: CarryPolicy;
  certificate: CertificateRequirement;
  extraRequirements: ExtraRequirement[];
}

export interface UsageConditions {
  eligibility: Eligibility;
  eligibilityText?: string;
  orderRequired: Tri; // yes=注文必須
  orderText?: string;
  reservationRequired: Tri; // yes=予約必須
  reservationText?: string;
  fee: FeeStatus;
  feeText?: string;
  water: Tri; // 犬用の水
}

/** 営業時間帯。分単位。closeMin が 1440 を超える場合は翌日にまたがる（例 18:00-翌2:00 = 1080-1560） */
export interface Period {
  openMin: number; // 0..1439
  closeMin: number; // openMin+1 .. openMin+1440
}

/** 0=日曜 … 6=土曜（Asia/Tokyo） */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeeklySchedule {
  status: 'confirmed' | 'unknown';
  /** confirmed のとき、空配列はその曜日は定休 */
  byWeekday: Partial<Record<Weekday, Period[]>>;
}

export interface HourException {
  date: string; // YYYY-MM-DD（Asia/Tokyo）
  closed: boolean;
  periods: Period[]; // closed=false のときの時間帯
  note?: string;
}

export interface Schedule {
  weekly: WeeklySchedule;
  exceptions: HourException[];
}

export type DogHours =
  | { mode: 'same_as_business' }
  | { mode: 'custom'; schedule: Schedule }
  | { mode: 'unknown' };

export type VerificationField =
  | 'indoor_dogs'
  | 'air_conditioning'
  | 'dog_conditions'
  | 'usage_conditions'
  | 'hours';

export const KEY_VERIFICATION_FIELDS: VerificationField[] = [
  'indoor_dogs',
  'air_conditioning',
  'dog_conditions',
];

export type VerificationMethod = 'official_info' | 'phone' | 'onsite' | 'other';

export interface Verification {
  id: string;
  field: VerificationField;
  method: VerificationMethod;
  verifiedAt: string; // ISO
  evidenceUrl?: string;
  evidenceNote?: string;
}

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string;
  areaId: string;
  lat: number;
  lng: number;
  timezone: 'Asia/Tokyo';
  publicationStatus: PublicationStatus;
  operatingStatus: OperatingStatus;
  zone: DogZone;
  usage: UsageConditions;
  businessHours: Schedule;
  dogHours: DogHours;
  verifications: Verification[];
  phone?: string;
  officialUrl?: string;
  /** 予約ページ（https のみ）。店舗の公式予約ページや予約サービスの店舗ページ */
  reservationUrl?: string;
  /** 雰囲気タグ（運営が登録。例「明るい」「ソファ席」）。最大6個 */
  atmosphereTags: string[];
  /** 運営が権利を確認して登録した店舗写真（外観・店内など）。並び順どおり */
  media: PlaceMedia[];
  /** 市区町村名（一覧表示・検索用） */
  areaName?: string;
  description?: string;
  /** デモデータか。デモでは外部連絡・経路を無効にする */
  isDemo: boolean;
  createdAt: string;
  updatedAt: string; // 店舗情報の更新。確認日ではない
}

export type MediaKind = 'exterior' | 'interior' | 'atmosphere' | 'dog_area';

/** 店舗写真。権利（掲載許諾など）と出典が揃ったものだけを表示する */
export interface PlaceMedia {
  id: string;
  url: string;
  kind: MediaKind;
  caption?: string;
  rights: string;
  credit: string;
}

export interface Area {
  id: string;
  name: string; // 例「港区」
  prefecture: string;
  /** 都道府県コード（1〜47） */
  prefectureCode?: number;
  lat: number;
  lng: number;
}

export interface Station {
  id: string;
  name: string; // 例「品川駅」
  areaId: string;
  lineName?: string;
  operator?: string;
  lat: number;
  lng: number;
}

/** 犬プロフィール（1頭）。未入力は null / 空配列 = 不明 */
export interface DogProfile {
  name: string | null;
  weightKg: number | null;
  /** 空配列は「不明」。全方法に対応できるとは解釈しない */
  carryMethods: CarryMethod[];
  canBringCertificate: Tri;
}

export const EMPTY_DOG_PROFILE: DogProfile = {
  name: null,
  weightKg: null,
  carryMethods: [],
  canBringCertificate: 'unknown',
};
