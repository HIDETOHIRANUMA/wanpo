/**
 * supabase/migrations の公開テーブルに対応する行型（手書き）。
 * スキーマ変更時は `npx supabase gen types typescript` の出力と突き合わせること。
 */
type TriDb = 'yes' | 'no' | 'unknown';

export interface PlaceRow {
  id: string;
  name: string;
  category: 'cafe' | 'restaurant' | 'commercial' | 'other_rest';
  address: string;
  area_id: string;
  lat: number;
  lng: number;
  timezone: string;
  publication_status: 'draft' | 'published' | 'archived';
  operating_status: 'normal' | 'temporarily_closed' | 'closed' | 'unknown';
  eligibility: 'open' | 'guests_only' | 'members_only' | 'other_restricted' | 'unknown';
  eligibility_text: string | null;
  order_required: TriDb;
  order_text: string | null;
  reservation_required: TriDb;
  reservation_text: string | null;
  fee_status: 'free' | 'paid' | 'unknown';
  fee_text: string | null;
  water: TriDb;
  business_hours_status: 'confirmed' | 'unknown';
  dog_hours_mode: 'same_as_business' | 'custom' | 'unknown';
  phone: string | null;
  official_url: string | null;
  photo_url: string | null;
  photo_rights: string | null;
  photo_credit: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  place_dog_zones: ZoneRow[] | null;
  place_hours: HourRow[] | null;
  place_hour_exceptions: HourExceptionRow[] | null;
  place_verifications: VerificationRow[] | null;
}

export interface ZoneRow {
  id: string;
  place_id: string;
  name: string;
  scope: 'indoor_whole' | 'indoor_partial' | 'private_room' | 'terrace' | 'other' | 'unknown';
  indoor_dogs: TriDb;
  air_conditioning: TriDb;
  weight_limit_kind: 'none' | 'max_kg' | 'text_only' | 'unknown';
  weight_max_kg: number | string | null; // numeric は文字列で返ることがある
  weight_max_inclusive: boolean | null;
  weight_limit_text: string | null;
  carry_status: 'confirmed' | 'unknown';
  carry_methods: ('leash_floor' | 'cart' | 'bag' | 'held')[] | null;
  carry_text: string | null;
  certificate: 'not_required' | 'required' | 'unknown';
  certificate_text: string | null;
  extra_requirements: unknown;
}

export interface HourRow {
  schedule: 'business' | 'dog';
  weekday: number;
  open_minute: number;
  close_minute: number;
}

export interface HourExceptionRow {
  schedule: 'business' | 'dog';
  date: string;
  is_closed: boolean;
  open_minute: number | null;
  close_minute: number | null;
  note: string | null;
}

export interface VerificationRow {
  id: string;
  field: 'indoor_dogs' | 'air_conditioning' | 'dog_conditions' | 'usage_conditions' | 'hours';
  method: 'official_info' | 'phone' | 'onsite' | 'other';
  verified_at: string;
  evidence_url: string | null;
  evidence_note: string | null;
}

export interface AreaRow {
  id: string;
  name: string;
  prefecture: string;
  lat: number;
  lng: number;
}

export interface StationRow {
  id: string;
  name: string;
  area_id: string;
  lat: number;
  lng: number;
}
