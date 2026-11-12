import type {
  CarryMethod,
  DogSex,
  DogSize,
  Eligibility,
  FeeStatus,
  FloorType,
  OperatingStatus,
  PlaceCategory,
  Tri,
  VerificationField,
  VerificationMethod,
  ZoneScope,
} from './types';

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  cafe: 'カフェ',
  restaurant: '飲食店',
  commercial: '商業施設',
  other_rest: '休憩できる施設',
  home_center: 'ホームセンター',
  pet_shop: 'ペットショップ',
  public_facility: '公共施設',
};

export const DOG_SIZE_LABEL: Record<DogSize, string> = {
  small: '小型犬',
  medium: '中型犬',
  large: '大型犬',
};

export const FLOOR_LABEL: Record<FloorType, string> = {
  non_slip: '滑りにくい床',
  slippery: '滑りやすい床',
  mixed: '場所により滑りやすい床',
  unknown: '床は未確認',
};

export const DOG_SEX_LABEL: Record<DogSex, string> = {
  male: 'オス',
  female: 'メス',
};

export const CARRY_METHOD_LABEL: Record<CarryMethod, string> = {
  leash_floor: 'リードで床歩行',
  cart: 'カート',
  bag: 'バッグ',
  held: '抱っこ',
};

export const ZONE_SCOPE_LABEL: Record<ZoneScope, string> = {
  indoor_whole: '店内',
  indoor_partial: '店内の一部のみ',
  private_room: '個室のみ',
  terrace: 'テラスのみ',
  other: 'その他の区画',
  unknown: '区画は未確認',
};

export const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  open: '誰でも利用可',
  guests_only: '宿泊者限定',
  members_only: '会員限定',
  other_restricted: '利用者限定',
  unknown: '利用資格は未確認',
};

export const FEE_LABEL: Record<FeeStatus, string> = {
  free: '犬の同伴料金なし',
  paid: '料金あり',
  unknown: '料金は未確認',
};

export const OPERATING_LABEL: Record<OperatingStatus, string> = {
  normal: '通常営業',
  temporarily_closed: '一時休業中',
  closed: '閉業',
  unknown: '営業状況は未確認',
};

export const VERIFICATION_FIELD_LABEL: Record<VerificationField, string> = {
  indoor_dogs: '室内同伴',
  air_conditioning: '冷房',
  dog_conditions: '犬の条件',
  usage_conditions: '利用条件',
  hours: '営業時間',
};

export const VERIFICATION_METHOD_LABEL: Record<VerificationMethod, string> = {
  official_info: '店舗の公式情報',
  phone: '店舗への電話確認',
  onsite: '運営者による現地確認',
  other: 'その他',
};

export function triLabel(t: Tri, yes: string, no: string, unknown = '未確認'): string {
  return t === 'yes' ? yes : t === 'no' ? no : unknown;
}
