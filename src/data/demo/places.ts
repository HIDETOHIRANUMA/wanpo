import { toJst } from '@/domain/hours';
import { AREAS } from './areas';
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
 * 架空のデモ施設（26件。東京3区＋大阪・福岡・札幌）。実在の店舗・住所・電話・確認情報ではない。
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
  breed: { status: 'none' },
  maxDogs: { kind: 'max', count: 2 },
  floor: 'non_slip',
  dogMenu: 'unknown',
  dogSeats: null,
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
  /** 予約ページあり（デモでは example.com。リンクは開かない） */
  reservation?: boolean;
}

/** 雰囲気タグ（デモ）。写真の代わりに一覧で雰囲気を伝える */
const DEMO_TAGS: Record<string, string[]> = {
  'demo-01': ['木のぬくもり', '大きな窓', 'ソファ席'],
  'demo-02': ['開放的', 'テラス', '緑が多い'],
  'demo-03': ['レトロ', '窓際席'],
  'demo-04': ['焼きたてパン', '明るい'],
  'demo-05': ['広々', 'ベンチ'],
  'demo-06': ['自家焙煎', 'カウンター'],
  'demo-07': ['上質', '天井が高い', 'ソファ席'],
  'demo-08': ['昔ながら', '落ち着き'],
  'demo-09': ['アメリカン', 'ボックス席'],
  'demo-10': ['夜カフェ', '間接照明'],
  'demo-11': ['和モダン', '静か'],
  'demo-13': ['隠れ家', '小上がり'],
  'demo-14': ['個室', '記念日向け'],
  'demo-15': ['小さなお店', 'かわいい'],
  'demo-16': ['ラウンジ', '広々'],
  'demo-17': ['ガラス張り', '大型犬も'],
  'demo-18': ['定食', '家庭的'],
  'demo-19': ['ガーデン', '緑が多い'],
  'demo-21': ['川沿い', '明るい', 'ソファ席'],
  'demo-22': ['ビルの中', '広々'],
  'demo-23': ['港町', '大きな窓'],
  'demo-24': ['屋台風', 'にぎやか'],
  'demo-25': ['北欧風', '暖炉風'],
  'demo-26': ['地下街', 'ベンチ'],
  'demo-27': ['広い通路', 'カート貸出'],
  'demo-28': ['ペット用品', '水あり'],
  'demo-29': ['無料', '静か'],
};

/** 犬種・頭数・床・犬用メニュー・席数（デモ）。照合と表示の確認用 */
const DEMO_DOG_DETAILS: Record<string, Partial<DogZone>> = {
  'demo-01': { dogMenu: 'yes', dogSeats: 8, maxDogs: { kind: 'max', count: 3 } },
  'demo-02': { floor: 'mixed', dogSeats: 12 },
  'demo-03': { breed: { status: 'brachycephalic_ng', text: '夏季（6〜9月）は短頭種の入店不可' }, maxDogs: { kind: 'max', count: 1 } },
  'demo-04': { floor: 'slippery', dogMenu: 'no' },
  'demo-07': { dogMenu: 'yes', dogSeats: 20, maxDogs: { kind: 'none' } },
  'demo-09': { floor: 'slippery', breed: { status: 'unknown' }, maxDogs: { kind: 'unknown' } },
  'demo-10': { breed: { status: 'text_only', text: '大型の闘犬種は不可' } },
  'demo-11': { dogSeats: 4, maxDogs: { kind: 'max', count: 1 } },
  'demo-15': { dogMenu: 'yes', dogSeats: 3 },
  'demo-17': { maxDogs: { kind: 'none' }, dogSeats: 15 },
  'demo-21': { dogMenu: 'yes' },
  'demo-27': { maxDogs: { kind: 'none' }, floor: 'mixed' },
  'demo-28': { dogMenu: 'yes', maxDogs: { kind: 'none' } },
  'demo-29': { maxDogs: { kind: 'max', count: 2 }, floor: 'non_slip' },
};

const AREA_ADDRESS: Record<string, string> = {
  shinagawa: '東京都品川区（デモ用の架空住所）',
  minato: '東京都港区（デモ用の架空住所）',
  shibuya: '東京都渋谷区（デモ用の架空住所）',
  'osaka-kita': '大阪府大阪市北区（デモ用の架空住所）',
  'fukuoka-chuo': '福岡県福岡市中央区（デモ用の架空住所）',
  'sapporo-chuo': '北海道札幌市中央区（デモ用の架空住所）',
};

const AREA_NAME: Record<string, string> = Object.fromEntries(AREAS.map((a) => [a.id, a.name]));

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
      reservation: true,
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
      reservation: true,
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
      reservation: true,
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
    // ---- 飲食店以外の「涼める場所」 ----
    {
      id: 'demo-27',
      name: 'デモ・ホームセンター港南店',
      category: 'home_center',
      areaId: 'shinagawa',
      lat: 35.6268,
      lng: 139.7445,
      zone: { name: '売場全体（カート利用）', carry: { status: 'confirmed', allowed: ['cart', 'bag', 'held'], text: '店内はカートまたは抱っこで' } },
      usage: { orderRequired: 'no', water: 'no' },
      businessHours: { weekly: everyDay([p(h(9), h(20))]), exceptions: [] },
      verify: ALL_KEYS(14),
      description: '買い物ついでに涼める大型店。ペット用カートの貸し出しあり（デモ）。',
    },
    {
      id: 'demo-28',
      name: 'デモ・ペットショップ わんにゃん広場',
      category: 'pet_shop',
      areaId: 'shibuya',
      lat: 35.6602,
      lng: 139.7032,
      usage: { orderRequired: 'no' },
      verify: ALL_KEYS(6),
      description: '店内で休憩でき、水も用意されています（デモ）。',
    },
    {
      id: 'demo-29',
      name: 'デモ・区民センター ペット同伴休憩室',
      category: 'public_facility',
      areaId: 'minato',
      lat: 35.6498,
      lng: 139.7422,
      zone: { name: '1階ペット同伴休憩室', carry: { status: 'confirmed', allowed: ['leash_floor', 'cart', 'bag'] } },
      usage: { orderRequired: 'no', fee: 'free' },
      businessHours: { weekly: everyDay([p(h(9), h(21))]), exceptions: [] },
      verify: ALL_KEYS(20),
      description: '無料で使える公共の休憩室（デモ）。',
    },
    // ---- 全国展開の確認用（大阪・福岡・札幌） ----
    {
      id: 'demo-21',
      name: 'デモ・かわべりカフェ梅田',
      category: 'cafe',
      areaId: 'osaka-kita',
      lat: 34.7045,
      lng: 135.4985,
      verify: ALL_KEYS(12),
      reservation: true,
      description: '大阪のデモ施設です。',
    },
    {
      id: 'demo-22',
      name: 'デモ・北区ショッピングモール ペットラウンジ',
      category: 'commercial',
      areaId: 'osaka-kita',
      lat: 34.7012,
      lng: 135.4952,
      zone: { name: '3階ペットラウンジ', carry: { status: 'confirmed', allowed: ['cart', 'bag'] } },
      verify: ALL_KEYS(20),
    },
    {
      id: 'demo-23',
      name: 'デモ・天神みなとダイニング',
      category: 'restaurant',
      areaId: 'fukuoka-chuo',
      lat: 33.5915,
      lng: 130.3995,
      usage: { orderRequired: 'yes', orderText: '1人1品以上' },
      verify: ALL_KEYS(15),
      reservation: true,
    },
    {
      id: 'demo-24',
      name: 'デモ・けやき通り喫茶（冷房未確認）',
      category: 'cafe',
      areaId: 'fukuoka-chuo',
      lat: 33.5862,
      lng: 130.3905,
      zone: { airConditioning: 'unknown' },
      verify: { indoor_dogs: 30, dog_conditions: 30 },
    },
    {
      id: 'demo-25',
      name: 'デモ・大通りノルドカフェ',
      category: 'cafe',
      areaId: 'sapporo-chuo',
      lat: 43.0605,
      lng: 141.3505,
      verify: ALL_KEYS(7),
    },
    {
      id: 'demo-26',
      name: 'デモ・地下街の休憩スペース',
      category: 'other_rest',
      areaId: 'sapporo-chuo',
      lat: 43.0625,
      lng: 141.3545,
      zone: { name: '地下休憩スペース', carry: { status: 'confirmed', allowed: ['cart', 'bag', 'held'] } },
      usage: { water: 'no' },
      verify: ALL_KEYS(25),
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
    zone: { ...baseZone, id: `${s.id}-zone`, ...DEMO_DOG_DETAILS[s.id], ...s.zone },
    usage: { ...baseUsage, ...s.usage },
    businessHours: s.businessHours ?? standard,
    dogHours: s.dogHours ?? { mode: 'same_as_business' },
    verifications: verifs(now, s.id, s.verify),
    phone: s.phone,
    officialUrl: s.officialUrl,
    reservationUrl: s.reservation ? `https://example.com/${s.id}/reserve` : undefined,
    atmosphereTags: DEMO_TAGS[s.id] ?? [],
    // デモでは実在の店舗写真に見える画像を使わない（一覧はイラストで表示）
    media: [],
    areaName: AREA_NAME[s.areaId],
    description: s.description,
    isDemo: true,
    createdAt: daysAgoIso(now, 300),
    updatedAt: daysAgoIso(now, s.updatedDaysAgo ?? 2),
  }));
}
