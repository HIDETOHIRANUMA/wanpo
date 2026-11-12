import { toJst } from '@/domain/hours';
import type {
  DogZone,
  Period,
  Place,
  Schedule,
  UsageConditions,
  Verification,
  VerificationField,
  VerificationMethod,
  Weekday,
} from '@/domain/types';

/**
 * 架空のデモ施設（約20件）。実在の店舗・住所・電話・確認情報ではない。
 * 確認日や臨時休業日は「基準時刻 now」からの相対で作り、時間が経っても同じ状態を再現する。
 */

const h = (hh: number, mm = 0) => hh * 60 + mm;
const p = (open: number, close: number): Period => ({ openMin: open, closeMin: close });

function everyDay(periods: Period[], closedDays: Weekday[] = []): Schedule['weekly'] {
  const byWeekday: Schedule['weekly']['byWeekday'] = {};
  for (const d of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
    byWeekday[d] = closedDays.includes(d) ? [] : periods;
  }
  return { status: 'confirmed', byWeekday };
}

const baseZone: DogZone = {
  id: 'zone',
  name: '店内',
  scope: 'indoor_whole',
  indoorDogs: 'yes',
  airConditioning: 'yes',
  weightLimit: { kind: 'none' },
  carry: { status: 'confirmed', allowed: ['leash_floor', 'cart', 'bag', 'held'] },
  certificate: { status: 'not_required' },
  extraRequirements: [],
};

const baseUsage: UsageConditions = {
  eligibility: 'open',
  orderRequired: 'no',
  reservationRequired: 'no',
  fee: 'free',
  water: 'yes',
};

function daysAgoIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

function verifs(
  now: Date,
  id: string,
  spec: Partial<Record<VerificationField, number>>,
  method: VerificationMethod = 'onsite',
): Verification[] {
  return (Object.entries(spec) as [VerificationField, number][]).map(([field, days]) => ({
    id: `${id}-${field}`,
    field,
    method,
    verifiedAt: daysAgoIso(now, days),
    evidenceNote: 'デモ用の架空の確認記録です',
  }));
}

const ALL_KEYS = (d: number) => ({ indoor_dogs: d, air_conditioning: d, dog_conditions: d, usage_conditions: d, hours: d });

interface DemoSpec {
  id: string;
  name: string;
  category: Place['category'];
  areaId: string;
  lat: number;
  lng: number;
  zone?: Partial<DogZone>;
  usage?: Partial<UsageConditions>;
  businessHours?: Schedule;
  dogHours?: Place['dogHours'];
  verify: Partial<Record<VerificationField, number>>;
  publicationStatus?: Place['publicationStatus'];
  operatingStatus?: Place['operatingStatus'];
  phone?: string;
  officialUrl?: string;
  description?: string;
  updatedDaysAgo?: number;
}

const AREA_ADDRESS: Record<string, string> = {
  shinagawa: '東京都品川区（デモ用の架空住所）',
  minato: '東京都港区（デモ用の架空住所）',
  shibuya: '東京都渋谷区（デモ用の架空住所）',
};

export function createDemoPlaces(now: Date): Place[] {
  const today = toJst(now).date;
  const standard: Schedule = { weekly: everyDay([p(h(10), h(19))]), exceptions: [] };

  const specs: DemoSpec[] = [
    {
      id: 'demo-01',
      name: 'デモ・こもれびカフェ',
      category: 'cafe',
      areaId: 'shinagawa',
      lat: 35.6255,
      lng: 139.7245,
      zone: { name: '店内全席' },
      verify: ALL_KEYS(10),
      phone: '03-0000-0001',
      officialUrl: 'https://example.com/demo-01',
      description: '室内・冷房ありの確認記録があるデモ施設です。',
    },
    {
      id: 'demo-02',
      name: 'デモ・テラスごはん',
      category: 'restaurant',
      areaId: 'minato',
      lat: 35.6475,
      lng: 139.7455,
      zone: { name: 'テラス席', scope: 'terrace', indoorDogs: 'no', airConditioning: 'no' },
      verify: ALL_KEYS(15),
      description: '店内には冷房がありますが、犬と過ごせるのはテラス席のみです。',
    },
    {
      id: 'demo-03',
      name: 'デモ・まどべ喫茶（冷房未確認）',
      category: 'cafe',
      areaId: 'shibuya',
      lat: 35.6598,
      lng: 139.7032,
      zone: { name: '窓際席', airConditioning: 'unknown' },
      verify: { indoor_dogs: 20, dog_conditions: 20 },
    },
    {
      id: 'demo-04',
      name: 'デモ・ベーカリーテーブル（10kg以下）',
      category: 'cafe',
      areaId: 'minato',
      lat: 35.6545,
      lng: 139.7375,
      zone: { weightLimit: { kind: 'max_kg', maxKg: 10, inclusive: true, text: '体重10kg以下' } },
      verify: ALL_KEYS(30),
    },
    {
      id: 'demo-05',
      name: 'デモ・ショッピングプラザ休憩ラウンジ',
      category: 'commercial',
      areaId: 'minato',
      lat: 35.6562,
      lng: 139.7558,
      zone: {
        name: '2階休憩ラウンジ',
        carry: { status: 'confirmed', allowed: ['cart', 'bag'], text: 'カートまたはバッグに入れてください' },
      },
      usage: { orderRequired: 'no' },
      verify: ALL_KEYS(25),
    },
    {
      id: 'demo-06',
      name: 'デモ・ワンドリンク珈琲',
      category: 'cafe',
      areaId: 'shibuya',
      lat: 35.6475,
      lng: 139.7115,
      usage: { orderRequired: 'yes', orderText: '1人1ドリンク以上の注文が必要' },
      verify: ALL_KEYS(12),
    },
    {
      id: 'demo-07',
      name: 'デモ・ホテルラウンジ（宿泊者限定）',
      category: 'other_rest',
      areaId: 'minato',
      lat: 35.6615,
      lng: 139.7305,
      zone: { name: 'ロビーラウンジ' },
      usage: { eligibility: 'guests_only', eligibilityText: '宿泊者のみ利用可', fee: 'paid', feeText: '犬の同伴は1泊ごとに料金あり' },
      verify: ALL_KEYS(40),
    },
    {
      id: 'demo-08',
      name: 'デモ・むかし確認のパーラー',
      category: 'cafe',
      areaId: 'shinagawa',
      lat: 35.6085,
      lng: 139.7335,
      verify: ALL_KEYS(200),
      description: '確認から時間が経っているデモ施設です。',
    },
    {
      id: 'demo-09',
      name: 'デモ・時間未確認のダイナー',
      category: 'restaurant',
      areaId: 'shibuya',
      lat: 35.6685,
      lng: 139.6815,
      businessHours: { weekly: { status: 'unknown', byWeekday: {} }, exceptions: [] },
      verify: { indoor_dogs: 20, air_conditioning: 20, dog_conditions: 20 },
    },
    {
      id: 'demo-10',
      name: 'デモ・よふかしビストロ（深夜営業）',
      category: 'restaurant',
      areaId: 'shibuya',
      lat: 35.6572,
      lng: 139.6995,
      businessHours: { weekly: everyDay([p(h(18), h(26))], [1]), exceptions: [] },
      verify: ALL_KEYS(14),
      description: '18時〜翌2時営業（月曜定休）のデモ施設です。',
    },
    {
      id: 'demo-11',
      name: 'デモ・本日臨時休業の茶房',
      category: 'cafe',
      areaId: 'minato',
      lat: 35.6638,
      lng: 139.7135,
      businessHours: {
        weekly: everyDay([p(h(9), h(18))]),
        exceptions: [{ date: today, closed: true, periods: [], note: '設備点検のため臨時休業（デモ）' }],
      },
      verify: ALL_KEYS(8),
    },
    {
      id: 'demo-12',
      name: 'デモ・未公開の下書き施設',
      category: 'cafe',
      areaId: 'shinagawa',
      lat: 35.6205,
      lng: 139.7295,
      publicationStatus: 'draft',
      verify: ALL_KEYS(3),
    },
    {
      id: 'demo-13',
      name: 'デモ・奥の小部屋カフェ（店内の一部のみ）',
      category: 'cafe',
      areaId: 'shinagawa',
      lat: 35.6275,
      lng: 139.7395,
      zone: { name: '店内奥の犬同伴エリア', scope: 'indoor_partial' },
      verify: ALL_KEYS(18),
    },
    {
      id: 'demo-14',
      name: 'デモ・個室ダイニング（個室のみ）',
      category: 'restaurant',
      areaId: 'minato',
      lat: 35.6572,
      lng: 139.7348,
      zone: { name: '個室', scope: 'private_room' },
      usage: { reservationRequired: 'yes', reservationText: '個室は前日までの予約制', orderRequired: 'yes', orderText: 'コース料理の注文が必要' },
      verify: ALL_KEYS(22),
    },
    {
      id: 'demo-15',
      name: 'デモ・小型犬さんの喫茶室',
      category: 'cafe',
      areaId: 'shibuya',
      lat: 35.6522,
      lng: 139.7215,
      zone: { weightLimit: { kind: 'text_only', text: '小型犬のみ' } },
      verify: ALL_KEYS(35),
    },
    {
      id: 'demo-16',
      name: 'デモ・ワクチン証明が必要なラウンジ',
      category: 'other_rest',
      areaId: 'shinagawa',
      lat: 35.6198,
      lng: 139.7062,
      zone: { certificate: { status: 'required', text: '狂犬病予防注射済票・混合ワクチン接種証明書' } },
      verify: ALL_KEYS(28),
    },
    {
      id: 'demo-17',
      name: 'デモ・大型犬はカート必須のカフェ',
      category: 'cafe',
      areaId: 'minato',
      lat: 35.6462,
      lng: 139.7495,
      zone: {
        carry: { status: 'confirmed', allowed: ['leash_floor', 'cart'] },
        extraRequirements: [{ text: '大型犬の場合はカート必須', effect: 'needs_check' }],
      },
      verify: ALL_KEYS(16),
    },
    {
      id: 'demo-18',
      name: 'デモ・昼休みありの定食処（犬同伴は午後のみ）',
      category: 'restaurant',
      areaId: 'shinagawa',
      lat: 35.6072,
      lng: 139.7368,
      businessHours: { weekly: everyDay([p(h(11), h(14)), p(h(17), h(21))], [3]), exceptions: [] },
      dogHours: { mode: 'custom', schedule: { weekly: everyDay([p(h(13), h(21))], [3]), exceptions: [] } },
      usage: { water: 'no' },
      verify: ALL_KEYS(9),
      description: '昼休み（14〜17時）あり。犬同伴は13時以降。',
    },
    {
      id: 'demo-19',
      name: 'デモ・一時休業中のガーデンカフェ',
      category: 'cafe',
      areaId: 'shibuya',
      lat: 35.6628,
      lng: 139.6955,
      operatingStatus: 'temporarily_closed',
      verify: ALL_KEYS(11),
    },
    {
      id: 'demo-20',
      name: 'デモ・室内同伴の記録がない商業施設（とても長い名前の表示確認用デモ施設・アネックス館）',
      category: 'commercial',
      areaId: 'shinagawa',
      lat: 35.6295,
      lng: 139.7215,
      zone: { name: '1階共用ベンチエリア', carry: { status: 'unknown' }, weightLimit: { kind: 'unknown' }, certificate: { status: 'unknown' } },
      usage: { water: 'unknown', reservationRequired: 'unknown', orderRequired: 'unknown', fee: 'unknown', eligibility: 'unknown' },
      verify: { air_conditioning: 30 },
      description: '室内同伴「可」と入力されていますが、確認記録がないため未確認として扱います。',
    },
  ];

  return specs.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    address: AREA_ADDRESS[s.areaId],
    areaId: s.areaId,
    lat: s.lat,
    lng: s.lng,
    timezone: 'Asia/Tokyo',
    publicationStatus: s.publicationStatus ?? 'published',
    operatingStatus: s.operatingStatus ?? 'normal',
    zone: { ...baseZone, id: `${s.id}-zone`, ...s.zone },
    usage: { ...baseUsage, ...s.usage },
    businessHours: s.businessHours ?? standard,
    dogHours: s.dogHours ?? { mode: 'same_as_business' },
    verifications: verifs(now, s.id, s.verify),
    phone: s.phone,
    officialUrl: s.officialUrl,
    description: s.description,
    isDemo: true,
    createdAt: daysAgoIso(now, 300),
    updatedAt: daysAgoIso(now, s.updatedDaysAgo ?? 2),
  }));
}
